-- 1. Update Admin Password to SHA-256 Hash
-- The hash below is for 'zoona2025'
UPDATE admin_settings
SET value = '0e8f6b07e379770c480eb2817d5596a64334849ab8090fe870d79402312ca162'
WHERE key = 'admin_password';

-- 2. Tighten Admin Settings RLS
-- Only allow public (anon) to read non-sensitive commission rules.
-- Protect the admin_password hash from public SELECT.
DROP POLICY IF EXISTS "Allow public read for commission settings" ON admin_settings;
DROP POLICY IF EXISTS "Public read non-sensitive settings" ON admin_settings;

CREATE POLICY "Public read non-sensitive settings" ON admin_settings
FOR SELECT
TO anon
USING (key IN ('commission_threshold', 'commission_low_rate', 'commission_high_rate'));

-- 3. Tighten Affiliate Users RLS
-- Since login is now proxied server-side via action=login_affiliate,
-- we can restrict public SELECT access.
DROP POLICY IF EXISTS "Allow public login check" ON affiliate_users;
DROP POLICY IF EXISTS "Public login lookup" ON affiliate_users;

-- Standard users (anon) should not be able to list all marketers.
-- Only the Service Role (used by Vercel API) should have full access.
ALTER TABLE affiliate_users ENABLE ROW LEVEL SECURITY;

-- 4. Ensure Orders and Affiliate Data are protected
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Only Allow Admin (authenticated) to see everything
-- Note: Vercel Proxy bypasses these if using the Service Role Key.
CREATE POLICY "Admin full access" ON affiliate_users TO authenticated USING (true);
CREATE POLICY "Admin full access" ON orders TO authenticated USING (true);
CREATE POLICY "Admin full access" ON affiliate_orders TO authenticated USING (true);
CREATE POLICY "Admin full access" ON affiliate_clicks TO authenticated USING (true);
CREATE POLICY "Admin full access" ON admin_settings TO authenticated USING (true);

-- 1. Update Admin Password to SHA-256 Hash
-- The hash below is for 'zoona2025'
UPDATE admin_settings
SET value = '0e8f6b07e379770c480eb2817d5596a64334849ab8090fe870d79402312ca162'
WHERE key = 'admin_password';

-- 2. Update Admin Settings RLS (CRITICAL FIX)
-- We MUST allow the API Proxy to read the admin_password key for verification.
-- Since it's hashed, it's safe to include in the allowed keys.
DROP POLICY IF EXISTS "Public read non-sensitive settings" ON admin_settings;
DROP POLICY IF EXISTS "Public read settings" ON admin_settings;

CREATE POLICY "Public read settings" ON admin_settings
FOR SELECT
TO anon
USING (key IN ('commission_threshold', 'commission_low_rate', 'commission_high_rate', 'admin_password'));

-- 3. Tighten Affiliate Users RLS
DROP POLICY IF EXISTS "Allow public login check" ON affiliate_users;
DROP POLICY IF EXISTS "Public login lookup" ON affiliate_users;

ALTER TABLE affiliate_users ENABLE ROW LEVEL SECURITY;

-- 4. Ensure Orders and Affiliate Data are protected
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Only Allow Admin (authenticated) to see everything
-- Note: Vercel Proxy bypasses these if using the Service Role Key.
CREATE POLICY "Admin full access" ON affiliate_users TO authenticated USING (true);
CREATE POLICY "Admin full access" ON orders TO authenticated USING (true);
CREATE POLICY "Admin full access" ON affiliate_orders TO authenticated USING (true);
CREATE POLICY "Admin full access" ON affiliate_clicks TO authenticated USING (true);
CREATE POLICY "Admin full access" ON admin_settings TO authenticated USING (true);

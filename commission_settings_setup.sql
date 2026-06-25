-- Setup for tiered commission settings and admin password
CREATE TABLE IF NOT EXISTS admin_settings (
    id BIGSERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow public read" ON admin_settings;
DROP POLICY IF EXISTS "Allow proxy authentication" ON admin_settings;
DROP POLICY IF EXISTS "Allow settings management" ON admin_settings;

-- 1. Allow public read ONLY for non-sensitive keys (Marketer Dashboard needs these)
CREATE POLICY "Allow public read for non-sensitive keys"
ON admin_settings FOR SELECT
USING (key IN ('commission_threshold', 'commission_low_rate', 'commission_high_rate'));

-- 2. Sensitive operations (like reading password or writing settings)
-- should ideally be done via the Service Role key in the Vercel Proxy, which bypasses RLS.
-- If the proxy uses the anon key, we'd need a more complex way to identify it.
-- For now, we restrict the anon key to only the public fields.

-- Initialize default values if they don't exist
INSERT INTO admin_settings (key, value) VALUES
('commission_threshold', '100000'),
('commission_low_rate', '8'),
('commission_high_rate', '6'),
('admin_password', 'zoona2025')
ON CONFLICT (key) DO NOTHING;

-- Ensure RLS is active on other relevant tables for the affiliate system
ALTER TABLE affiliate_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_tracking_clicks ENABLE ROW LEVEL SECURITY;

-- Basic public policies for affiliate system (restricting where possible)
DROP POLICY IF EXISTS "Allow public registration" ON affiliate_users;
CREATE POLICY "Allow public registration" ON affiliate_users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public login check" ON affiliate_users;
CREATE POLICY "Allow public login check" ON affiliate_users FOR SELECT USING (true);

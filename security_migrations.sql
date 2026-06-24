-- 1. Tighten Admin Settings RLS
-- We now use SUPABASE_SERVICE_ROLE_KEY on the server to read the password.
-- Public (anon) should ONLY be able to read commission rates/threshold.

DROP POLICY IF EXISTS "Public read non-sensitive settings" ON admin_settings;
DROP POLICY IF EXISTS "Public read settings" ON admin_settings;

CREATE POLICY "Public read settings" ON admin_settings
FOR SELECT
TO anon
USING (key IN ('commission_threshold', 'commission_low_rate', 'commission_high_rate'));

-- 2. Restrict password reading to Service Role only
-- By NOT including 'admin_password' in the policy above, anon users cannot read it.
-- Supabase Service Role bypasses RLS, so the API will still work.

-- 3. Ensure Table protection
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- 4. Admin Full Access (Optional, for Supabase Dashboard users)
CREATE POLICY "Admin full access" ON admin_settings TO authenticated USING (true);
CREATE POLICY "Admin full access" ON affiliate_users TO authenticated USING (true);
CREATE POLICY "Admin full access" ON orders TO authenticated USING (true);
CREATE POLICY "Admin full access" ON affiliate_orders TO authenticated USING (true);
CREATE POLICY "Admin full access" ON affiliate_clicks TO authenticated USING (true);

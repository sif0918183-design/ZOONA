-- Supabase SQL: Secure Row Level Security (RLS) Policies for ZOONA
-- These policies allow the local API handler (using anon key) to perform database operations
-- while still being protected by API-level origin and password checks.

-- Enable RLS on all relevant tables
ALTER TABLE IF EXISTS affiliate_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_tracking_clicks ENABLE ROW LEVEL SECURITY;

-- Create policies for public access via API (using anon key)
-- These allow the API handler to function. Access is secured at the API layer.
DROP POLICY IF EXISTS "API Access" ON affiliate_users;
CREATE POLICY "API Access" ON affiliate_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "API Access" ON orders;
CREATE POLICY "API Access" ON orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "API Access" ON order_products;
CREATE POLICY "API Access" ON order_products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "API Access" ON affiliate_orders;
CREATE POLICY "API Access" ON affiliate_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "API Access" ON affiliate_products;
CREATE POLICY "API Access" ON affiliate_products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "API Access" ON affiliate_tracking_clicks;
CREATE POLICY "API Access" ON affiliate_tracking_clicks FOR ALL USING (true) WITH CHECK (true);

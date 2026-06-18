-- Enable RLS
ALTER TABLE IF EXISTS affiliate_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_tracking_clicks ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for API operations (Security is managed at the API layer)
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

-- Supabase SQL for Affiliate Tracking and Order Management

-- =============================================
-- Table: affiliates
-- =============================================
CREATE TABLE IF NOT EXISTS affiliates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id TEXT UNIQUE NOT NULL, -- Alphanumeric ID (e.g., 'john1234')
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    password_hash TEXT NOT NULL, -- Stored as SHA-256 or similar
    status TEXT DEFAULT 'active', -- 'active', 'inactive'
    total_clicks INTEGER DEFAULT 0,
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Table: orders (Enhanced)
-- =============================================
-- Note: If 'orders' table already exists from previous setups,
-- we ensure it has the necessary columns for affiliate tracking.
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL, -- 'ORDER-XXXX-XXXX'
    user_id TEXT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    phone2 TEXT,
    city TEXT,
    city_type TEXT,
    shipping_cost NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL,
    address TEXT,
    location_lat NUMERIC,
    location_lng NUMERIC,
    location_link TEXT,
    payment_type TEXT,
    affiliate_id TEXT, -- References affiliates.affiliate_id
    affiliate_status TEXT DEFAULT 'pending', -- 'pending', 'paid'
    status TEXT DEFAULT 'new', -- 'new', 'processing', 'shipped', 'delivered', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Table: order_products
-- =============================================
CREATE TABLE IF NOT EXISTS order_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id TEXT,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    price NUMERIC NOT NULL,
    warehouse TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Table: affiliate_events (Click Tracking)
-- =============================================
CREATE TABLE IF NOT EXISTS affiliate_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'click', 'add_to_cart', etc.
    product_name TEXT,
    tracking_url TEXT,
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- RLS Policies
-- =============================================

-- Enable RLS
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_events ENABLE ROW LEVEL SECURITY;

-- Simple "Allow All" policies for public API (checked by password in JS)
-- In a production environment, these should be more restrictive.

CREATE POLICY "public_affiliates_all" ON affiliates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_orders_all" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_order_products_all" ON order_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_affiliate_events_all" ON affiliate_events FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_affiliates_id ON affiliates(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_orders_affiliate ON orders(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_events_affiliate ON affiliate_events(affiliate_id);

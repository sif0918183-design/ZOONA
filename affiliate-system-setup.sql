-- Affiliate System Database Setup (Improved Security)

-- Drop existing tables if they exist (Be careful in production!)
-- DROP TABLE IF EXISTS affiliate_events;
-- DROP TABLE IF EXISTS orders;
-- DROP TABLE IF EXISTS affiliates;

-- 1. Affiliates Table
CREATE TABLE IF NOT EXISTS affiliates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id TEXT UNIQUE NOT NULL, -- e.g., 'ZOONA123'
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    password_hash TEXT, -- To store hashed passwords
    status TEXT DEFAULT 'active', -- 'active', 'inactive'
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Orders Table (Linked to Affiliates)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id TEXT UNIQUE NOT NULL, -- The external order ID from the shop
    user_id TEXT, -- The unique user/visitor ID
    affiliate_id TEXT REFERENCES affiliates(affiliate_id), -- The referring affiliate
    status TEXT DEFAULT 'new', -- 'new', 'processing', 'shipped', 'delivered', 'cancelled'
    name TEXT, -- Customer Name
    phone TEXT, -- Customer Phone
    phone2 TEXT, -- Additional Phone
    city TEXT,
    city_type TEXT, -- 'cod' or 'prepaid'
    address TEXT,
    location_link TEXT,
    total_amount NUMERIC DEFAULT 0,
    shipping_cost NUMERIC DEFAULT 0,
    order_products JSONB, -- JSON array of products in the order
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Affiliate Tracking Events (Clicks, Cart Adds, etc.)
CREATE TABLE IF NOT EXISTS affiliate_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id TEXT REFERENCES affiliates(affiliate_id),
    event_type TEXT NOT NULL, -- 'click', 'add_to_cart', 'checkout_visit'
    product_id TEXT,
    product_name TEXT,
    user_agent TEXT,
    ip_address TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Update Products Table to include commission
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission NUMERIC DEFAULT 0;

-- Enable RLS
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_events ENABLE ROW LEVEL SECURITY;

-- 5. Strict RLS Policies (Security First)
DROP POLICY IF EXISTS "affiliates_read" ON affiliates;
DROP POLICY IF EXISTS "orders_read" ON orders;
DROP POLICY IF EXISTS "events_read" ON affiliate_events;

-- Allow inserting events publicly (tracking)
CREATE POLICY "events_insert" ON affiliate_events FOR INSERT WITH CHECK (true);
-- Allow creating orders publicly
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);

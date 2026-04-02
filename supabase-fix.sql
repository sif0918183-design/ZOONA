-- =============================================
-- Supabase SQL Fix for Delivery Cities
-- Run this in Supabase SQL Editor to fix RLS policies
-- =============================================

-- 1. Drop existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON products;
DROP POLICY IF EXISTS "Enable update for authenticated" ON products;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON products;

-- 2. Create new policies that allow anonymous access (using anon key)
-- Everyone can read products
CREATE POLICY " products_read" ON products
    FOR SELECT
    USING (true);

-- Everyone can insert (needed for admin operations)
CREATE POLICY "products_insert" ON products
    FOR INSERT
    WITH CHECK (true);

-- Everyone can update
CREATE POLICY "products_update" ON products
    FOR UPDATE
    USING (true);

-- Everyone can delete
CREATE POLICY "products_delete" ON products
    FOR DELETE
    USING (true);

-- 3. Ensure column exists and is JSONB
-- Check if column exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'delivery_cities'
    ) THEN
        ALTER TABLE products ADD COLUMN delivery_cities JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 4. Test insert - run this to verify
-- INSERT INTO products (name, price, delivery_cities) VALUES ('test', 100, '[{"name":"الخرطم","price":0,"type":"cod"}]'::jsonb);

-- 5. Verify data after adding
-- SELECT id, name, delivery_cities FROM products ORDER BY id DESC LIMIT 5;
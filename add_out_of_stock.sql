-- Add is_out_of_stock column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_out_of_stock BOOLEAN DEFAULT false;

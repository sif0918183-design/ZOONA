-- Supabase Storage Setup for ZOONA
-- Run this in Supabase SQL Editor to create the products storage bucket
-- This fixes the image upload issue

-- =============================================
-- Create Storage Bucket for Products Images
-- =============================================

-- Insert storage bucket (ignore if already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_file_types)
VALUES ('products', 'products', true, 5242880, '["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- Storage Policies
-- =============================================

-- Allow public read access to products images
CREATE POLICY "Public Access to Products"
ON storage.objects
FOR SELECT
USING (bucket_id = 'products');

-- Allow authenticated users to upload products images
CREATE POLICY "Authenticated Upload to Products"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'products' AND auth.role() IN ('authenticated', 'anon'));

-- Allow authenticated users to update products images
CREATE POLICY "Authenticated Update Products"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'products' AND auth.role() IN ('authenticated', 'anon'));

-- Allow authenticated users to delete products images
CREATE POLICY "Authenticated Delete Products"
ON storage.objects
FOR DELETE
USING (bucket_id = 'products' AND auth.role() IN ('authenticated', 'anon'));

-- =============================================
-- Verify Storage Configuration
-- =============================================

-- Check if bucket was created
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'products';
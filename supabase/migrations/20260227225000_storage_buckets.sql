-- ShoppingListAI Storage Buckets and Policies
-- Migration: storage_buckets
-- Created: 2026-02-27

-- ============================================================================
-- CREATE STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true);

-- ============================================================================
-- ITEM-IMAGES BUCKET POLICIES
-- Authenticated users can manage their own images under: item-images/{userId}/*
-- ============================================================================

CREATE POLICY "item_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'item-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "item_images_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'item-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "item_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'item-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read access (bucket is public)
CREATE POLICY "item_images_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'item-images');

-- ============================================================================
-- PROFILE-IMAGES BUCKET POLICIES
-- Authenticated users can manage their own profile image under: profile-images/{userId}/*
-- ============================================================================

CREATE POLICY "profile_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'profile-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "profile_images_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'profile-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "profile_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'profile-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read access (bucket is public)
CREATE POLICY "profile_images_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-images');

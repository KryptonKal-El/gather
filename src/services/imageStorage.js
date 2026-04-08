/**
 * Supabase Storage helpers for item images and profile images.
 * Handles uploading files and blobs, returning public URLs.
 */
import { supabase } from './supabase.js';

/**
 * Uploads a File or Blob to Supabase Storage under the user's item images path.
 * @param {string} userId - The authenticated user's ID
 * @param {string} itemId - The item ID
 * @param {File|Blob} file - The image file to upload
 * @returns {Promise<string>} The public URL
 */
export const uploadItemImage = async (userId, itemId, file) => {
  const ext = file.type?.split('/')[1] ?? 'jpg';
  const path = `${userId}/${itemId}.${ext}`;

  const { error } = await supabase.storage
    .from('item-images')
    .upload(path, file, { upsert: true });

  if (error) {
    throw new Error(`Failed to upload item image: itemId=${itemId}`, { cause: error });
  }

  const { data: urlData } = supabase.storage
    .from('item-images')
    .getPublicUrl(path);

  return urlData.publicUrl;
};

/**
 * Deletes an item's image from Supabase Storage.
 * Silently ignores errors if the file doesn't exist.
 * @param {string} userId - The authenticated user's ID
 * @param {string} itemId - The item ID
 * @param {string} imageUrl - The current image URL (unused, kept for API compat)
 */
export const deleteItemImage = async (userId, itemId, imageUrl) => {
  if (!imageUrl) return;
  try {
    const paths = [
      `${userId}/${itemId}.jpg`,
      `${userId}/${itemId}.jpeg`,
      `${userId}/${itemId}.png`,
      `${userId}/${itemId}.webp`,
    ];
    await supabase.storage.from('item-images').remove(paths);
  } catch {
    // File may not exist — ignore
  }
};

/**
 * Resizes an image file to fit within maxDimension, preserving aspect ratio.
 * @param {File|Blob} file - The image file to resize
 * @param {number} [maxDimension=256] - Maximum width or height in pixels
 * @returns {Promise<Blob>} The resized image as a JPEG blob
 */
export const resizeImage = (file, maxDimension = 256) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for resizing'));
    };

    img.src = objectUrl;
  });
};

/**
 * Uploads a profile image to Supabase Storage and updates the profiles table.
 * @param {Object} user - The Supabase auth user object
 * @param {File|Blob} file - The image file to upload
 * @returns {Promise<string>} The public URL
 */
export const uploadProfileImage = async (user, file) => {
  const resizedBlob = await resizeImage(file, 256);
  const path = `${user.id}/profile.jpg`;

  const { error } = await supabase.storage
    .from('profile-images')
    .upload(path, resizedBlob, { upsert: true, contentType: 'image/jpeg' });

  if (error) {
    throw new Error('Failed to upload profile image', { cause: error });
  }

  const { data: urlData } = supabase.storage
    .from('profile-images')
    .getPublicUrl(path);

  const cacheBustedUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: cacheBustedUrl })
    .eq('id', user.id);

  if (updateError) {
    throw new Error('Failed to update profile avatar URL', { cause: updateError });
  }

  return cacheBustedUrl;
};

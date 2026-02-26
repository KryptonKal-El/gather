/**
 * Firebase Storage helpers for item images and profile images.
 * Handles uploading files and blobs, returning download URLs.
 */
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { storage } from './firebase.js';

/**
 * Uploads a File or Blob to Firebase Storage under the user's item images path.
 * @param {string} userId - The authenticated user's UID
 * @param {string} itemId - The Firestore item document ID
 * @param {File|Blob} file - The image file to upload
 * @returns {Promise<string>} The public download URL
 */
export const uploadItemImage = async (userId, itemId, file) => {
  const ext = file.type?.split('/')[1] ?? 'jpg';
  const path = `users/${userId}/items/${itemId}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

/**
 * Deletes an item's image from Firebase Storage.
 * Silently ignores errors if the file doesn't exist.
 * @param {string} userId - The authenticated user's UID
 * @param {string} itemId - The Firestore item document ID
 * @param {string} imageUrl - The current image URL (used to derive the storage path)
 */
export const deleteItemImage = async (userId, itemId, imageUrl) => {
  if (!imageUrl) return;
  try {
    const storageRef = ref(storage, imageUrl);
    await deleteObject(storageRef);
  } catch {
    // File may not exist in storage (e.g., external URL) — ignore
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
 * Uploads a profile image to Firebase Storage and updates the user's photoURL.
 * @param {Object} user - The Firebase auth user object
 * @param {File|Blob} file - The image file to upload
 * @returns {Promise<string>} The public download URL
 */
export const uploadProfileImage = async (user, file) => {
  const resizedBlob = await resizeImage(file, 256);
  const path = `users/${user.uid}/profile.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, resizedBlob);
  const downloadUrl = await getDownloadURL(storageRef);
  await updateProfile(user, { photoURL: downloadUrl });
  return downloadUrl;
};

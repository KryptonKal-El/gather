/**
 * Firebase Storage helpers for item images.
 * Handles uploading files and blobs, returning download URLs.
 */
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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

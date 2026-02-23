/**
 * Firebase app initialization and service exports.
 * Provides the shared app instance, Firestore database, Auth, and Storage.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDlpjSwH0irRXjqvnON5ywtq6UR5AH0ehE',
  authDomain: 'shoppinglistai-3ecd7.firebaseapp.com',
  projectId: 'shoppinglistai-3ecd7',
  storageBucket: 'shoppinglistai-3ecd7.firebasestorage.app',
  messagingSenderId: '439726647460',
  appId: '1:439726647460:web:f8f8949a031331e0da9e31',
  measurementId: 'G-EJE6W4M5MW',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

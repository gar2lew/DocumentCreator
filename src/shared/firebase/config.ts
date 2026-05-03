import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseEnv = [
  ['apiKey', 'VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY],
  ['authDomain', 'VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN],
  ['projectId', 'VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID],
  ['storageBucket', 'VITE_FIREBASE_STORAGE_BUCKET', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET],
  [
    'messagingSenderId',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  ],
  ['appId', 'VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID],
] as const;

function buildFirebaseConfig(): FirebaseOptions {
  const missing = firebaseEnv
    .filter(([, , value]) => !value?.trim())
    .map(([, envKey]) => envKey);

  if (missing.length > 0) {
    const message = `Firebase configuration is missing: ${missing.join(', ')}`;
    console.error(message);
    throw new Error(message);
  }

  return Object.fromEntries(
    firebaseEnv.map(([configKey, , value]) => [configKey, value])
  ) as FirebaseOptions;
}

export const firebaseConfig = buildFirebaseConfig();
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

if (import.meta.env.DEV) {
  console.warn('Firebase is running in development mode.');
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;

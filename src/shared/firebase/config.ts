import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const defaultFirebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyCWeJYHgX1fTSGQecp5tjyhs-VLxPr64C0',
  authDomain: 'documentforge-62916.firebaseapp.com',
  projectId: 'documentforge-62916',
  storageBucket: 'documentforge-62916.firebasestorage.app',
  messagingSenderId: '795070396586',
  appId: '1:795070396586:web:36892f9f4615a1bdeff8d3',
};

const firebaseEnv = [
  ['apiKey', 'VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY, defaultFirebaseConfig.apiKey],
  ['authDomain', 'VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, defaultFirebaseConfig.authDomain],
  ['projectId', 'VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID, defaultFirebaseConfig.projectId],
  ['storageBucket', 'VITE_FIREBASE_STORAGE_BUCKET', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, defaultFirebaseConfig.storageBucket],
  [
    'messagingSenderId',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    defaultFirebaseConfig.messagingSenderId,
  ],
  ['appId', 'VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID, defaultFirebaseConfig.appId],
] as const;

function buildFirebaseConfig(): FirebaseOptions {
  const missing = firebaseEnv
    .filter(([, , value, fallback]) => !(value ?? fallback)?.trim())
    .map(([, envKey]) => envKey);

  if (missing.length > 0) {
    const message = `Firebase configuration is missing: ${missing.join(', ')}`;
    console.error(message);
    throw new Error(message);
  }

  return Object.fromEntries(
    firebaseEnv.map(([configKey, , value, fallback]) => [configKey, value?.trim() || fallback])
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

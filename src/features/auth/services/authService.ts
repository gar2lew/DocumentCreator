import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../../../shared/firebase/config';
import {
  db,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from '../../../shared/firebase/collections';
import { COLLECTIONS } from '../../../shared/firebase/collections';
import type { User } from '../../../shared/types';

function mapUserProfile(firebaseUser: FirebaseUser, data: Record<string, unknown>): User {
  return {
    uid: firebaseUser.uid,
    email: (data.email as string) ?? firebaseUser.email ?? '',
    displayName: (data.displayName as string) ?? firebaseUser.displayName ?? '',
    organisationId: data.organisationId as string,
    role: (data.role as User['role']) ?? 'viewer',
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

export async function registerUser(
  email: string,
  password: string,
  displayName: string,
  organisationName: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });

  const orgRef = await addDoc(collection(db, COLLECTIONS.ORGANISATIONS), {
    name: organisationName,
    createdAt: serverTimestamp(),
  });

  const user: Omit<User, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    uid: credential.user.uid,
    email,
    displayName,
    organisationId: orgRef.id,
    role: 'admin',
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, COLLECTIONS.USERS, credential.user.uid), user);

  return { ...user, createdAt: new Date() };
}

export async function loginUser(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function fetchUserProfile(firebaseUser: FirebaseUser): Promise<User | null> {
  let snap = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
  if (snap.exists()) return mapUserProfile(firebaseUser, snap.data());

  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 500));
    snap = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
    if (snap.exists()) return mapUserProfile(firebaseUser, snap.data());
  }

  return null;
}

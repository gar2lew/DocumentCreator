import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  getIdTokenResult,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
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
import app from '../../../shared/firebase/config';

const functions = getFunctions(app);
const setOrgClaim = httpsCallable(functions, 'setOrgClaim');

function readStringClaim(claims: Record<string, unknown>, key: string): string | null {
  const value = claims[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function readOrganisationClaim(claims: Record<string, unknown>): string | null {
  return readStringClaim(claims, 'organisationId') ?? readStringClaim(claims, 'orgId');
}

function readWritableRole(claims: Record<string, unknown>): User['role'] {
  const role = readStringClaim(claims, 'role');
  return role === 'admin' || role === 'editor' ? role : 'editor';
}

async function setOrgClaimIfAvailable(firebaseUser: FirebaseUser, organisationId: string): Promise<void> {
  try {
    await setOrgClaim({ organisationId });
    await firebaseUser.getIdToken(true);
  } catch (error) {
    console.warn('Could not set organisation claim; using Firestore profile fallback.', error);
  }
}

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

export async function ensureOrgClaim(firebaseUser: FirebaseUser): Promise<void> {
  let claimOrgId: string | null = null;
  let claimError: unknown = null;

  try {
    const currentToken = await getIdTokenResult(firebaseUser, true);
    claimOrgId = readOrganisationClaim(currentToken.claims);
  } catch (error) {
    claimError = error;
    console.warn('Could not read organisation claim; checking Firestore profile fallback.', error);
  }

  if (claimOrgId) return;

  const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
  const storedOrgId = userSnap.exists() ? userSnap.data().organisationId : null;
  if (typeof storedOrgId !== 'string' || !storedOrgId.trim()) {
    if (claimError) {
      throw new Error('Your organisation could not be resolved from claims or profile.');
    }
    throw new Error('Your user profile is missing an organisation.');
  }

  await setOrgClaimIfAvailable(firebaseUser, storedOrgId);
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

  await setOrgClaimIfAvailable(credential.user, orgRef.id);

  return { ...user, createdAt: new Date() };
}

export async function loginUser(email: string, password: string): Promise<void> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await fetchUserProfile(credential.user);
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function fetchUserProfile(firebaseUser: FirebaseUser): Promise<User | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
  if (snap.exists()) return mapUserProfile(firebaseUser, snap.data());

  const token = await getIdTokenResult(firebaseUser, true);
  const organisationId = readOrganisationClaim(token.claims);
  if (!organisationId) return null;

  const user: Omit<User, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? '',
    displayName: firebaseUser.displayName ?? '',
    organisationId,
    role: readWritableRole(token.claims),
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), user, { merge: true });
  return { ...user, createdAt: new Date() };
}

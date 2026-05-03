import { FirebaseError } from 'firebase/app';

export function describeFirebaseError(error: unknown, fallback: string): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      return 'Firebase permission denied. Check your auth custom claims and Firestore or Storage rules.';
    }
    return `${fallback}: ${error.message}`;
  }

  if (error instanceof Error) return `${fallback}: ${error.message}`;
  return fallback;
}

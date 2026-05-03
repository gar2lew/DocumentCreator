import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../shared/firebase/config';
import { useAppStore } from '../../../store';
import { ensureOrgClaim, fetchUserProfile } from '../services/authService';

export function useAuthListener() {
  const { setCurrentUser, setAuthLoading } = useAppStore();

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      try {
        if (firebaseUser) {
          if (active) setCurrentUser(null);
          try {
            // TODO: re-enable once Cloud Function is deployed.
            await ensureOrgClaim(firebaseUser);
          } catch (err) {
            console.warn('Skipping org claim (function unavailable)', err);
          }
          const profile = await fetchUserProfile(firebaseUser);
          if (active) setCurrentUser(profile?.organisationId ? profile : null);
        } else if (active) {
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Auth initialisation failed', error);
        if (active) setCurrentUser(null);
      } finally {
        if (active) setAuthLoading(false);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [setCurrentUser, setAuthLoading]);
}

export function useCurrentUser() {
  return useAppStore((s) => s.currentUser);
}

export function useAuthReady() {
  return useAppStore((s) => !s.authLoading);
}

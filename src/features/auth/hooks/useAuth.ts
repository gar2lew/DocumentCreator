import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../shared/firebase/config';
import { useAppStore } from '../../../store';
import type { User } from '../../../shared/types';
import { ensureOrgClaim, fetchUserProfile } from '../services/authService';

// TEMP: auth gate bypassed for local/demo usage
const DEMO_USER: User = {
  uid: 'demo-user',
  email: 'demo@example.com',
  displayName: 'Demo User',
  organisationId: 'demo-org',
  role: 'admin',
  createdAt: new Date(),
};

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
          // TEMP: auth gate bypassed for local/demo usage
          setCurrentUser(DEMO_USER);
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

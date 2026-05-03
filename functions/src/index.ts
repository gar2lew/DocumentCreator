import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp();

/**
 * Called by the client after registration or login to set organisationId as a custom claim.
 * Custom claims are embedded in the JWT, making security rules fast (no DB read).
 */
export const setOrgClaim = functions.https.onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');

  const { data } = request;
  const requestedOrgId = data?.organisationId;
  if (requestedOrgId !== undefined && typeof requestedOrgId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'organisationId must be a string');
  }

  // Prevent a user from claiming a different org by validating against Firestore.
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');

  const storedOrgId = userDoc.data()?.organisationId;
  if (!storedOrgId || typeof storedOrgId !== 'string') {
    throw new functions.https.HttpsError('failed-precondition', 'User has no organisation');
  }
  if (requestedOrgId !== undefined && storedOrgId !== requestedOrgId) {
    throw new functions.https.HttpsError('permission-denied', 'Org mismatch');
  }

  await admin.auth().setCustomUserClaims(uid, {
    orgId: storedOrgId,
    role: userDoc.data()?.role ?? 'viewer',
  });

  return { success: true };
});

/**
 * Triggered on user deletion to clean up Firestore data.
 */
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
  await admin.firestore().collection('users').doc(user.uid).delete();
});

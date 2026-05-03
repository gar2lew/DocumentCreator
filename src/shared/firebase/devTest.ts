import {
  addDoc,
  collection,
  db,
  doc,
  getDoc,
  serverTimestamp,
} from './collections';
import { COLLECTIONS } from './collections';
import { describeFirebaseError } from './errors';

interface FirebaseDevTestUser {
  uid: string;
  organisationId: string;
}

export async function runFirebaseDevProjectTest(user: FirebaseDevTestUser): Promise<void> {
  if (!import.meta.env.DEV) {
    console.warn('Firebase dev project test is disabled outside development mode.');
    return;
  }

  try {
    const ref = await addDoc(collection(db, COLLECTIONS.PROJECTS), {
      organisationId: user.organisationId,
      name: `Firebase connectivity test ${new Date().toISOString()}`,
      acn: '000 000 000',
      bankDetails: {
        bankName: 'Test Bank',
        accountName: 'Connectivity Test',
        bsb: '000-000',
        accountNumber: '000000',
      },
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const snap = await getDoc(doc(db, COLLECTIONS.PROJECTS, ref.id));
    console.log('Firebase dev project test result', {
      id: ref.id,
      exists: snap.exists(),
      data: snap.exists() ? snap.data() : null,
    });
  } catch (error) {
    console.error(describeFirebaseError(error, 'Firebase dev project test failed'));
  }
}

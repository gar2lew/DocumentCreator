import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  db,
} from '../../../shared/firebase/collections';
import { COLLECTIONS } from '../../../shared/firebase/collections';
import type { Project } from '../../../shared/types';
import { useAppStore } from '../../../store';

function mapProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    organisationId: data.organisationId as string,
    name: data.name as string,
    acn: data.acn as string,
    bankDetails: data.bankDetails as Project['bankDetails'],
    createdBy: data.createdBy as string,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

export async function getProjects(organisationId: string): Promise<Project[]> {
  const q = query(
    collection(db, COLLECTIONS.PROJECTS),
    where('organisationId', '==', organisationId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapProject(d.id, d.data()));
}

export async function getProject(id: string): Promise<Project | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.PROJECTS, id));
  if (!snap.exists()) return null;
  return mapProject(snap.id, snap.data());
}

export async function createProject(
  data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Project> {
  const currentUser = useAppStore.getState().currentUser;
  if (!currentUser?.organisationId) {
    throw new Error('Cannot create project without an organisation.');
  }

  const projectData = {
    organisationId: currentUser.organisationId,
    name: data.name,
    acn: data.acn,
    bankDetails: data.bankDetails,
    createdBy: currentUser.uid,
  };

  const ref = await addDoc(collection(db, COLLECTIONS.PROJECTS), {
    ...projectData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { ...projectData, id: ref.id, createdAt: new Date(), updatedAt: new Date() };
}

export async function updateProject(
  id: string,
  data: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.PROJECTS, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.PROJECTS, id));
}

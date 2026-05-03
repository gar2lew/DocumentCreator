import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  db,
} from '../../../shared/firebase/collections';
import { COLLECTIONS } from '../../../shared/firebase/collections';
import type { DocumentGenerated } from '../../../shared/types';

function mapDoc(id: string, data: Record<string, unknown>): DocumentGenerated {
  return {
    id,
    organisationId: data.organisationId as string,
    templateId: data.templateId as string,
    templateName: data.templateName as string,
    projectId: data.projectId as string,
    projectName: data.projectName as string,
    format: data.format as 'pdf' | 'docx',
    storagePath: data.storagePath as string,
    downloadUrl: data.downloadUrl as string,
    generatedBy: data.generatedBy as string,
    generatedAt: (data.generatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    placeholderData: (data.placeholderData as Record<string, string>) ?? {},
    templateContent: data.templateContent as string | undefined,
  };
}

export async function saveGeneratedDocument(
  data: Omit<DocumentGenerated, 'id' | 'generatedAt'>
): Promise<DocumentGenerated> {
  const ref = await addDoc(collection(db, COLLECTIONS.DOCUMENTS_GENERATED), {
    ...data,
    generatedAt: serverTimestamp(),
  });
  return { ...data, id: ref.id, generatedAt: new Date() };
}

export async function getGeneratedDocuments(organisationId: string): Promise<DocumentGenerated[]> {
  if (!organisationId) return [];

  const q = query(
    collection(db, COLLECTIONS.DOCUMENTS_GENERATED),
    where('organisationId', '==', organisationId),
    orderBy('generatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc(d.id, d.data()));
}

export async function getLastGeneratedDocument(
  organisationId: string,
  templateId: string,
  projectId: string
): Promise<DocumentGenerated | null> {
  if (!organisationId) return null;

  const q = query(
    collection(db, COLLECTIONS.DOCUMENTS_GENERATED),
    where('organisationId', '==', organisationId),
    where('templateId', '==', templateId),
    where('projectId', '==', projectId),
    orderBy('generatedAt', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  const docSnap = snap.docs[0];
  return docSnap ? mapDoc(docSnap.id, docSnap.data()) : null;
}

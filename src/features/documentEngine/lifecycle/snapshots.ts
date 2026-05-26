import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  db,
} from '../../../shared/firebase/collections';
import { COLLECTIONS } from '../../../shared/firebase/collections';
import type { RenderSnapshot } from './types';

function mapSnapshot(id: string, data: Record<string, unknown>): RenderSnapshot {
  return {
    id,
    organisationId: data.organisationId as string,
    documentId: data.documentId as string,
    snapshotVersion: (data.snapshotVersion as number) ?? 1,
    renderedContent: (data.renderedContent as string) ?? '',
    schemaVersion: (data.schemaVersion as number) ?? 1,
    transactionVersion: (data.transactionVersion as number) ?? 1,
    sectionIds: (data.sectionIds as string[]) ?? [],
    provenanceSummary: (data.provenanceSummary as string) ?? '',
    generatedBy: data.generatedBy as string,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

export async function createSnapshot(
  data: Omit<RenderSnapshot, 'id' | 'createdAt'>
): Promise<RenderSnapshot> {
  const ref = await addDoc(collection(db, COLLECTIONS.SNAPSHOTS), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return {
    ...data,
    id: ref.id,
    createdAt: new Date(),
  };
}

export async function getSnapshot(id: string): Promise<RenderSnapshot | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.SNAPSHOTS, id));
  if (!snap.exists()) return null;
  return mapSnapshot(snap.id, snap.data());
}

export async function getSnapshotsForDocument(documentId: string): Promise<RenderSnapshot[]> {
  const q = query(
    collection(db, COLLECTIONS.SNAPSHOTS),
    where('documentId', '==', documentId),
    orderBy('snapshotVersion', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapSnapshot(d.id, d.data()));
}

export async function getLatestSnapshot(documentId: string): Promise<RenderSnapshot | null> {
  const q = query(
    collection(db, COLLECTIONS.SNAPSHOTS),
    where('documentId', '==', documentId),
    orderBy('snapshotVersion', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return mapSnapshot(snap.docs[0].id, snap.docs[0].data());
}

export function verifySnapshotIntegrity(snapshot: RenderSnapshot): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!snapshot.renderedContent) {
    warnings.push('Snapshot has no rendered content');
  }
  if (!snapshot.generatedBy) {
    warnings.push('Snapshot has no generator identity');
  }
  if (snapshot.snapshotVersion < 1) {
    warnings.push('Snapshot has invalid version');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

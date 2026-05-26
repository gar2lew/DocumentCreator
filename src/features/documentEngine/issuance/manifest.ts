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
import type { IssuanceManifest, IssuanceRecord } from './types';

function mapManifest(id: string, data: Record<string, unknown>): IssuanceManifest {
  return {
    id,
    issuanceId: data.issuanceId as string,
    packageId: data.packageId as string,
    documentIds: (data.documentIds as string[]) ?? [],
    snapshotIds: (data.snapshotIds as string[]) ?? [],
    recipientMappings: (data.recipientMappings as Record<string, string>) ?? {},
    packageSnapshotVersions: (data.packageSnapshotVersions as Record<string, number>) ?? {},
    issuanceMetadata: (data.issuanceMetadata as Record<string, string>) ?? {},
    createdBy: data.createdBy as string,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

export async function createIssuanceManifest(
  record: IssuanceRecord,
  recipientMappings: Record<string, string>,
  packageSnapshotVersions: Record<string, number>,
  issuanceMetadata: Record<string, string>
): Promise<IssuanceManifest> {
  const manifest: Omit<IssuanceManifest, 'id' | 'createdAt'> = {
    issuanceId: record.id,
    packageId: record.packageId,
    documentIds: [],
    snapshotIds: [...record.issuedSnapshots],
    recipientMappings,
    packageSnapshotVersions,
    issuanceMetadata,
    createdBy: record.issuedBy,
  };

  const ref = await addDoc(collection(db, COLLECTIONS.ISSUANCE_MANIFESTS), {
    ...manifest,
    createdAt: serverTimestamp(),
  });

  return {
    ...manifest,
    id: ref.id,
    createdAt: new Date(),
  };
}

export async function getIssuanceManifest(id: string): Promise<IssuanceManifest | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.ISSUANCE_MANIFESTS, id));
  if (!snap.exists()) return null;
  return mapManifest(snap.id, snap.data());
}

export async function getManifestsForIssuance(issuanceId: string): Promise<IssuanceManifest[]> {
  const q = query(
    collection(db, COLLECTIONS.ISSUANCE_MANIFESTS),
    where('issuanceId', '==', issuanceId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapManifest(d.id, d.data()));
}

export async function getLatestIssuanceManifest(issuanceId: string): Promise<IssuanceManifest | null> {
  const q = query(
    collection(db, COLLECTIONS.ISSUANCE_MANIFESTS),
    where('issuanceId', '==', issuanceId),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return mapManifest(snap.docs[0].id, snap.docs[0].data());
}

export function verifyIssuanceManifestIntegrity(manifest: IssuanceManifest): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (manifest.snapshotIds.length === 0) {
    warnings.push('Issuance manifest references no snapshots');
  }
  if (!manifest.createdBy) {
    warnings.push('Issuance manifest has no creator identity');
  }
  if (Object.keys(manifest.recipientMappings).length === 0) {
    warnings.push('Issuance manifest has no recipient mappings');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

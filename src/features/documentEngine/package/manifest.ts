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
import type { PackageManifest, TransactionPackage } from './types';

function mapManifest(id: string, data: Record<string, unknown>): PackageManifest {
  return {
    id,
    packageId: data.packageId as string,
    version: (data.version as number) ?? 1,
    documentIds: (data.documentIds as string[]) ?? [],
    snapshotIds: (data.snapshotIds as string[]) ?? [],
    schemaVersions: (data.schemaVersions as Record<string, number>) ?? {},
    compositionSummaries: (data.compositionSummaries as Record<string, string>) ?? {},
    transactionMetadata: (data.transactionMetadata as Record<string, string>) ?? {},
    createdBy: data.createdBy as string,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

export async function createManifest(
  pkg: TransactionPackage,
  schemaVersions: Record<string, number>,
  compositionSummaries: Record<string, string>,
  transactionMetadata: Record<string, string>
): Promise<PackageManifest> {
  const manifest: Omit<PackageManifest, 'id' | 'createdAt'> = {
    packageId: pkg.id,
    version: pkg.manifestVersion,
    documentIds: [...pkg.documentIds],
    snapshotIds: [...pkg.snapshotIds],
    schemaVersions,
    compositionSummaries,
    transactionMetadata,
    createdBy: pkg.createdBy,
  };

  const ref = await addDoc(collection(db, COLLECTIONS.MANIFESTS), {
    ...manifest,
    createdAt: serverTimestamp(),
  });

  return {
    ...manifest,
    id: ref.id,
    createdAt: new Date(),
  };
}

export async function getManifest(id: string): Promise<PackageManifest | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.MANIFESTS, id));
  if (!snap.exists()) return null;
  return mapManifest(snap.id, snap.data());
}

export async function getManifestsForPackage(packageId: string): Promise<PackageManifest[]> {
  const q = query(
    collection(db, COLLECTIONS.MANIFESTS),
    where('packageId', '==', packageId),
    orderBy('version', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapManifest(d.id, d.data()));
}

export async function getLatestManifest(packageId: string): Promise<PackageManifest | null> {
  const q = query(
    collection(db, COLLECTIONS.MANIFESTS),
    where('packageId', '==', packageId),
    orderBy('version', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return mapManifest(snap.docs[0].id, snap.docs[0].data());
}

export function verifyManifestIntegrity(manifest: PackageManifest): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (manifest.documentIds.length === 0) {
    warnings.push('Manifest references no documents');
  }
  if (manifest.snapshotIds.length === 0) {
    warnings.push('Manifest references no snapshots');
  }
  if (manifest.version < 1) {
    warnings.push('Manifest has invalid version');
  }
  if (!manifest.createdBy) {
    warnings.push('Manifest has no creator identity');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

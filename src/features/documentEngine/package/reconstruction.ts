import type { TransactionPackage, PackageManifest } from './types';
import { verifyManifestIntegrity } from './manifest';

export interface ReconstructionResult {
  success: boolean;
  rebuiltDocumentIds: string[];
  rebuiltSnapshotIds: string[];
  manifestRestored: boolean;
  lineageRestored: boolean;
  warnings: string[];
}

export function rebuildPackageFromManifest(
  manifest: PackageManifest
): Omit<TransactionPackage, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    organisationId: '',
    transactionId: '',
    lifecycleState: 'draft',
    documentIds: [...manifest.documentIds],
    snapshotIds: [...manifest.snapshotIds],
    manifestVersion: manifest.version,
    createdBy: manifest.createdBy,
  };
}

export function recoverSnapshots(
  manifest: PackageManifest,
  availableSnapshotIds: string[]
): { recovered: string[]; missing: string[] } {
  const recovered: string[] = [];
  const missing: string[] = [];

  for (const snapshotId of manifest.snapshotIds) {
    if (availableSnapshotIds.includes(snapshotId)) {
      recovered.push(snapshotId);
    } else {
      missing.push(snapshotId);
    }
  }

  return { recovered, missing };
}

export function restoreLineage(
  currentPackage: TransactionPackage,
  allPackages: { id: string; lifecycleState: string; manifestVersion?: number; createdAt: Date }[]
): { ancestors: { packageId: string; manifestVersion?: number }[] } {
  const ancestors: { packageId: string; manifestVersion?: number }[] = [];

  for (const pkg of allPackages) {
    if (pkg.id === currentPackage.id) continue;
    if (pkg.lifecycleState === 'superseded' || pkg.lifecycleState === 'archived') {
      ancestors.push({
        packageId: pkg.id,
        manifestVersion: pkg.manifestVersion,
      });
    }
  }

  return { ancestors };
}

export function verifyReconstruction(
  original: TransactionPackage,
  manifest: PackageManifest | null
): ReconstructionResult {
  const warnings: string[] = [];
  let manifestRestored = false;
  let lineageRestored = true;

  if (!manifest) {
    warnings.push('No manifest available for verification');
  } else {
    const integrity = verifyManifestIntegrity(manifest);
    manifestRestored = integrity.valid;
    warnings.push(...integrity.warnings);

    if (manifest.documentIds.length !== original.documentIds.length) {
      warnings.push('Document count mismatch between package and manifest');
    }
  }

  return {
    success: warnings.length === 0,
    rebuiltDocumentIds: manifest ? [...manifest.documentIds] : [],
    rebuiltSnapshotIds: manifest ? [...manifest.snapshotIds] : [],
    manifestRestored,
    lineageRestored,
    warnings,
  };
}

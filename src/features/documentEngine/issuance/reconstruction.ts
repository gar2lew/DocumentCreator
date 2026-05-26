import type { IssuanceManifest } from './types';
import { verifyIssuanceManifestIntegrity } from './manifest';

export interface IssuanceReconstructionResult {
  success: boolean;
  rebuiltSnapshotIds: string[];
  manifestRestored: boolean;
  recipientLineageRestored: boolean;
  warnings: string[];
}

export function rebuildIssuanceFromManifest(
  manifest: IssuanceManifest
): { packageId: string; recipientIds: string[]; manifestId: string; issuedSnapshots: string[]; issuanceState: string; issuedBy: string } {
  return {
    packageId: manifest.packageId,
    recipientIds: Object.keys(manifest.recipientMappings),
    manifestId: manifest.id,
    issuedSnapshots: [...manifest.snapshotIds],
    issuanceState: 'issued',
    issuedBy: manifest.createdBy,
  };
}

export function recoverIssuanceSnapshots(
  manifest: IssuanceManifest,
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

export function recoverRecipientLineage(
  issuanceIds: string[],
  allManifests: IssuanceManifest[]
): { manifest: IssuanceManifest; recovered: boolean }[] {
  return issuanceIds.map((issuanceId) => {
    const manifest = allManifests.find((m) => m.issuanceId === issuanceId);
    return {
      manifest: manifest ?? {
        id: '',
        issuanceId,
        packageId: '',
        documentIds: [],
        snapshotIds: [],
        recipientMappings: {},
        packageSnapshotVersions: {},
        issuanceMetadata: {},
        createdBy: '',
        createdAt: new Date(0),
      },
      recovered: manifest !== null,
    };
  });
}

export function verifyIssuanceReconstruction(
  manifest: IssuanceManifest | null
): IssuanceReconstructionResult {
  const warnings: string[] = [];
  let manifestRestored = false;

  if (!manifest) {
    warnings.push('No issuance manifest available for verification');
  } else {
    const integrity = verifyIssuanceManifestIntegrity(manifest);
    manifestRestored = integrity.valid;
    warnings.push(...integrity.warnings);
  }

  const rebuiltSnapshotIds = manifest ? [...manifest.snapshotIds] : [];

  return {
    success: warnings.length === 0,
    rebuiltSnapshotIds,
    manifestRestored,
    recipientLineageRestored: manifestRestored,
    warnings,
  };
}

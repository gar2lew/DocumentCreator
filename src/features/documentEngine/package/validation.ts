import type { TransactionPackage, PackageManifest } from './types';
import type { PackageLifecycleState } from './types';

export interface PackageValidationWarning {
  type: 'missing_snapshot' | 'invalid_lineage' | 'unresolved_dependency' | 'superseded_output' | 'inconsistent_transaction_ref';
  message: string;
}

export interface PackageValidationResult {
  packageId: string;
  lifecycleState: PackageLifecycleState;
  warnings: PackageValidationWarning[];
  hasSnapshotCoverage: boolean;
  hasManifest: boolean;
  lineageComplete: boolean;
}

export function validatePackageIntegrity(
  pkg: TransactionPackage,
  allDocumentSnapshotIds: string[],
  latestManifest: PackageManifest | null
): PackageValidationResult {
  const warnings: PackageValidationWarning[] = [];

  // Snapshot coverage
  const hasSnapshotCoverage = pkg.snapshotIds.length > 0;
  if (!hasSnapshotCoverage && pkg.lifecycleState !== 'draft') {
    warnings.push({
      type: 'missing_snapshot',
      message: `Package is ${pkg.lifecycleState} but has no snapshot references`,
    });
  }

  // Check each document has a snapshot
  for (const docId of pkg.documentIds) {
    const hasSnapshot = allDocumentSnapshotIds.some((sid) => sid === docId);
    if (!hasSnapshot && pkg.lifecycleState !== 'draft') {
      warnings.push({
        type: 'missing_snapshot',
        message: `Document ${docId} has no associated snapshot`,
      });
    }
  }

  // Manifest presence
  const hasManifest = latestManifest !== null;
  if (!hasManifest && pkg.lifecycleState === 'finalised') {
    warnings.push({
      type: 'inconsistent_transaction_ref',
      message: 'Package is finalised but has no manifest',
    });
  }

  // Manifest integrity
  if (latestManifest) {
    if (latestManifest.version !== pkg.manifestVersion) {
      warnings.push({
        type: 'inconsistent_transaction_ref',
        message: `Manifest version ${latestManifest.version} does not match package version ${pkg.manifestVersion}`,
      });
    }

    const missingDocs = pkg.documentIds.filter((d) => !latestManifest.documentIds.includes(d));
    if (missingDocs.length > 0) {
      warnings.push({
        type: 'unresolved_dependency',
        message: `Documents missing from manifest: ${missingDocs.join(', ')}`,
      });
    }
  }

  // Lineage completeness
  let lineageComplete = true;
  if (pkg.lifecycleState === 'superseded') {
    lineageComplete = pkg.snapshotIds.length > 0;
    if (!lineageComplete) {
      warnings.push({
        type: 'invalid_lineage',
        message: 'Superseded package has no snapshot references for lineage restoration',
      });
    }
  }

  return {
    packageId: pkg.id,
    lifecycleState: pkg.lifecycleState,
    warnings,
    hasSnapshotCoverage,
    hasManifest,
    lineageComplete,
  };
}

export function summarisePackageValidation(result: PackageValidationResult): string {
  if (result.warnings.length === 0) return `Package ${result.packageId}: ${result.lifecycleState} — no warnings`;
  return `Package ${result.packageId}: ${result.lifecycleState} — ${result.warnings.length} warning(s)`;
}

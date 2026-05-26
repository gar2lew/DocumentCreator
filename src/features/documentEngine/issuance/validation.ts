import type { IssuanceRecord, IssuanceManifest, IssuanceState } from './types';

export interface IssuanceValidationWarning {
  type: 'missing_snapshot' | 'invalid_recipient' | 'unresolved_issuance_ref' | 'superseded_output' | 'package_inconsistency';
  message: string;
}

export interface IssuanceValidationResult {
  issuanceId: string;
  state: IssuanceState;
  warnings: IssuanceValidationWarning[];
  hasSnapshotCoverage: boolean;
  hasManifest: boolean;
  hasValidRecipients: boolean;
}

export function validateExternalization(
  record: IssuanceRecord,
  manifest: IssuanceManifest | null,
  recipientCount: number
): IssuanceValidationResult {
  const warnings: IssuanceValidationWarning[] = [];

  const hasSnapshotCoverage = record.issuedSnapshots.length > 0;
  if (!hasSnapshotCoverage) {
    warnings.push({
      type: 'missing_snapshot',
      message: `Issuance ${record.id} has no snapshots`,
    });
  }

  const hasManifest = manifest !== null;
  if (!hasManifest && record.issuanceState === 'issued') {
    warnings.push({
      type: 'unresolved_issuance_ref',
      message: 'Issuance is in issued state but has no manifest',
    });
  }

  if (manifest) {
    const missingSnapshots = record.issuedSnapshots.filter(
      (s) => !manifest.snapshotIds.includes(s)
    );
    if (missingSnapshots.length > 0) {
      warnings.push({
        type: 'package_inconsistency',
        message: `Snapshots missing from manifest: ${missingSnapshots.join(', ')}`,
      });
    }
  }

  const hasValidRecipients = record.recipientIds.length > 0 && recipientCount > 0;
  if (!hasValidRecipients && record.issuanceState !== 'pending') {
    warnings.push({
      type: 'invalid_recipient',
      message: 'Issuance has no valid recipients',
    });
  }

  if (record.issuanceState === 'revoked' && manifest) {
    warnings.push({
      type: 'superseded_output',
      message: 'Issuance is revoked but manifest still exists',
    });
  }

  return {
    issuanceId: record.id,
    state: record.issuanceState,
    warnings,
    hasSnapshotCoverage,
    hasManifest,
    hasValidRecipients,
  };
}

export function summariseIssuanceValidation(result: IssuanceValidationResult): string {
  if (result.warnings.length === 0) return `Issuance ${result.issuanceId}: ${result.state} — no warnings`;
  return `Issuance ${result.issuanceId}: ${result.state} — ${result.warnings.length} warning(s)`;
}

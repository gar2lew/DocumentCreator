import type { DocumentLifecycleState, RenderSnapshot, LifecycleMetadata } from './types';
import { verifySnapshotIntegrity } from './snapshots';

export interface LifecycleDiagnosticWarning {
  type: 'missing_snapshot' | 'stale_snapshot' | 'missing_metadata' | 'invalid_state_transition' | 'lineage_gap';
  message: string;
}

export interface LifecycleDiagnosticsResult {
  state: DocumentLifecycleState;
  warnings: LifecycleDiagnosticWarning[];
  hasSnapshot: boolean;
  snapshotIntegrity: boolean;
  lineageComplete: boolean;
}

export function diagnoseLifecycle(
  metadata: Partial<LifecycleMetadata>,
  latestSnapshot: RenderSnapshot | null
): LifecycleDiagnosticsResult {
  const warnings: LifecycleDiagnosticWarning[] = [];

  // Snapshot presence
  const hasSnapshot = latestSnapshot !== null;
  if (!hasSnapshot && metadata.lifecycleState !== 'draft') {
    warnings.push({
      type: 'missing_snapshot',
      message: `Document is ${metadata.lifecycleState} but has no render snapshot`,
    });
  }

  // Snapshot integrity
  let snapshotIntegrity = false;
  if (latestSnapshot) {
    const integrity = verifySnapshotIntegrity(latestSnapshot);
    snapshotIntegrity = integrity.valid;
    if (!integrity.valid) {
      warnings.push({
        type: 'stale_snapshot',
        message: `Snapshot integrity check failed: ${integrity.warnings.join('; ')}`,
      });
    }
  }

  // Missing metadata
  if (!metadata.generatedBy && (metadata.lifecycleState === 'generated' || metadata.lifecycleState === 'issued')) {
    warnings.push({
      type: 'missing_metadata',
      message: 'Document is generated/issued but has no generator identity',
    });
  }

  if (!metadata.issuedAt && metadata.lifecycleState === 'issued') {
    warnings.push({
      type: 'missing_metadata',
      message: 'Document is issued but has no issuance timestamp',
    });
  }

  // Lineage
  const lineageComplete = metadata.lifecycleState !== 'superseded' || metadata.lastSnapshotId !== undefined;

  return {
    state: metadata.lifecycleState ?? 'draft',
    warnings,
    hasSnapshot,
    snapshotIntegrity,
    lineageComplete,
  };
}

export function summariseLifecycleDiagnostics(result: LifecycleDiagnosticsResult): string {
  if (result.warnings.length === 0) return `State: ${result.state} — no warnings`;
  return `State: ${result.state} — ${result.warnings.length} warning(s)`;
}

/**
 * SYNCHRONIZATION MODULE
 *
 * Public API for content↔node synchronization, drift detection,
 * and semantic recovery.
 *
 * This module governs the relationship between legacy content
 * strings and structured node trees during the canonical
 * semantic persistence promotion phase.
 */

export {
  detectSyncState,
  computeSyncDiagnostics,
  synchronizeContentToNodes,
  synchronizeNodesToContent,
  verifyRoundtrip,
} from './synchronization';
export type { SyncState, SyncResult, SyncDiagnostics } from './synchronization';

export {
  detectSemanticDrift,
} from './driftDetection';
export type { DriftReport, DriftCheck, DriftSeverity } from './driftDetection';

export {
  regenerateNodesFromContent,
  regenerateContentFromNodes,
  repairSynchronization,
  restoreParityFromContent,
} from './recovery';
export type { RecoveryResult, RecoveryAction, RecoveryDiagnostics } from './recovery';

export type {
  DocumentLifecycleState,
  RenderSnapshot,
  LifecycleMetadata,
  DocumentLineage,
  DocumentLineageEntry,
} from './types';

export {
  createSnapshot,
  getSnapshot,
  getSnapshotsForDocument,
  getLatestSnapshot,
  verifySnapshotIntegrity,
} from './snapshots';

export {
  resolveLineage,
  getSupersessionChain,
} from './lineage';

export {
  diagnoseLifecycle,
  summariseLifecycleDiagnostics,
} from './validation';
export type { LifecycleDiagnosticsResult, LifecycleDiagnosticWarning } from './validation';

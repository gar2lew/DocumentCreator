export type DocumentLifecycleState = 'draft' | 'generated' | 'issued' | 'executed' | 'superseded' | 'archived';

export interface RenderSnapshot {
  id: string;
  organisationId: string;
  documentId: string;
  snapshotVersion: number;
  renderedContent: string;
  schemaVersion: number;
  transactionVersion: number;
  sectionIds: string[];
  provenanceSummary: string;
  generatedBy: string;
  createdAt: Date;
}

export interface LifecycleMetadata {
  lifecycleState: DocumentLifecycleState;
  issuedAt?: string;
  executedAt?: string;
  generatedBy?: string;
  transactionVersion?: number;
  snapshotVersion?: number;
  lastSnapshotId?: string;
}

export interface DocumentLineageEntry {
  documentId: string;
  lifecycleState: DocumentLifecycleState;
  snapshotVersion?: number;
  createdAt: Date;
}

export interface DocumentLineage {
  current: DocumentLineageEntry;
  ancestors: DocumentLineageEntry[];
  supersededBy?: DocumentLineageEntry;
  generatedFrom?: DocumentLineageEntry;
}

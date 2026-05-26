export type PackageLifecycleState = 'draft' | 'assembled' | 'finalised' | 'superseded' | 'archived';

export type ExecutionSetType = 'signing_pack' | 'settlement_pack' | 'guarantor_execution' | 'disclosure_bundle';

export interface TransactionPackage {
  id: string;
  organisationId: string;
  transactionId: string;
  lifecycleState: PackageLifecycleState;
  documentIds: string[];
  snapshotIds: string[];
  manifestVersion: number;
  executionSetType?: ExecutionSetType;
  label?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PackageManifest {
  id: string;
  packageId: string;
  version: number;
  documentIds: string[];
  snapshotIds: string[];
  schemaVersions: Record<string, number>;
  compositionSummaries: Record<string, string>;
  transactionMetadata: Record<string, string>;
  createdBy: string;
  createdAt: Date;
}

export interface ExecutionSet {
  type: ExecutionSetType;
  label: string;
  description: string;
  requiredDocumentTypes: string[];
  optionalDocumentTypes: string[];
}

export interface PackageLineageEntry {
  packageId: string;
  lifecycleState: PackageLifecycleState;
  manifestVersion?: number;
  createdAt: Date;
}

export interface PackageLineage {
  current: PackageLineageEntry;
  ancestors: PackageLineageEntry[];
}

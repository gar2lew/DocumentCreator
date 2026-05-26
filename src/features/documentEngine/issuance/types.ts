export type IssuanceState = 'pending' | 'issued' | 'delivered' | 'failed' | 'revoked';

export type RecipientRole = 'signatory' | 'guarantor' | 'counterparty' | 'regulator' | 'legal_representative';

export interface Recipient {
  id: string;
  organisationId: string;
  name: string;
  email: string;
  role: RecipientRole;
  packageIds: string[];
  issuanceIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IssuanceRecord {
  id: string;
  organisationId: string;
  packageId: string;
  recipientIds: string[];
  manifestId: string;
  issuedSnapshots: string[];
  issuanceState: IssuanceState;
  issuedBy: string;
  issuedAt: Date;
  updatedAt: Date;
}

export interface IssuanceManifest {
  id: string;
  issuanceId: string;
  packageId: string;
  documentIds: string[];
  snapshotIds: string[];
  recipientMappings: Record<string, string>;
  packageSnapshotVersions: Record<string, number>;
  issuanceMetadata: Record<string, string>;
  createdBy: string;
  createdAt: Date;
}

export interface IssuanceLineageEntry {
  issuanceId: string;
  issuanceState: IssuanceState;
  packageId: string;
  issuedAt: Date;
}

export type RecipientResolutionStrategy = 'by_role' | 'by_id' | 'by_package';

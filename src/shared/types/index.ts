export interface User {
  uid: string;
  email: string;
  displayName: string;
  organisationId: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: Date;
}

export interface Organisation {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Project {
  id: string;
  organisationId: string;
  name: string;
  acn: string;
  bankDetails: {
    bankName: string;
    accountName: string;
    bsb: string;
    accountNumber: string;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TemplateType = 'text' | 'docx' | 'pdf';
export type TemplateKind = 'deed' | 'loan_agreement';
export type TemplateLifecycleState = 'draft' | 'review' | 'approved' | 'deprecated' | 'archived';
export type TemplateCanonicalityState = 'legacy' | 'hybrid' | 'semantic-canonical';

export interface PdfFieldDefinition {
  id: string;
  name: string;
  type: 'text' | 'date' | 'number' | 'signature';
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  fontSize: number;
  fontFamily: string;
  alignment: 'left' | 'center' | 'right';
  placeholder: string;
}

export interface PlaceholderStyle {
  fontFamily?: string;
  fontSize?: number;
  alignment?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface TemplateStyles {
  [placeholderKey: string]: PlaceholderStyle;
}

export interface Template {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  type: TemplateType;
  templateKind?: TemplateKind | null;
  content: string;
  fileUrl?: string;
  placeholders?: string[];
  pdfStoragePath?: string;
  fields: PdfFieldDefinition[];
  styles?: TemplateStyles;
  nodes?: string; // serialized DocumentRoot — actively synchronized, content is still canonical
  schemaVersion?: number; // identifies the document engine schema version (currently 1)
  sectionIds?: string[]; // IDs of governed reusable sections composed into this template
  dealId?: string; // associated deal for transaction-driven composition
  transactionType?: TransactionType; // explicit transaction type override
  locked: boolean;
  lifecycleState?: TemplateLifecycleState;
  canonicalityState?: TemplateCanonicalityState;
  lastSyncAt?: string; // ISO timestamp of last content↔node synchronization
  createdFrom?: string; // template ID this was derived from (lineage tracking)
  currentVersion: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVersion {
  id: string;
  organisationId: string;
  templateId: string;
  version: number;
  content: string;
  fileUrl?: string;
  placeholders?: string[];
  fields: PdfFieldDefinition[];
  savedBy: string;
  savedAt: Date;
  comment?: string;
}

export type DocumentLifecycleState = 'draft' | 'generated' | 'issued' | 'executed' | 'superseded' | 'archived';
export type PackageLifecycleState = 'draft' | 'assembled' | 'finalised' | 'superseded' | 'archived';
export type ExecutionSetType = 'signing_pack' | 'settlement_pack' | 'guarantor_execution' | 'disclosure_bundle';
export type IssuanceState = 'pending' | 'issued' | 'delivered' | 'failed' | 'revoked';
export type RecipientRole = 'signatory' | 'guarantor' | 'counterparty' | 'regulator' | 'legal_representative';

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

export interface DocumentGenerated {
  id: string;
  organisationId: string;
  templateId: string;
  templateName: string;
  projectId: string;
  projectName: string;
  format: 'pdf' | 'docx';
  storagePath: string;
  downloadUrl: string;
  generatedBy: string;
  generatedAt: Date;
  placeholderData: Record<string, string>;
  templateContent?: string;
  lifecycleState?: DocumentLifecycleState;
  snapshotId?: string;
  supersedes?: string;
  generatedFromId?: string;
}

export type TransactionType = 'secured_loan' | 'unsecured_loan' | 'settlement_deed' | 'guarantor_loan' | 'staged_repayment';

export interface TransactionVariants {
  rateType?: 'fixed' | 'variable';
  repaymentType?: 'principal_interest' | 'interest_only' | 'balloon';
  securityType?: 'mortgage' | 'charge' | 'guarantee' | 'none';
}

export interface DealFinancials {
  loanAmount?: number;
  interestRate?: number;
  defaultInterestRate?: number;
  loanTermYears?: number;
  repaymentAmount?: number;
  considerationAmount?: number;
}

export interface DealDates {
  drawdownDate?: string;
  maturityDate?: string;
  settlementDate?: string;
  agreementDate?: string;
}

export interface DealParticipant {
  role: string;
  name: string;
  entityType: 'individual' | 'company';
}

export interface DealOverride {
  sectionType: string;
  action: 'include' | 'exclude';
}

export interface Deal {
  id: string;
  organisationId: string;
  transactionType: TransactionType;
  projectId: string;
  name: string;
  participants: DealParticipant[];
  financials: DealFinancials;
  dates: DealDates;
  variants: TransactionVariants;
  overrides: DealOverride[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaceholderData {
  [key: string]: string;
}

export type SectionType = 'guarantor' | 'repayment' | 'settlement' | 'execution' | 'jurisdiction';
export type SectionLifecycleState = 'active' | 'deprecated' | 'sunset';

export interface SectionMetadata {
  label: string;
  description: string;
  category: string;
  templateKinds?: ('deed' | 'loan_agreement')[];
  lifecycleState: SectionLifecycleState;
  deprecationNotice?: string;
  tags: string[];
  compatibleSchemaVersions: number[];
}

export interface Section {
  id: string;
  organisationId: string;
  type: SectionType;
  schemaVersion: number;
  nodes: string;
  metadata: SectionMetadata;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

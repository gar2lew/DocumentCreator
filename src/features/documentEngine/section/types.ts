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

export interface SectionDefinition {
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

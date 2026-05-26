export type TransactionType = 'secured_loan' | 'unsecured_loan' | 'settlement_deed' | 'guarantor_loan' | 'staged_repayment';

export type RateVariant = 'fixed' | 'variable';
export type RepaymentVariant = 'principal_interest' | 'interest_only' | 'balloon';
export type SecurityVariant = 'mortgage' | 'charge' | 'guarantee' | 'none';

export interface TransactionVariants {
  rateType?: RateVariant;
  repaymentType?: RepaymentVariant;
  securityType?: SecurityVariant;
}

export interface TransactionFieldRequirement {
  key: string;
  label: string;
  required: boolean;
}

export interface TransactionSectionRequirement {
  type: string;
  required: boolean;
  label: string;
}

export interface TransactionDefinition {
  id: string;
  type: TransactionType;
  label: string;
  description: string;
  schemaVersion: number;
  supportedTemplateKinds: string[];
  requiredFields: TransactionFieldRequirement[];
  requiredSections: TransactionSectionRequirement[];
  optionalSections: TransactionSectionRequirement[];
  supportedVariants: Partial<Record<keyof TransactionVariants, string[]>>;
}

export interface DealParticipant {
  role: string;
  name: string;
  entityType: 'individual' | 'company';
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

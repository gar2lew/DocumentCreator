import type { TransactionDefinition, TransactionType } from './types';

const TRANSACTION_DEFINITIONS: TransactionDefinition[] = [
  {
    id: 'secured-loan-v1',
    type: 'secured_loan',
    label: 'Secured Loan Agreement',
    description: 'A loan agreement secured by mortgage, charge, or guarantee with full repayment terms and default interest provisions',
    schemaVersion: 1,
    supportedTemplateKinds: ['loan_agreement'],
    requiredFields: [
      { key: 'loan_amount', label: 'Loan Amount', required: true },
      { key: 'interest_rate', label: 'Interest Rate', required: true },
      { key: 'default_interest_rate', label: 'Default Interest Rate', required: true },
      { key: 'loan_term_years', label: 'Loan Term (Years)', required: true },
      { key: 'maturity_date', label: 'Maturity Date', required: true },
      { key: 'repayment_amount', label: 'Repayment Amount', required: true },
      { key: 'repayment_frequency', label: 'Repayment Frequency', required: true },
    ],
    requiredSections: [
      { type: 'repayment', required: true, label: 'Repayment Schedule' },
      { type: 'execution', required: true, label: 'Execution Block' },
      { type: 'jurisdiction', required: true, label: 'Jurisdiction Clause' },
    ],
    optionalSections: [
      { type: 'guarantor', required: false, label: 'Guarantor Clause' },
    ],
    supportedVariants: {
      rateType: ['fixed', 'variable'],
      repaymentType: ['principal_interest', 'interest_only', 'balloon'],
      securityType: ['mortgage', 'charge', 'guarantee'],
    },
  },
  {
    id: 'unsecured-loan-v1',
    type: 'unsecured_loan',
    label: 'Unsecured Loan Agreement',
    description: 'A loan agreement without security provisions, with standard repayment and jurisdiction terms',
    schemaVersion: 1,
    supportedTemplateKinds: ['loan_agreement'],
    requiredFields: [
      { key: 'loan_amount', label: 'Loan Amount', required: true },
      { key: 'interest_rate', label: 'Interest Rate', required: true },
      { key: 'maturity_date', label: 'Maturity Date', required: true },
      { key: 'repayment_amount', label: 'Repayment Amount', required: true },
    ],
    requiredSections: [
      { type: 'repayment', required: true, label: 'Repayment Schedule' },
      { type: 'execution', required: true, label: 'Execution Block' },
      { type: 'jurisdiction', required: true, label: 'Jurisdiction Clause' },
    ],
    optionalSections: [],
    supportedVariants: {
      rateType: ['fixed', 'variable'],
      repaymentType: ['principal_interest', 'interest_only'],
    },
  },
  {
    id: 'settlement-deed-v1',
    type: 'settlement_deed',
    label: 'Settlement Deed',
    description: 'A deed of settlement with consideration, settlement timeline, and execution provisions',
    schemaVersion: 1,
    supportedTemplateKinds: ['deed'],
    requiredFields: [
      { key: 'settlement_date', label: 'Settlement Date', required: true },
      { key: 'consideration_amount', label: 'Consideration Amount', required: true },
      { key: 'property_address', label: 'Property Address', required: true },
    ],
    requiredSections: [
      { type: 'settlement', required: true, label: 'Settlement Schedule' },
      { type: 'execution', required: true, label: 'Execution Block' },
      { type: 'jurisdiction', required: true, label: 'Jurisdiction Clause' },
    ],
    optionalSections: [
      { type: 'guarantor', required: false, label: 'Guarantor Clause' },
    ],
    supportedVariants: {},
  },
  {
    id: 'guarantor-loan-v1',
    type: 'guarantor_loan',
    label: 'Guarantor-Backed Loan',
    description: 'A loan agreement with personal or corporate guarantee, including guarantor covenant and repayment terms',
    schemaVersion: 1,
    supportedTemplateKinds: ['loan_agreement'],
    requiredFields: [
      { key: 'loan_amount', label: 'Loan Amount', required: true },
      { key: 'interest_rate', label: 'Interest Rate', required: true },
      { key: 'guarantor_name', label: 'Guarantor Name', required: true },
      { key: 'guarantor_acn', label: 'Guarantor ACN', required: true },
      { key: 'maturity_date', label: 'Maturity Date', required: true },
    ],
    requiredSections: [
      { type: 'guarantor', required: true, label: 'Guarantor Clause' },
      { type: 'repayment', required: true, label: 'Repayment Schedule' },
      { type: 'execution', required: true, label: 'Execution Block' },
      { type: 'jurisdiction', required: true, label: 'Jurisdiction Clause' },
    ],
    optionalSections: [],
    supportedVariants: {
      rateType: ['fixed', 'variable'],
      repaymentType: ['principal_interest', 'interest_only'],
      securityType: ['guarantee'],
    },
  },
  {
    id: 'staged-repayment-v1',
    type: 'staged_repayment',
    label: 'Staged Repayment Agreement',
    description: 'A repayment agreement with staged payment milestones, balloon payment option, and default provisions',
    schemaVersion: 1,
    supportedTemplateKinds: ['loan_agreement'],
    requiredFields: [
      { key: 'loan_amount', label: 'Total Loan Amount', required: true },
      { key: 'repayment_amount', label: 'Stage Repayment Amount', required: true },
      { key: 'repayment_frequency', label: 'Repayment Frequency', required: true },
      { key: 'maturity_date', label: 'Final Maturity Date', required: true },
    ],
    requiredSections: [
      { type: 'repayment', required: true, label: 'Repayment Schedule' },
      { type: 'execution', required: true, label: 'Execution Block' },
      { type: 'jurisdiction', required: true, label: 'Jurisdiction Clause' },
    ],
    optionalSections: [
      { type: 'guarantor', required: false, label: 'Guarantor Clause' },
    ],
    supportedVariants: {
      repaymentType: ['principal_interest', 'balloon'],
    },
  },
];

export function getTransactionDefinitions(): TransactionDefinition[] {
  return TRANSACTION_DEFINITIONS;
}

export function getTransactionDefinition(type: TransactionType): TransactionDefinition | undefined {
  return TRANSACTION_DEFINITIONS.find((t) => t.type === type);
}

export function getTransactionDefinitionById(id: string): TransactionDefinition | undefined {
  return TRANSACTION_DEFINITIONS.find((t) => t.id === id);
}

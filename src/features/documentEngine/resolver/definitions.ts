import type { FieldDefinition } from './types';

const FIELD_DEFINITIONS: FieldDefinition[] = [
  // ── Project fields ──
  { key: 'project_name', label: 'Project Name', type: 'text', source: 'direct', computed: false, formatter: 'none', dependencies: [], category: 'Project' },
  { key: 'client_name', label: 'Client Name', type: 'text', source: 'direct', computed: false, formatter: 'none', dependencies: [], category: 'Project' },
  { key: 'acn', label: 'ACN', type: 'acn', source: 'direct', computed: false, formatter: 'acn', dependencies: [], category: 'Project' },
  // ── Financial fields ──
  { key: 'loan_amount', label: 'Loan Amount', type: 'currency', source: 'direct', computed: false, formatter: 'currency', dependencies: [], category: 'Financial' },
  { key: 'loan_amount_words', label: 'Loan Amount (Words)', type: 'words', source: 'computed', computed: true, formatter: 'words', dependencies: ['loan_amount'], category: 'Financial' },
  { key: 'interest_rate', label: 'Interest Rate', type: 'percentage', source: 'direct', computed: false, formatter: 'percentage', dependencies: [], category: 'Financial' },
  { key: 'default_interest_rate', label: 'Default Interest Rate', type: 'percentage', source: 'direct', computed: false, formatter: 'percentage', dependencies: [], category: 'Financial' },
  { key: 'repayment_amount', label: 'Repayment Amount', type: 'currency', source: 'direct', computed: false, formatter: 'currency', dependencies: [], category: 'Financial' },
  { key: 'repayment_total', label: 'Repayment Total', type: 'currency', source: 'computed', computed: true, formatter: 'currency', dependencies: ['repayment_amount', 'loan_term_months'], category: 'Financial' },
  { key: 'consideration_amount', label: 'Consideration Amount', type: 'currency', source: 'direct', computed: false, formatter: 'currency', dependencies: [], category: 'Financial' },
  { key: 'consideration_amount_words', label: 'Consideration Amount (Words)', type: 'words', source: 'computed', computed: true, formatter: 'words', dependencies: ['consideration_amount'], category: 'Financial' },
  // ── Loan terms ──
  { key: 'loan_term_years', label: 'Loan Term (Years)', type: 'number', source: 'direct', computed: false, formatter: 'none', dependencies: [], category: 'Loan Terms' },
  { key: 'loan_term_months', label: 'Loan Term (Months)', type: 'number', source: 'direct', computed: false, formatter: 'none', dependencies: [], category: 'Loan Terms' },
  { key: 'purpose_of_loan', label: 'Purpose of Loan', type: 'text', source: 'direct', computed: false, formatter: 'none', dependencies: [], category: 'Loan Terms' },
  { key: 'repayment_frequency', label: 'Repayment Frequency', type: 'text', source: 'direct', computed: false, formatter: 'none', dependencies: [], category: 'Loan Terms' },
  // ── Date fields ──
  { key: 'date', label: 'Date', type: 'date', source: 'direct', computed: false, formatter: 'date_long', dependencies: [], category: 'Dates' },
  { key: 'agreement_date', label: 'Agreement Date', type: 'date', source: 'direct', computed: false, formatter: 'date_long', dependencies: [], category: 'Dates' },
  { key: 'settlement_date', label: 'Settlement Date', type: 'date', source: 'direct', computed: false, formatter: 'date_long', dependencies: [], category: 'Dates' },
  { key: 'drawdown_date', label: 'Drawdown Date', type: 'date', source: 'direct', computed: false, formatter: 'date_long', dependencies: [], category: 'Dates' },
  { key: 'maturity_date', label: 'Maturity Date', type: 'date', source: 'direct', computed: false, formatter: 'date_long', dependencies: [], category: 'Dates' },
  // ── Party fields ──
  { key: 'lender_name', label: 'Lender Name', type: 'text', source: 'participant', computed: false, formatter: 'none', dependencies: [], category: 'Parties' },
  { key: 'lender_acn', label: 'Lender ACN', type: 'acn', source: 'participant', computed: false, formatter: 'acn', dependencies: [], category: 'Parties' },
  { key: 'lender_address', label: 'Lender Address', type: 'text', source: 'participant', computed: false, formatter: 'none', dependencies: [], category: 'Parties' },
  { key: 'borrower_name', label: 'Borrower Name', type: 'text', source: 'participant', computed: false, formatter: 'none', dependencies: [], category: 'Parties' },
  { key: 'borrower_acn', label: 'Borrower ACN', type: 'acn', source: 'participant', computed: false, formatter: 'acn', dependencies: [], category: 'Parties' },
  { key: 'borrower_address', label: 'Borrower Address', type: 'text', source: 'participant', computed: false, formatter: 'none', dependencies: [], category: 'Parties' },
  { key: 'guarantor_name', label: 'Guarantor Name', type: 'text', source: 'participant', computed: false, formatter: 'none', dependencies: [], category: 'Parties' },
  { key: 'guarantor_acn', label: 'Guarantor ACN', type: 'acn', source: 'participant', computed: false, formatter: 'acn', dependencies: [], category: 'Parties' },
  { key: 'guarantor_address', label: 'Guarantor Address', type: 'text', source: 'participant', computed: false, formatter: 'none', dependencies: [], category: 'Parties' },
  // ── Security fields ──
  { key: 'security_type', label: 'Security Type', type: 'text', source: 'direct', computed: false, formatter: 'none', dependencies: [], category: 'Security' },
  { key: 'security_description', label: 'Security Description', type: 'text', source: 'direct', computed: false, formatter: 'none', dependencies: [], category: 'Security' },
  { key: 'property_address', label: 'Property Address', type: 'text', source: 'direct', computed: false, formatter: 'none', dependencies: [], category: 'Security' },
  { key: 'property_title_reference', label: 'Property Title Reference', type: 'text', source: 'direct', computed: false, formatter: 'none', dependencies: [], category: 'Security' },
  // ── Bank fields ──
  { key: 'bank_name', label: 'Bank Name', type: 'text', source: 'direct', computed: false, formatter: 'none', dependencies: [], category: 'Bank' },
  { key: 'account_name', label: 'Account Name', type: 'text', source: 'direct', computed: false, formatter: 'none', dependencies: [], category: 'Bank' },
  { key: 'bsb', label: 'BSB', type: 'text', source: 'direct', computed: false, formatter: 'none', dependencies: [], category: 'Bank' },
  { key: 'account_number', label: 'Account Number', type: 'text', source: 'direct', computed: false, formatter: 'none', dependencies: [], category: 'Bank' },
  // ── Derived fields ──
  { key: 'participant_count', label: 'Number of Participants', type: 'number', source: 'derived', computed: true, formatter: 'none', dependencies: ['lender_name', 'borrower_name'], category: 'Derived' },
  { key: 'jurisdiction', label: 'Jurisdiction', type: 'text', source: 'direct', computed: false, formatter: 'uppercase', dependencies: [], category: 'Legal' },
];

export function getFieldDefinitions(): FieldDefinition[] {
  return FIELD_DEFINITIONS;
}

export function getFieldDefinition(key: string): FieldDefinition | undefined {
  return FIELD_DEFINITIONS.find((f) => f.key === key);
}

export function getFieldDefinitionsByCategory(category: string): FieldDefinition[] {
  return FIELD_DEFINITIONS.filter((f) => f.category === category);
}

export function getComputedFieldDefinitions(): FieldDefinition[] {
  return FIELD_DEFINITIONS.filter((f) => f.computed);
}

export function getNonComputedFieldDefinitions(): FieldDefinition[] {
  return FIELD_DEFINITIONS.filter((f) => !f.computed);
}

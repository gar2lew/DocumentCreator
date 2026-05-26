/**
 * SCHEMA GOVERNANCE REGISTRY
 *
 * Centralized metadata system for all document fields.
 * Evolved from the original field catalog to support governed
 * schema lifecycle, deprecation, aliasing, and ownership.
 *
 * This is the single source of truth for field metadata.
 */

export type FieldType = 'text' | 'currency' | 'number' | 'date' | 'percentage' | 'words';

export type FieldLifecycleState = 'active' | 'deprecated' | 'sunset';

export interface FieldAlias {
  /** The alias field key */
  key: string;
  /** When this alias was the canonical name */
  activeFrom?: string;
  /** When this alias was superseded */
  activeUntil?: string;
}

export interface FieldOwnership {
  team?: string;
  system?: string;
  contact?: string;
}

export interface CompatibilityMapping {
  /** Dot-notation parent path (e.g. "borrower.name") for structured contexts */
  structuredPath?: string;
  /** Alternative keys that resolve to the same semantic value */
  equivalentKeys?: string[];
}

export interface SchemaGovernanceEntry {
  /** Canonical field key used in template content (<<key>>) */
  key: string;
  /** Human-readable display label */
  label: string;
  /** Functional category grouping */
  category: string;
  /** Primitive data type */
  type: FieldType;
  /** Human-readable description */
  description?: string;
  /** Template kinds this field applies to (undefined = all) */
  templateKinds?: ('deed' | 'loan_agreement')[];
  /** Lifecycle state in the schema governance system */
  lifecycleState?: FieldLifecycleState;
  /** Deprecation notice — shown when field is deprecated or sunset */
  deprecationNotice?: string;
  /** Historical aliases this field has been known as */
  aliases?: FieldAlias[];
  /** Ownership metadata */
  ownership?: FieldOwnership;
  /** Compatibility mappings for structured contexts */
  compatibility?: CompatibilityMapping;
}

export type FieldCatalogEntry = SchemaGovernanceEntry;

export const FIELD_CATALOG: SchemaGovernanceEntry[] = [
  // ── Project / General ──
  { key: 'project_name', label: 'Project Name', category: 'Project', type: 'text', ownership: { team: 'Operations', system: 'Deal Management' } },
  { key: 'client_name', label: 'Client Name', category: 'Project', type: 'text', ownership: { team: 'Operations', system: 'Deal Management' } },
  { key: 'acn', label: 'ACN', category: 'Project', type: 'text', description: 'Australian Company Number', ownership: { team: 'Operations', system: 'ASIC' } },
  { key: 'bank_name', label: 'Bank Name', category: 'Bank', type: 'text', ownership: { team: 'Finance', system: 'Bank Details' } },
  { key: 'account_name', label: 'Account Name', category: 'Bank', type: 'text', ownership: { team: 'Finance', system: 'Bank Details' } },
  { key: 'bsb', label: 'BSB', category: 'Bank', type: 'text', ownership: { team: 'Finance', system: 'Bank Details' } },
  { key: 'account_number', label: 'Account Number', category: 'Bank', type: 'text', ownership: { team: 'Finance', system: 'Bank Details' } },
  { key: 'date', label: 'Current Date', category: 'General', type: 'date' },

  // ── Loan Agreement fields ──
  { key: 'lender_name', label: 'Lender Name', category: 'Parties', type: 'text', templateKinds: ['loan_agreement'], ownership: { team: 'Legal', system: 'Loan Origination' } },
  { key: 'lender_acn', label: 'Lender ACN', category: 'Parties', type: 'text', templateKinds: ['loan_agreement'], ownership: { team: 'Legal', system: 'Loan Origination' } },
  { key: 'lender_address', label: 'Lender Address', category: 'Parties', type: 'text', templateKinds: ['loan_agreement'], ownership: { team: 'Legal', system: 'Loan Origination' } },
  { key: 'borrower_name', label: 'Borrower Name', category: 'Parties', type: 'text', templateKinds: ['loan_agreement', 'deed'] },
  { key: 'borrower_acn', label: 'Borrower ACN', category: 'Parties', type: 'text', templateKinds: ['loan_agreement', 'deed'] },
  { key: 'borrower_address', label: 'Borrower Address', category: 'Parties', type: 'text', templateKinds: ['loan_agreement', 'deed'] },
  { key: 'loan_amount', label: 'Loan Amount', category: 'Loan Terms', type: 'currency', templateKinds: ['loan_agreement'], description: 'Principal loan amount', compatibility: { equivalentKeys: ['loan_amount_currency', 'principal_amount'] } },
  { key: 'loan_amount_words', label: 'Loan Amount (words)', category: 'Loan Terms', type: 'words', templateKinds: ['loan_agreement'] },
  { key: 'interest_rate', label: 'Interest Rate', category: 'Loan Terms', type: 'percentage', templateKinds: ['loan_agreement'] },
  { key: 'default_interest_rate', label: 'Default Interest Rate', category: 'Loan Terms', type: 'percentage', templateKinds: ['loan_agreement'] },
  { key: 'loan_term_years', label: 'Loan Term (years)', category: 'Loan Terms', type: 'number', templateKinds: ['loan_agreement'] },
  { key: 'loan_term_months', label: 'Loan Term (months)', category: 'Loan Terms', type: 'number', templateKinds: ['loan_agreement'] },
  { key: 'repayment_amount', label: 'Repayment Amount', category: 'Repayment', type: 'currency', templateKinds: ['loan_agreement'] },
  { key: 'repayment_frequency', label: 'Repayment Frequency', category: 'Repayment', type: 'text', templateKinds: ['loan_agreement'] },
  { key: 'drawdown_date', label: 'Drawdown Date', category: 'Repayment', type: 'date', templateKinds: ['loan_agreement'] },
  { key: 'maturity_date', label: 'Maturity Date', category: 'Repayment', type: 'date', templateKinds: ['loan_agreement'] },
  { key: 'purpose_of_loan', label: 'Purpose of Loan', category: 'Loan Terms', type: 'text', templateKinds: ['loan_agreement'] },
  { key: 'security_type', label: 'Security Type', category: 'Security', type: 'text', templateKinds: ['loan_agreement'] },
  { key: 'security_description', label: 'Security Description', category: 'Security', type: 'text', templateKinds: ['loan_agreement'] },

  // ── Deed fields ──
  { key: 'lender_name', label: 'Lender Name', category: 'Parties', type: 'text', templateKinds: ['deed'] },
  { key: 'lender_address', label: 'Lender Address', category: 'Parties', type: 'text', templateKinds: ['deed'] },
  { key: 'borrower_company_name', label: 'Borrower Company Name', category: 'Parties', type: 'text', templateKinds: ['deed'] },
  { key: 'guarantor_name', label: 'Guarantor Name', category: 'Parties', type: 'text', templateKinds: ['deed', 'loan_agreement'] },
  { key: 'guarantor_acn', label: 'Guarantor ACN', category: 'Parties', type: 'text', templateKinds: ['deed', 'loan_agreement'] },
  { key: 'guarantor_address', label: 'Guarantor Address', category: 'Parties', type: 'text', templateKinds: ['deed', 'loan_agreement'] },
  { key: 'property_address', label: 'Property Address', category: 'Property', type: 'text', templateKinds: ['deed'] },
  { key: 'property_title_reference', label: 'Title Reference', category: 'Property', type: 'text', templateKinds: ['deed'] },
  { key: 'consideration_amount', label: 'Consideration Amount', category: 'Financial', type: 'currency', templateKinds: ['deed'] },
  { key: 'consideration_amount_words', label: 'Consideration Amount (words)', category: 'Financial', type: 'words', templateKinds: ['deed'] },
  { key: 'settlement_date', label: 'Settlement Date', category: 'Dates', type: 'date', templateKinds: ['deed'] },
  { key: 'security_property_address', label: 'Security Property Address', category: 'Property', type: 'text', templateKinds: ['deed'] },
];

// ── Governance Registry Functions ──

export function getFieldCatalogForKind(templateKind: 'deed' | 'loan_agreement' | null | undefined): SchemaGovernanceEntry[] {
  if (!templateKind) return FIELD_CATALOG.filter((e) => !e.templateKinds);
  return FIELD_CATALOG.filter((e) => !e.templateKinds || e.templateKinds.includes(templateKind));
}

export function getFieldCategories(catalog: SchemaGovernanceEntry[]): string[] {
  const cats = new Set(catalog.map((e) => e.category));
  return Array.from(cats);
}

export function getFieldByKey(key: string): SchemaGovernanceEntry | undefined {
  return FIELD_CATALOG.find((e) => e.key === key);
}

export function getDeprecatedFields(keys: string[]): SchemaGovernanceEntry[] {
  return keys
    .map((k) => getFieldByKey(k))
    .filter((e): e is SchemaGovernanceEntry =>
      e !== undefined && (e.lifecycleState === 'deprecated' || e.lifecycleState === 'sunset')
    );
}

export function getFieldAliases(key: string): string[] {
  const entry = getFieldByKey(key);
  return entry?.aliases?.map((a) => a.key) ?? [];
}

export function resolveAlias(key: string): string {
  const entry = FIELD_CATALOG.find((e) => e.aliases?.some((a) => a.key === key));
  return entry?.key ?? key;
}

export function getFieldsByOwner(owner: string): SchemaGovernanceEntry[] {
  return FIELD_CATALOG.filter(
    (e) => e.ownership?.team?.toLowerCase() === owner.toLowerCase()
  );
}

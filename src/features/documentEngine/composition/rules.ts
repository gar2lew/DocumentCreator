import type { CompositionRule } from './types';

function hasPlaceholder(ctx: { placeholders: string[] }, keys: string[]): boolean {
  return ctx.placeholders.some((p) => keys.includes(p));
}

export const COMPOSITION_RULES: CompositionRule[] = [
  // ── Guarantor rules ──
  {
    id: 'include-guarantor-if-guarantor-field',
    sectionType: 'guarantor',
    label: 'Include guarantor clause if guarantor fields present',
    description: 'Automatically includes the guarantor section when placeholders reference guarantor data',
    condition: (ctx) =>
      ctx.placeholders.some((p) => p.startsWith('guarantor_')),
    dependencies: [],
  },
  {
    id: 'include-guarantor-if-transaction-requires',
    sectionType: 'guarantor',
    label: 'Include guarantor clause when transaction requires',
    description: 'Includes guarantor section when the transaction type requires a guarantor',
    condition: (ctx) =>
      ctx.transactionType === 'guarantor_loan',
    dependencies: [],
  },
  // ── Repayment rules ──
  {
    id: 'include-repayment-if-loan-terms',
    sectionType: 'repayment',
    label: 'Include repayment schedule for loan agreements',
    description: 'Repayment terms are always included in loan agreement templates',
    condition: (ctx) =>
      ctx.templateKind === 'loan_agreement' ||
      hasPlaceholder(ctx, ['repayment_amount', 'repayment_frequency', 'maturity_date', 'loan_term_years', 'loan_term_months']),
    dependencies: [],
  },
  {
    id: 'include-repayment-if-loan-transaction',
    sectionType: 'repayment',
    label: 'Include repayment schedule for loan transactions',
    description: 'All loan-type transactions require repayment terms',
    condition: (ctx) =>
      ctx.transactionType === 'secured_loan' ||
      ctx.transactionType === 'unsecured_loan' ||
      ctx.transactionType === 'guarantor_loan' ||
      ctx.transactionType === 'staged_repayment',
    dependencies: [],
  },
  // ── Settlement rules ──
  {
    id: 'include-settlement-if-deed',
    sectionType: 'settlement',
    label: 'Include settlement schedule for deeds',
    description: 'Settlement timeline is always included for deed templates',
    condition: (ctx) =>
      ctx.templateKind === 'deed' ||
      hasPlaceholder(ctx, ['settlement_date', 'consideration_amount']),
    dependencies: [],
  },
  {
    id: 'include-settlement-if-deed-transaction',
    sectionType: 'settlement',
    label: 'Include settlement schedule for deed transactions',
    description: 'Settlement deeds require settlement schedule',
    condition: (ctx) =>
      ctx.transactionType === 'settlement_deed',
    dependencies: [],
  },
  // ── Execution rules ──
  {
    id: 'include-execution-if-deed-or-loan',
    sectionType: 'execution',
    label: 'Include execution block for all documents',
    description: 'Execution blocks are standard for all deed and loan agreement templates',
    condition: (ctx) =>
      ctx.templateKind === 'deed' || ctx.templateKind === 'loan_agreement' ||
      ctx.transactionType !== undefined,
    dependencies: [],
  },
  // ── Jurisdiction rules ──
  {
    id: 'include-jurisdiction-if-legal',
    sectionType: 'jurisdiction',
    label: 'Include jurisdiction clause',
    description: 'Jurisdiction clause is included for all governed documents',
    condition: (ctx) =>
      ctx.templateKind === 'deed' || ctx.templateKind === 'loan_agreement' ||
      ctx.transactionType !== undefined,
    dependencies: [],
  },
];

export function getRuleForSectionType(sectionType: string): CompositionRule | undefined {
  return COMPOSITION_RULES.find((r) => r.sectionType === sectionType);
}

export function evaluateRule(rule: CompositionRule, ctx: CompositionContext): boolean {
  try {
    return rule.condition(ctx);
  } catch {
    return false;
  }
}

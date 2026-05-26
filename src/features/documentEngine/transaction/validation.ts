import type { Deal, TransactionDefinition } from './types';
import type { CompositionDiagnostics } from '../composition/types';

export interface TransactionValidationWarning {
  type: 'missing_required_field' | 'missing_required_section' | 'incompatible_variant' | 'invalid_metadata';
  field?: string;
  sectionType?: string;
  message: string;
}

export interface DealValidationResult {
  valid: boolean;
  warnings: TransactionValidationWarning[];
  unresolvedFieldCount: number;
  unresolvedSectionCount: number;
}

export function validateDealAgainstTransaction(
  deal: Deal,
  transaction: TransactionDefinition,
  compositionDiagnostics?: CompositionDiagnostics
): DealValidationResult {
  const warnings: TransactionValidationWarning[] = [];

  // ── Required fields ──
  for (const field of transaction.requiredFields) {
    if (!field.required) continue;
    const value = (deal.financials as Record<string, unknown>)[field.key];
    if (value === undefined || value === null || value === '') {
      warnings.push({
        type: 'missing_required_field',
        field: field.key,
        message: `Required field "${field.label}" (${field.key}) is missing from deal`,
      });
    }
  }

  // ── Required sections ──
  if (compositionDiagnostics) {
    for (const section of transaction.requiredSections) {
      if (!section.required) continue;
      const resolved = compositionDiagnostics.sections.find(
        (s) => s.sectionType === section.type
      );
      if (!resolved || resolved.outcome !== 'included') {
        warnings.push({
          type: 'missing_required_section',
          sectionType: section.type,
          message: `Required section "${section.label}" is not included in composition`,
        });
      }
    }
  }

  // ── Variant compatibility ──
  for (const [variantKey, allowedValues] of Object.entries(transaction.supportedVariants)) {
    const dealVariant = (deal.variants as Record<string, unknown>)[variantKey];
    if (dealVariant !== undefined && dealVariant !== null && dealVariant !== '' && allowedValues && Array.isArray(allowedValues)) {
      if (!(allowedValues as string[]).includes(dealVariant as string)) {
        warnings.push({
          type: 'incompatible_variant',
          message: `Variant "${variantKey}": "${String(dealVariant)}" is not supported. Allowed: ${(allowedValues as string[]).join(', ')}`,
        });
      }
    }
  }

  // ── Transaction type alignment ──
  if (deal.transactionType !== transaction.type) {
    warnings.push({
      type: 'invalid_metadata',
      message: `Deal transaction type "${deal.transactionType}" does not match definition "${transaction.type}"`,
    });
  }

  return {
    valid: warnings.length === 0,
    warnings,
    unresolvedFieldCount: warnings.filter((w) => w.type === 'missing_required_field').length,
    unresolvedSectionCount: warnings.filter((w) => w.type === 'missing_required_section').length,
  };
}

export function summariseDealValidation(result: DealValidationResult): string {
  if (result.valid) return 'All transaction requirements met';
  const parts: string[] = [];
  if (result.unresolvedFieldCount > 0) parts.push(`${result.unresolvedFieldCount} missing fields`);
  if (result.unresolvedSectionCount > 0) parts.push(`${result.unresolvedSectionCount} missing sections`);
  const other = result.warnings.length - result.unresolvedFieldCount - result.unresolvedSectionCount;
  if (other > 0) parts.push(`${other} other warnings`);
  return `Validation: ${parts.join(', ')}`;
}

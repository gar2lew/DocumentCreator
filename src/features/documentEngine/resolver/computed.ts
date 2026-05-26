import type { ComputedFieldRegistration } from './types';
import { numberToWords } from '../../../shared/utils/numberToWords';

const COMPUTED_FIELDS: ComputedFieldRegistration[] = [
  {
    key: 'loan_amount_words',
    label: 'Loan Amount in Words',
    dependencies: ['loan_amount'],
    fn: (deps) => {
      const num = parseFloat(deps['loan_amount']?.replace(/[^0-9.-]/g, '') ?? '');
      return Number.isFinite(num) ? numberToWords(num) : '';
    },
  },
  {
    key: 'consideration_amount_words',
    label: 'Consideration Amount in Words',
    dependencies: ['consideration_amount'],
    fn: (deps) => {
      const num = parseFloat(deps['consideration_amount']?.replace(/[^0-9.-]/g, '') ?? '');
      return Number.isFinite(num) ? numberToWords(num) : '';
    },
  },
  {
    key: 'repayment_total',
    label: 'Total Repayment Amount',
    dependencies: ['repayment_amount', 'loan_term_months'],
    fn: (deps) => {
      const amount = parseFloat(deps['repayment_amount']?.replace(/[^0-9.-]/g, '') ?? '');
      const months = parseInt(deps['loan_term_months'] ?? '0', 10);
      if (!Number.isFinite(amount) || months <= 0) return deps['repayment_amount'] ?? '';
      return String(amount * months);
    },
  },
  {
    key: 'participant_count',
    label: 'Number of Participants',
    dependencies: ['lender_name', 'borrower_name'],
    fn: (deps) => {
      let count = 0;
      if (deps['lender_name']) count++;
      if (deps['borrower_name']) count++;
      return String(count);
    },
  },
];

export function getComputedFieldRegistration(key: string): ComputedFieldRegistration | undefined {
  return COMPUTED_FIELDS.find((f) => f.key === key);
}

export function isComputedField(key: string): boolean {
  return COMPUTED_FIELDS.some((f) => f.key === key);
}

export function resolveComputedField(
  key: string,
  data: Record<string, string>
): { value: string; dependencyChain: string[] } | null {
  const registration = getComputedFieldRegistration(key);
  if (!registration) return null;

  const depValues: Record<string, string> = {};
  for (const dep of registration.dependencies) {
    depValues[dep] = data[dep] ?? '';
  }

  try {
    const value = registration.fn(depValues);
    return { value, dependencyChain: registration.dependencies };
  } catch {
    return null;
  }
}

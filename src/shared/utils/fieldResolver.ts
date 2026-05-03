import type { Project } from '../types';
import type { Deal } from '../../features/deals/types';
import { formatCurrency } from './currency';
import { numberToWords } from './numberToWords';

function valueAtPath(source: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, source);
}

function stringify(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toLocaleDateString('en-AU');
  return String(value);
}

function resolveCurrencyKey(key: string, deal: Deal): string | null {
  if (!key.endsWith('_currency')) return null;

  const baseKey = key.replace(/_currency$/, '');
  const value = resolveField(baseKey, deal);
  const amount = Number(value);
  return Number.isFinite(amount) ? formatCurrency(amount) : '';
}

export function resolveField(key: string, deal: Deal, project?: Project | null): string {
  const override = deal.overrides[key];
  if (override != null) return override;

  const currencyValue = resolveCurrencyKey(key, deal);
  if (currencyValue != null) return currencyValue;

  if (key === 'amount_words') {
    return numberToWords(deal.financials.total);
  }

  if (key === 'amount_currency') {
    return formatCurrency(deal.financials.total);
  }

  if (key.startsWith('project.')) {
    const projectSource = project ?? deal.projectSnapshot;
    return stringify(valueAtPath(projectSource, key.split('.').slice(1)));
  }

  if (key.startsWith('financials.')) {
    return stringify(valueAtPath(deal.financials, key.split('.').slice(1)));
  }

  if (key.startsWith('lender.')) {
    return stringify(valueAtPath(deal.lender, key.split('.').slice(1)));
  }

  if (key.startsWith('borrower.')) {
    return stringify(valueAtPath(deal.borrower, key.split('.').slice(1)));
  }

  if (key.startsWith('guarantor.')) {
    return stringify(valueAtPath(deal.guarantor, key.split('.').slice(1)));
  }

  if (key.startsWith('dates.')) {
    return stringify(valueAtPath(deal.dates, key.split('.').slice(1)));
  }

  if (key.startsWith('bankDetails.')) {
    return stringify(valueAtPath(deal.bankDetails, key.split('.').slice(1)));
  }

  return '';
}

export function resolveFields(keys: string[], deal: Deal, project?: Project | null): Record<string, string> {
  return keys.reduce<Record<string, string>>((resolved, key) => {
    const value = resolveField(key, deal, project);
    if (value) resolved[key] = value;
    return resolved;
  }, {});
}

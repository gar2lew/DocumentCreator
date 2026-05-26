import { formatCurrency } from '../../../shared/utils/currency';
import { numberToWords } from '../../../shared/utils/numberToWords';
import type { FormatterId } from './types';

export type Formatter = (value: string) => string;

const currencyFormatter: Formatter = (value) => {
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? formatCurrency(num) : value;
};

const dateShortFormatter: Formatter = (value) => {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : value;
};

const dateLongFormatter: Formatter = (value) => {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : value;
};

const acnFormatter: Formatter = (value) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return value;
};

const percentageFormatter: Formatter = (value) => {
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? `${num.toFixed(2)}%` : value;
};

const wordsFormatter: Formatter = (value) => {
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? numberToWords(num) : value;
};

const uppercaseFormatter: Formatter = (value) => value.toUpperCase();

const lowercaseFormatter: Formatter = (value) => value.toLowerCase();

const noneFormatter: Formatter = (value) => value;

const FORMATTER_REGISTRY: Record<FormatterId, Formatter> = {
  currency: currencyFormatter,
  date_short: dateShortFormatter,
  date_long: dateLongFormatter,
  acn: acnFormatter,
  percentage: percentageFormatter,
  words: wordsFormatter,
  uppercase: uppercaseFormatter,
  lowercase: lowercaseFormatter,
  none: noneFormatter,
};

export function getFormatter(id: FormatterId): Formatter {
  return FORMATTER_REGISTRY[id] ?? noneFormatter;
}

export function formatField(value: string, formatterId: FormatterId): string {
  const formatter = getFormatter(formatterId);
  try {
    return formatter(value);
  } catch {
    return value;
  }
}

export function getRegisteredFormatterIds(): FormatterId[] {
  return Object.keys(FORMATTER_REGISTRY) as FormatterId[];
}

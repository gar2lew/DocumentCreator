import type { Project } from '../types';
import { formatCurrency } from './currency';
import { numberToWords } from './numberToWords';

const PLACEHOLDER_REGEX = /<<([^>>]+)>>/g;

export function normalizePlaceholderKey(key: string): string {
  return key.trim().toLowerCase();
}

export function normalizePlaceholderData(data: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [normalizePlaceholderKey(key), value])
  );
}

export function resolvePlaceholderValue(key: string, data: Record<string, string>): string | undefined {
  const trimmed = normalizePlaceholderKey(key);
  const normalizedData = normalizePlaceholderData(data);

  if (trimmed.endsWith('_currency')) {
    const base = trimmed.replace('_currency', '');
    const num = parseFloat(normalizedData[base] ?? normalizedData[trimmed] ?? '0');
    return isNaN(num) ? normalizedData[trimmed] : formatCurrency(num);
  }

  if (trimmed.endsWith('_words')) {
    const base = trimmed.replace('_words', '');
    const num = parseFloat(normalizedData[base] ?? normalizedData[trimmed] ?? '0');
    return isNaN(num) ? normalizedData[trimmed] : numberToWords(num);
  }

  return normalizedData[trimmed];
}

/**
 * Extracts all placeholder keys from a template content string.
 */
export function extractPlaceholders(content: string): string[] {
  const keys = new Set<string>();
  let match;
  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
    keys.add(normalizePlaceholderKey(match[1]));
  }
  return Array.from(keys);
}

/**
 * Builds default placeholder data from a project.
 */
export function buildProjectPlaceholders(project: Project): Record<string, string> {
  return {
    project_name: project.name,
    client_name: project.name,
    acn: project.acn,
    bank_name: project.bankDetails.bankName,
    account_name: project.bankDetails.accountName,
    bsb: project.bankDetails.bsb,
    account_number: project.bankDetails.accountNumber,
    date: new Date().toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  };
}

/**
 * Replaces all <<key>> placeholders in content with values from data map.
 * Supports special transforms:
 *   <<amount_words>> → number to words
 *   <<amount_currency>> → formatted currency
 */
export function applyPlaceholders(
  content: string,
  data: Record<string, string>
): string {
  return content.replace(PLACEHOLDER_REGEX, (_match, key) => {
    const trimmed = normalizePlaceholderKey(key);
    return resolvePlaceholderValue(trimmed, data) ?? `<<${trimmed}>>`;
  });
}

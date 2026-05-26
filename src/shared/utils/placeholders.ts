import type { Project } from '../types';
import { formatCurrency } from './currency';
import { numberToWords } from './numberToWords';

const PLACEHOLDER_REGEX = /<<([^>>]+)>>/g;
const IF_BLOCK_REGEX = /<<if\s+([^>]+)>>/gi;
const FOR_BLOCK_REGEX = /<<for\s+([^>]+)>>/gi;

export interface PlaceholderStyle {
  fontFamily?: string;
  fontSize?: number;
  alignment?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface TemplateStyles {
  [placeholderKey: string]: PlaceholderStyle;
}

export type PlaceholderDataValue = string | string[] | Record<string, string>[];
export type PlaceholderData = Record<string, PlaceholderDataValue>;

export function normalizePlaceholderKey(key: string): string {
  return key.trim().toLowerCase();
}

export function normalizePlaceholderData(data: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [normalizePlaceholderKey(key), value])
  );
}

export function resolvePlaceholderValue(key: string, data: PlaceholderData): string | undefined {
  return resolvePlaceholderValueFromData(key, data);
}

/**
 * Extracts all placeholder keys from a template content string.
 */
export function extractPlaceholders(content: string): string[] {
  const keys = new Set<string>();
  let match;
  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
    const key = match[1].trim().toLowerCase();
    if (!key.startsWith('if ') && !key.startsWith('for ') && key !== 'endif' && key !== 'else' && key !== 'endfor') {
      keys.add(key);
    }
  }
  return Array.from(keys);
}

/**
 * Extracts loop keys (the keys used in <<for key>> blocks).
 */
export function extractLoopKeys(content: string): string[] {
  const keys = new Set<string>();
  let match;
  FOR_BLOCK_REGEX.lastIndex = 0;
  while ((match = FOR_BLOCK_REGEX.exec(content)) !== null) {
    keys.add(normalizePlaceholderKey(match[1]));
  }
  return Array.from(keys);
}

/**
 * Extracts conditional keys (the keys used in <<if key>> blocks).
 */
export function extractConditionalKeys(content: string): string[] {
  const keys = new Set<string>();
  let match;
  IF_BLOCK_REGEX.lastIndex = 0;
  while ((match = IF_BLOCK_REGEX.exec(content)) !== null) {
    keys.add(normalizePlaceholderKey(match[1]));
  }
  return Array.from(keys);
}

/**
 * Processes repeating sections (for loops) in content.
 * <<for key>>...<<endfor>> - repeats content for each item in the array
 * Inside the loop, use <<key.field>> to access item properties
 */
export function processLoops(
  content: string,
  data: PlaceholderData
): string {
  function processBlock(text: string): string {
    const forRegex = /<<for\s+([^>]+)>>/gi;
    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = forRegex.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index);
      const key = normalizePlaceholderKey(match[1]);
      const startIdx = match.index + match[0].length;

      const endforRegex = /<<endfor>>/gi;
      endforRegex.lastIndex = startIdx;
      const endforMatch = endforRegex.exec(text);

      if (!endforMatch) {
        result += before + match[0];
        lastIndex = match.index + match[0].length;
        continue;
      }

      const blockContent = text.slice(startIdx, endforMatch.index);
      const items = data[key];

      if (Array.isArray(items) && items.length > 0) {
        let repeated = '';
        for (const item of items) {
          const scopedData: PlaceholderData = { ...data };
          if (typeof item === 'object' && item !== null) {
            for (const [field, value] of Object.entries(item)) {
              scopedData[`${key}.${field}`] = value;
            }
          } else {
            scopedData[key] = String(item);
          }
          repeated += processBlock(blockContent).replace(PLACEHOLDER_REGEX, (_m, k) => {
            const trimmed = normalizePlaceholderKey(k);
            return resolvePlaceholderValueFromData(trimmed, scopedData) ?? `<<${trimmed}>>`;
          });
        }
        result += before + repeated;
      } else {
        result += before;
      }

      lastIndex = endforMatch.index + endforMatch[0].length;
    }

    result += text.slice(lastIndex);
    return result;
  }

  return processBlock(content);
}

/**
 * Resolves a placeholder value from raw data (supports nested dot notation).
 */
function resolvePlaceholderValueFromData(key: string, data: PlaceholderData): string | undefined {
  const trimmed = normalizePlaceholderKey(key);
  
  if (trimmed.includes('.')) {
    const [parent, child] = trimmed.split('.');
    const parentValue = data[parent];
    if (typeof parentValue === 'object' && parentValue !== null && !Array.isArray(parentValue)) {
      const childValue = (parentValue as Record<string, string>)[child];
      if (trimmed.endsWith('_currency') && childValue) {
        const num = parseFloat(childValue);
        return isNaN(num) ? childValue : formatCurrency(num);
      }
      if (trimmed.endsWith('_words') && childValue) {
        const num = parseFloat(childValue);
        return isNaN(num) ? childValue : numberToWords(num);
      }
      return String(childValue ?? '');
    }
    return data[trimmed] as string | undefined;
  }

  const value = data[trimmed];
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value !== 'string') return undefined;

  if (trimmed.endsWith('_currency')) {
    const num = parseFloat(value);
    return isNaN(num) ? value : formatCurrency(num);
  }
  if (trimmed.endsWith('_words')) {
    const num = parseFloat(value);
    return isNaN(num) ? value : numberToWords(num);
  }
  return value;
}

/**
 * Processes conditional blocks in content.
 * <<if key>>...<<endif>> - shows content if key has a truthy value
 * <<if key>>...<<else>>...<<endif>> - shows first part if truthy, second if falsy
 */
export function processConditionals(
  content: string,
  data: PlaceholderData
): string {
  function isTruthy(key: string): boolean {
    const value = data[key];
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (value === '') return false;
    if (value === '0') return false;
    if (value === 'false') return false;
    if (value === 'no') return false;
    return true;
  }

  function processBlock(text: string): string {
    const ifRegex = /<<if\s+([^>]+)>>/gi;
    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = ifRegex.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index);
      const key = normalizePlaceholderKey(match[1]);
      const startIdx = match.index + match[0].length;

      const endifRegex = /<<endif>>/gi;
      endifRegex.lastIndex = startIdx;
      const endifMatch = endifRegex.exec(text);

      if (!endifMatch) {
        result += before + match[0];
        lastIndex = match.index + match[0].length;
        continue;
      }

      const blockContent = text.slice(startIdx, endifMatch.index);
      const elseMatch = /<<else>>/i.exec(blockContent);

      let innerContent: string;
      if (elseMatch) {
        const ifPart = blockContent.slice(0, elseMatch.index);
        const elsePart = blockContent.slice(elseMatch.index + elseMatch[0].length);
        innerContent = isTruthy(key) ? ifPart : elsePart;
      } else {
        innerContent = isTruthy(key) ? blockContent : '';
      }

      result += before + processBlock(innerContent);
      lastIndex = endifMatch.index + endifMatch[0].length;
    }

    result += text.slice(lastIndex);
    return result;
  }

  return processBlock(content);
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

export interface TextSegment {
  type: 'literal' | 'placeholder';
  text: string;
  key?: string;
}

/**
 * Processes template content and returns an array of text segments,
 * distinguishing between literal text and resolved placeholder values.
 * This enables per-placeholder styling during export.
 */
export function resolveToSegments(
  content: string,
  data: PlaceholderData
): TextSegment[] {
  let processed = processLoops(content, data);
  processed = processConditionals(processed, data);

  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match;
  PLACEHOLDER_REGEX.lastIndex = 0;

  while ((match = PLACEHOLDER_REGEX.exec(processed)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'literal', text: processed.slice(lastIndex, match.index) });
    }
    const key = normalizePlaceholderKey(match[1]);
    const value = resolvePlaceholderValueFromData(key, data) ?? `<<${key}>>`;
    segments.push({ type: 'placeholder', text: value, key });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < processed.length) {
    segments.push({ type: 'literal', text: processed.slice(lastIndex) });
  }

  return segments;
}

/**
 * Replaces all <<key>> placeholders in content with values from data map.
 * Supports special transforms:
 *   <<amount_words>> → number to words
 *   <<amount_currency>> → formatted currency
 *   <<if key>>...<<endif>> → conditional blocks
 *   <<for key>>...<<endfor>> → repeating sections
 */
export function applyPlaceholders(
  content: string,
  data: PlaceholderData,
  _styles?: TemplateStyles
): string {
  let processed = processLoops(content, data);
  processed = processConditionals(processed, data);
  return processed.replace(PLACEHOLDER_REGEX, (_match, key) => {
    const trimmed = normalizePlaceholderKey(key);
    return resolvePlaceholderValueFromData(trimmed, data) ?? `<<${trimmed}>>`;
  });
}

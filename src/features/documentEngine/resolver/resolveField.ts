import { getFieldDefinition } from './definitions';
import { resolveComputedField } from './computed';
import { formatField } from './formatters';

export interface GovernedResolution {
  value: string;
  source: 'direct' | 'computed' | 'unresolved';
  formatter: string;
  key: string;
}

export function resolveGovernedField(
  key: string,
  data: Record<string, string>
): GovernedResolution {
  const definition = getFieldDefinition(key);

  // Try computed first
  const computed = resolveComputedField(key, data);
  if (computed) {
    const formatted = definition ? formatField(computed.value, definition.formatter) : computed.value;
    return {
      value: formatted,
      source: 'computed',
      formatter: definition?.formatter ?? 'none',
      key,
    };
  }

  // Direct
  const rawValue = data[key];
  if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
    const formatted = definition ? formatField(rawValue, definition.formatter) : rawValue;
    return {
      value: formatted,
      source: 'direct',
      formatter: definition?.formatter ?? 'none',
      key,
    };
  }

  // Unresolved — return key as fallback (matches existing behavior)
  return {
    value: `<<${key}>>`,
    source: 'unresolved',
    formatter: 'none',
    key,
  };
}

export function isFieldGoverned(key: string): boolean {
  return getFieldDefinition(key) !== undefined;
}

export function getFieldDataType(key: string): string | undefined {
  return getFieldDefinition(key)?.type;
}

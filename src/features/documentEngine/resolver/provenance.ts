import type { FieldResolution, FieldDefinition, ResolverProvenance } from './types';
import { getFieldDefinition } from './definitions';
import { resolveComputedField } from './computed';
import { formatField } from './formatters';

function buildDirectProvenance(
  key: string,
  rawValue: string,
  resolvedValue: string,
  definition: FieldDefinition | undefined
): ResolverProvenance {
  const formatterApplied = definition?.formatter ?? 'none';
  return {
    key,
    source: definition?.source ?? 'direct',
    value: resolvedValue,
    resolved: true,
    dependencyChain: [],
    formatterApplied,
    fallbackUsed: resolvedValue !== rawValue && formatterApplied !== 'none',
  };
}

function buildComputedProvenance(
  key: string,
  value: string,
  dependencyChain: string[],
  definition: FieldDefinition | undefined
): ResolverProvenance {
  return {
    key,
    source: 'computed',
    value,
    resolved: true,
    dependencyChain,
    formatterApplied: definition?.formatter ?? 'none',
    fallbackUsed: false,
  };
}

function buildUnresolvedProvenance(key: string): ResolverProvenance {
  return {
    key,
    source: 'direct',
    value: '',
    resolved: false,
    dependencyChain: [],
    formatterApplied: 'none',
    fallbackUsed: false,
  };
}

export function resolveFieldWithProvenance(
  key: string,
  data: Record<string, string>
): FieldResolution {
  const definition = getFieldDefinition(key);
  const rawValue = data[key];

  // Try computed field resolution first
  const computed = resolveComputedField(key, data);
  if (computed) {
    const formatted = definition ? formatField(computed.value, definition.formatter) : computed.value;
    return {
      key,
      value: formatted,
      provenance: buildComputedProvenance(key, formatted, computed.dependencyChain, definition),
    };
  }

  // Direct field resolution
  if (rawValue !== undefined && rawValue !== null) {
    const formatted = definition ? formatField(rawValue, definition.formatter) : rawValue;
    return {
      key,
      value: formatted,
      provenance: buildDirectProvenance(key, rawValue, formatted, definition),
    };
  }

  // Unresolved
  return {
    key,
    value: '',
    provenance: buildUnresolvedProvenance(key),
  };
}

export function resolveFieldsWithProvenance(
  keys: string[],
  data: Record<string, string>
): FieldResolution[] {
  return keys.map((key) => resolveFieldWithProvenance(key, data));
}

export function getUnresolvedFields(resolutions: FieldResolution[]): FieldResolution[] {
  return resolutions.filter((r) => !r.provenance.resolved);
}

export function getComputedResolutions(resolutions: FieldResolution[]): FieldResolution[] {
  return resolutions.filter((r) => r.provenance.source === 'computed');
}

export function buildProvenanceSummary(resolutions: FieldResolution[]): string {
  const total = resolutions.length;
  const resolved = resolutions.filter((r) => r.provenance.resolved).length;
  const computed = resolutions.filter((r) => r.provenance.source === 'computed').length;
  const unresolved = total - resolved;
  return `${resolved}/${total} resolved, ${computed} computed, ${unresolved} unresolved`;
}

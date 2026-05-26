import { getFieldDefinitions, getComputedFieldDefinitions } from './definitions';
import { getComputedFieldRegistration } from './computed';
import { getRegisteredFormatterIds } from './formatters';
import type { ResolverValidationResult, ResolverDependencyWarning } from './types';

export function validateFieldDependencies(): ResolverValidationResult {
  const warnings: ResolverDependencyWarning[] = [];
  const definedKeys = new Set(getFieldDefinitions().map((f) => f.key));
  const computedDefs = getComputedFieldDefinitions();

  // ── Circular dependency detection ──
  for (const def of computedDefs) {
    const visited = new Set<string>();
    const stack = [def.key];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) {
        warnings.push({
          type: 'circular_dependency',
          key: def.key,
          message: `Circular dependency detected involving "${current}" in computed field "${def.key}"`,
        });
        break;
      }
      visited.add(current);

      const registration = getComputedFieldRegistration(current);
      if (registration) {
        for (const dep of registration.dependencies) {
          if (getComputedFieldRegistration(dep)) {
            stack.push(dep);
          }
        }
      }
    }
  }

  // ── Unresolved dependencies ──
  for (const def of computedDefs) {
    const registration = getComputedFieldRegistration(def.key);
    if (!registration) {
      warnings.push({
        type: 'unresolved_dependency',
        key: def.key,
        message: `No computed field registration found for "${def.key}"`,
      });
      continue;
    }
    for (const dep of registration.dependencies) {
      if (!definedKeys.has(dep)) {
        warnings.push({
          type: 'unresolved_dependency',
          key: def.key,
          message: `Dependency "${dep}" for computed field "${def.key}" is not a defined field`,
        });
      }
    }
  }

  // ── Invalid formatter usage ──
  const validFormatters = new Set(getRegisteredFormatterIds());
  for (const def of getFieldDefinitions()) {
    if (!validFormatters.has(def.formatter)) {
      warnings.push({
        type: 'invalid_formatter',
        key: def.key,
        message: `Field "${def.key}" uses unknown formatter "${def.formatter}"`,
      });
    }
  }

  // ── Invalid computed chains (non-computed field with dependencies) ──
  for (const def of getFieldDefinitions()) {
    if (!def.computed && def.dependencies.length > 0) {
      warnings.push({
        type: 'invalid_computed_chain',
        key: def.key,
        message: `Non-computed field "${def.key}" has dependencies defined`,
      });
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

export function validateFieldKeys(keys: string[]): ResolverValidationResult {
  const warnings: ResolverDependencyWarning[] = [];
  const definedKeys = new Set(getFieldDefinitions().map((f) => f.key));

  for (const key of keys) {
    if (!definedKeys.has(key)) {
      warnings.push({
        type: 'unresolved_dependency',
        key,
        message: `Field "${key}" is not defined in the field registry`,
      });
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

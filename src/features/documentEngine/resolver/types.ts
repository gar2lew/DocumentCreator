export type FieldDataType = 'currency' | 'date' | 'acn' | 'percentage' | 'text' | 'number' | 'words';
export type FieldSource = 'direct' | 'computed' | 'participant' | 'derived';
export type FormatterId = 'currency' | 'date_short' | 'date_long' | 'acn' | 'percentage' | 'words' | 'uppercase' | 'lowercase' | 'none';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldDataType;
  source: FieldSource;
  computed: boolean;
  formatter: FormatterId;
  dependencies: string[];
  description?: string;
  category?: string;
}

export interface ResolverProvenance {
  key: string;
  source: FieldSource;
  value: string;
  resolved: boolean;
  dependencyChain: string[];
  formatterApplied: FormatterId;
  fallbackUsed: boolean;
}

export interface FieldResolution {
  key: string;
  value: string;
  provenance: ResolverProvenance;
}

export type ComputedFieldFn = (deps: Record<string, string>) => string;

export interface ComputedFieldRegistration {
  key: string;
  label: string;
  dependencies: string[];
  fn: ComputedFieldFn;
}

export interface ResolverDependencyWarning {
  type: 'circular_dependency' | 'unresolved_dependency' | 'invalid_formatter' | 'invalid_computed_chain';
  key: string;
  message: string;
}

export interface ResolverValidationResult {
  valid: boolean;
  warnings: ResolverDependencyWarning[];
}

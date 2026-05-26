export type {
  CompositionContext,
  CompositionRule,
  CompositionResult,
  CompositionDiagnostics,
  SectionResolution,
  DependencyWarning,
  RuleOutcome,
} from './types';

export { COMPOSITION_RULES, getRuleForSectionType, evaluateRule } from './rules';

export { composeTemplateSections, composeToContent } from './engine';

export {
  buildDiagnostics,
  hasCompositionWarnings,
  getCriticalWarnings,
} from './diagnostics';

import type { SectionType, SectionDefinition } from '../section/types';
import type { DocumentRoot } from '../schema/nodeTypes';
import type { DealFinancials, DealDates, TransactionVariants, DealParticipant } from '../transaction/types';

export interface CompositionContext {
  templateKind: string;
  placeholders: string[];
  fields: { placeholder: string }[];
  existingSections: string[];
  transactionType?: string;
  dealContext?: {
    financials: DealFinancials;
    dates: DealDates;
    variants: TransactionVariants;
    participants: DealParticipant[];
  };
}

export type RuleOutcome = 'included' | 'excluded' | 'unresolved';

export interface CompositionRule {
  id: string;
  sectionType: SectionType;
  label: string;
  description: string;
  condition: (ctx: CompositionContext) => boolean;
  dependencies: string[];
}

export interface SectionResolution {
  sectionId: string;
  sectionType: SectionType;
  label: string;
  outcome: RuleOutcome;
  ruleId: string;
  reason: string;
}

export interface DependencyWarning {
  type: 'missing_dependency' | 'incompatible_version' | 'deprecated_section';
  sectionId: string;
  sectionType: SectionType;
  message: string;
}

export interface CompositionDiagnostics {
  sections: SectionResolution[];
  warnings: DependencyWarning[];
  totalSections: number;
  includedCount: number;
  excludedCount: number;
  unresolvedCount: number;
}

export interface CompositionResult {
  composedNodes: DocumentRoot;
  diagnostics: CompositionDiagnostics;
  sections: SectionDefinition[];
}

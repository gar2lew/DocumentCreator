import { parseToNodes, serializeNodes } from '../schema/serialization';
import type { DocumentRoot, DocumentNode } from '../schema/nodeTypes';
import type { SectionDefinition } from '../section/types';
import { COMPOSITION_RULES, evaluateRule } from './rules';
import { buildDiagnostics } from './diagnostics';
import type { CompositionContext, CompositionResult, CompositionRule } from './types';
import type { Deal } from '../transaction/types';

function buildCompositionContext(template: {
  templateKind?: string | null;
  placeholders?: string[];
  fields?: { placeholder: string }[];
  sectionIds?: string[];
  transactionType?: string;
  dealContext?: CompositionContext['dealContext'];
}): CompositionContext {
  return {
    templateKind: template.templateKind ?? '',
    placeholders: template.placeholders ?? [],
    fields: template.fields ?? [],
    existingSections: template.sectionIds ?? [],
    transactionType: template.transactionType,
    dealContext: template.dealContext,
  };
}

function findSectionsForRules(
  sections: SectionDefinition[],
  rules: CompositionRule[]
): Map<string, SectionDefinition> {
  const map = new Map<string, SectionDefinition>();
  for (const rule of rules) {
    const section = sections.find((s) => s.type === rule.sectionType);
    if (section) {
      map.set(rule.sectionType, section);
    }
  }
  return map;
}

export function composeTemplateSections(
  template: {
    templateKind?: string | null;
    placeholders?: string[];
    fields?: { placeholder: string }[];
    sectionIds?: string[];
    transactionType?: string;
    deal?: Deal;
  },
  sections: SectionDefinition[]
): CompositionResult {
  const dealContext = template.deal ? {
    financials: template.deal.financials,
    dates: template.deal.dates,
    variants: template.deal.variants,
    participants: template.deal.participants,
  } : undefined;

  const context = buildCompositionContext({
    ...template,
    dealContext,
  });

  const matchedSections = findSectionsForRules(sections, COMPOSITION_RULES);

  const resolutions = COMPOSITION_RULES.map((rule) => {
    const section = matchedSections.get(rule.sectionType);
    if (!section) {
      return {
        sectionId: '',
        sectionType: rule.sectionType,
        label: rule.label,
        outcome: 'unresolved' as const,
        ruleId: rule.id,
        reason: `No ${rule.sectionType} section found in registry`,
      };
    }
    const matched = evaluateRule(rule, context);
    return {
      sectionId: section.id,
      sectionType: rule.sectionType,
      label: section.metadata.label,
      outcome: matched ? ('included' as const) : ('excluded' as const),
      ruleId: rule.id,
      reason: matched
        ? `Condition met: ${rule.description}`
        : `Condition not met: ${rule.description}`,
    };
  });

  const diagnostics = buildDiagnostics(resolutions, sections);
  const composedNodes = buildComposedTree(resolutions, sections);

  return {
    composedNodes,
    diagnostics,
    sections: sections.filter((s) =>
      resolutions.some((r) => r.sectionId === s.id && r.outcome === 'included')
    ),
  };
}

function buildComposedTree(
  resolutions: CompositionResult['diagnostics']['sections'],
  sections: SectionDefinition[]
): DocumentRoot {
  const children: DocumentNode[] = [];

  for (const resolution of resolutions) {
    if (resolution.outcome !== 'included') continue;

    const section = sections.find((s) => s.id === resolution.sectionId);
    if (!section) continue;

    try {
      const root: DocumentRoot = JSON.parse(section.nodes);
      if (root.type === 'document' && Array.isArray(root.children)) {
        children.push(...root.children);
      }
    } catch {
      // skip unparseable sections
    }
  }

  return { type: 'document', children };
}

export function composeToContent(
  template: {
    templateKind?: string | null;
    placeholders?: string[];
    fields?: { placeholder: string }[];
    sectionIds?: string[];
    transactionType?: string;
    deal?: Deal;
  },
  sections: SectionDefinition[],
  baseContent: string
): { content: string; result: CompositionResult } {
  const result = composeTemplateSections(template, sections);
  const baseRoot = parseToNodes(baseContent);
  const allChildren = [...baseRoot.children, ...result.composedNodes.children];
  const mergedRoot: DocumentRoot = { type: 'document', children: allChildren };
  const content = serializeNodes(mergedRoot);
  return { content, result };
}

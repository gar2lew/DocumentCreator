import type { CompositionDiagnostics, SectionResolution, DependencyWarning } from './types';
import type { SectionDefinition } from '../section/types';
import { COMPOSITION_RULES } from './rules';

export function buildDiagnostics(
  resolutions: SectionResolution[],
  sections: SectionDefinition[]
): CompositionDiagnostics {
  const warnings: DependencyWarning[] = [];

  for (const rule of COMPOSITION_RULES) {
    const resolution = resolutions.find((r) => r.ruleId === rule.id);
    if (!resolution || resolution.outcome !== 'included') continue;

    for (const dep of rule.dependencies) {
      const depResolved = resolutions.some(
        (r) => r.sectionType === dep && r.outcome === 'included'
      );
      if (!depResolved) {
        warnings.push({
          type: 'missing_dependency',
          sectionId: resolution.sectionId,
          sectionType: resolution.sectionType,
          message: `Section "${resolution.label}" depends on "${dep}" which is not included`,
        });
      }
    }
  }

  for (const section of sections) {
    if (section.metadata.lifecycleState === 'deprecated' || section.metadata.lifecycleState === 'sunset') {
      warnings.push({
        type: 'deprecated_section',
        sectionId: section.id,
        sectionType: section.type,
        message: `Section "${section.metadata.label}" is ${section.metadata.lifecycleState}${section.metadata.deprecationNotice ? ': ' + section.metadata.deprecationNotice : ''}`,
      });
    }
    if (!section.metadata.compatibleSchemaVersions.includes(section.schemaVersion)) {
      warnings.push({
        type: 'incompatible_version',
        sectionId: section.id,
        sectionType: section.type,
        message: `Section "${section.metadata.label}" schema v${section.schemaVersion} is not in its compatible versions list`,
      });
    }
  }

  return {
    sections: resolutions,
    warnings,
    totalSections: resolutions.length,
    includedCount: resolutions.filter((r) => r.outcome === 'included').length,
    excludedCount: resolutions.filter((r) => r.outcome === 'excluded').length,
    unresolvedCount: resolutions.filter((r) => r.outcome === 'unresolved').length,
  };
}

export function hasCompositionWarnings(diagnostics: CompositionDiagnostics): boolean {
  return diagnostics.warnings.length > 0;
}

export function getCriticalWarnings(diagnostics: CompositionDiagnostics): DependencyWarning[] {
  return diagnostics.warnings.filter((w) => w.type === 'deprecated_section' || w.type === 'incompatible_version');
}

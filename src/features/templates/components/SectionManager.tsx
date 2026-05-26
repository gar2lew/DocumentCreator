import { useState, useEffect } from "react";
import type { Template } from "../../../shared/types";
import type { SectionDefinition } from "../../documentEngine/section/types";
import { getSections, createSection, deleteSection } from "../../documentEngine/section/registry";
import { getExampleSections } from "../../documentEngine/section/examples";
import { composeTemplateSections } from "../../documentEngine/composition/engine";
import { useAppStore } from "../../../store";

interface SectionManagerProps {
  template: Template;
  onSectionIdsChange: (sectionIds: string[]) => void;
}

export function SectionManager({ template, onSectionIdsChange }: SectionManagerProps) {
  const { currentUser } = useAppStore();
  const [sections, setSections] = useState<SectionDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSeed, setShowSeed] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    getSections(currentUser.organisationId).then((s) => {
      setSections(s);
      setLoading(false);
    });
  }, [currentUser]);

  const associatedSectionIds = template.sectionIds ?? [];
  const activeSectionIds = new Set(associatedSectionIds);

  const compositionResult = composeTemplateSections(
    {
      templateKind: template.templateKind,
      placeholders: template.placeholders,
      fields: template.fields,
      sectionIds: associatedSectionIds,
    },
    sections
  );

  async function handleToggleSection(sectionId: string) {
    const next = activeSectionIds.has(sectionId)
      ? associatedSectionIds.filter((id) => id !== sectionId)
      : [...associatedSectionIds, sectionId];
    onSectionIdsChange(next);
  }

  async function handleSeedExampleSection(section: Omit<SectionDefinition, 'id' | 'organisationId' | 'createdBy' | 'createdAt' | 'updatedAt'>) {
    if (!currentUser) return;
    await createSection({
      ...section,
      organisationId: currentUser.organisationId,
      createdBy: currentUser.uid,
    });
    const updated = await getSections(currentUser.organisationId);
    setSections(updated);
  }

  async function handleDeleteSection(id: string) {
    await deleteSection(id);
    const updated = await getSections(currentUser.organisationId);
    setSections(updated);
    if (associatedSectionIds.includes(id)) {
      onSectionIdsChange(associatedSectionIds.filter((sid) => sid !== id));
    }
  }

  if (loading) {
    return <p className="text-xs text-text-tertiary">Loading sections...</p>;
  }

  const sectionsByAssociation = [
    ...sections.filter((s) => activeSectionIds.has(s.id)),
    ...sections.filter((s) => !activeSectionIds.has(s.id)),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Reusable Sections</p>
        <button
          onClick={() => setShowSeed(!showSeed)}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          {showSeed ? 'Cancel' : '+ Seed Examples'}
        </button>
      </div>

      {sections.length === 0 && (
        <p className="text-xs text-text-tertiary">No sections in registry. Seed example sections to get started.</p>
      )}

      {showSeed && (
        <div className="border border-border-secondary rounded-lg p-2 space-y-2 bg-bg-input/50">
          <p className="text-xs text-text-tertiary">Seed example sections into the registry:</p>
          {getExampleSections().map((ex, i) => (
            <button
              key={i}
              onClick={() => handleSeedExampleSection(ex)}
              className="w-full text-left text-xs px-2 py-1.5 rounded border border-border-secondary hover:border-indigo-500 transition-colors"
            >
              <span className="font-medium text-text">{ex.metadata.label}</span>
              <span className="text-text-tertiary ml-2">({ex.type})</span>
            </button>
          ))}
        </div>
      )}

      {sectionsByAssociation.map((section) => {
        const isActive = activeSectionIds.has(section.id);
        return (
          <div
            key={section.id}
            className={`flex items-center justify-between px-2 py-1.5 rounded border ${
              isActive ? 'border-indigo-500/40 bg-indigo-900/10' : 'border-border-secondary'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text truncate">{section.metadata.label}</p>
              <p className="text-[10px] text-text-tertiary truncate">{section.type} · v{section.schemaVersion}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`text-[10px] px-1 py-0.5 rounded ${
                section.metadata.lifecycleState === 'active'
                  ? 'bg-green-900/30 text-green-400'
                  : section.metadata.lifecycleState === 'deprecated'
                    ? 'bg-amber-900/30 text-amber-400'
                    : 'bg-red-900/30 text-red-400'
              }`}>
                {section.metadata.lifecycleState}
              </span>
              <button
                onClick={() => handleToggleSection(section.id)}
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400'
                    : 'bg-bg-input text-text-tertiary hover:text-text'
                }`}
              >
                {isActive ? 'Added' : 'Add'}
              </button>
              <button
                onClick={() => handleDeleteSection(section.id)}
                className="text-[10px] text-red-400 hover:text-red-300 px-1"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}

      <details className="text-xs">
        <summary className="text-text-tertiary cursor-pointer hover:text-text">
          Composition Diagnostics ({compositionResult.diagnostics.totalSections} rules)
        </summary>
        <div className="mt-2 space-y-1 pl-2">
          <p className="text-green-400">Included: {compositionResult.diagnostics.includedCount}</p>
          <p className="text-text-tertiary">Excluded: {compositionResult.diagnostics.excludedCount}</p>
          <p className="text-amber-400">Unresolved: {compositionResult.diagnostics.unresolvedCount}</p>
          {compositionResult.diagnostics.warnings.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-amber-400 font-semibold">Warnings ({compositionResult.diagnostics.warnings.length})</p>
              {compositionResult.diagnostics.warnings.map((w, i) => (
                <p key={i} className="text-amber-400/80 text-[10px]">{w.message}</p>
              ))}
            </div>
          )}
          {compositionResult.diagnostics.sections.map((r, i) => (
            <p key={i} className="text-text-tertiary text-[10px]">
              {r.outcome === 'included' ? '✓' : r.outcome === 'excluded' ? '—' : '?'} {r.label}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}

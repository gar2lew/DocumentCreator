import { useMemo } from "react";
import type { Template } from "../../../shared/types";
import { getFieldDefinitions, getComputedFieldDefinitions } from "../../documentEngine/resolver/definitions";
import { resolveFieldsWithProvenance, buildProvenanceSummary, getUnresolvedFields } from "../../documentEngine/resolver/provenance";
import { validateFieldDependencies, validateFieldKeys } from "../../documentEngine/resolver/validation";
import { extractPlaceholders } from "../../../shared/utils/placeholders";

interface ResolverDiagnosticsProps {
  template: Template;
}

export function ResolverDiagnostics({ template }: ResolverDiagnosticsProps) {
  const placeholders = extractPlaceholders(template.content);
  const fieldDefs = getFieldDefinitions();
  const computedDefs = getComputedFieldDefinitions();

  // Build data context from template placeholders for provenance demo
  const demoData: Record<string, string> = {};
  for (const p of placeholders) {
    demoData[p] = `<<${p}>>`;
  }

  const resolutions = useMemo(
    () => resolveFieldsWithProvenance(placeholders, demoData),
    [placeholders] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const unresolved = getUnresolvedFields(resolutions);
  const depValidation = validateFieldDependencies();
  const keyValidation = validateFieldKeys(placeholders);

  const summary = buildProvenanceSummary(resolutions);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Semantic Resolution</p>

      <p className="text-[10px] text-text-tertiary">{summary}</p>

      <p className="text-[10px] text-text-tertiary">
        {fieldDefs.length} defined fields · {computedDefs.length} computed · {resolutions.length} in template
      </p>

      {/* Governance health */}
      {depValidation.valid && keyValidation.valid && unresolved.length === 0 && (
        <p className="text-[10px] text-green-400">All fields governed, no validation warnings</p>
      )}

      {/* Unresolved fields */}
      {unresolved.length > 0 && (
        <details className="text-xs">
          <summary className="text-amber-400 cursor-pointer font-medium">
            Unresolved Fields ({unresolved.length})
          </summary>
          <div className="mt-1 space-y-1 pl-2">
            {unresolved.map((r) => (
              <p key={r.key} className="text-[10px] text-amber-400/80">{r.key}</p>
            ))}
          </div>
        </details>
      )}

      {/* Validation warnings */}
      {(!depValidation.valid || !keyValidation.valid) && (
        <details className="text-xs">
          <summary className="text-amber-400 cursor-pointer font-medium">
            Validation Warnings ({depValidation.warnings.length + keyValidation.warnings.length})
          </summary>
          <div className="mt-1 space-y-1 pl-2">
            {depValidation.warnings.map((w, i) => (
              <p key={i} className="text-[10px] text-amber-400/80">[{w.type}] {w.message}</p>
            ))}
            {keyValidation.warnings.map((w, i) => (
              <p key={i} className="text-[10px] text-amber-400/80">[{w.type}] {w.message}</p>
            ))}
          </div>
        </details>
      )}

      {/* All field definitions */}
      <details className="text-xs">
        <summary className="text-text-tertiary cursor-pointer hover:text-text">
          All Field Definitions ({fieldDefs.length})
        </summary>
        <div className="mt-1 space-y-1.5 pl-2">
          {fieldDefs.map((f) => {
            const inTemplate = placeholders.includes(f.key);
            const resolved = resolutions.find((r) => r.key === f.key);
            return (
              <div
                key={f.key}
                className={`text-[10px] ${inTemplate ? 'text-text' : 'text-text-tertiary'}`}
              >
                <span className="font-mono">{f.key}</span>
                <span className="text-text-tertiary ml-1">{f.label}</span>
                <span className={`ml-1 ${
                  f.source === 'computed' ? 'text-indigo-400' :
                  f.source === 'participant' ? 'text-blue-400' :
                  f.source === 'derived' ? 'text-purple-400' :
                  'text-green-400'
                }`}>
                  [{f.source}]
                </span>
                <span className="text-text-tertiary ml-1">({f.type})</span>
                {resolved && resolved.provenance.resolved && (
                  <span className="text-green-400 ml-1">✓</span>
                )}
                {f.computed && f.dependencies.length > 0 && (
                  <span className="text-text-tertiary ml-1">dep: {f.dependencies.join(', ')}</span>
                )}
              </div>
            );
          })}
        </div>
      </details>

      {/* Resolved values */}
      <details className="text-xs">
        <summary className="text-text-tertiary cursor-pointer hover:text-text">
          Resolved Values ({resolutions.length})
        </summary>
        <div className="mt-1 space-y-1 pl-2">
          {resolutions.map((r) => (
            <div key={r.key} className="text-[10px] text-text-tertiary">
              <span className="font-mono">{r.key}</span>
              <span className="ml-1">→</span>
              <span className="ml-1">{r.provenance.resolved ? r.value : '❌ unresolved'}</span>
              <span className="ml-1 text-text-tertiary">[{r.provenance.source}]</span>
              {r.provenance.formatterApplied !== 'none' && (
                <span className="ml-1 text-indigo-400">fmt: {r.provenance.formatterApplied}</span>
              )}
              {r.provenance.dependencyChain.length > 0 && (
                <span className="ml-1 text-purple-400">via: {r.provenance.dependencyChain.join(' → ')}</span>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

import { useMemo } from 'react';
import type { Template } from '../../../shared/types';
import { computeSyncDiagnostics } from '../../documentEngine/sync/synchronization';
import { detectSemanticDrift } from '../../documentEngine/sync/driftDetection';
import type { DocumentRoot } from '../../documentEngine/schema/nodeTypes';
import { CheckCircle, AlertTriangle, XCircle, Info, Layers } from 'lucide-react';

interface CanonicalitySectionProps {
  template: Template;
}

export function CanonicalitySection({ template }: CanonicalitySectionProps) {
  const info = useMemo(() => {
    const nodes = tryParseNodes(template.nodes);
    const diagnostics = computeSyncDiagnostics(template.content, nodes);
    const drift = detectSemanticDrift(template.content, nodes, template.canonicalityState);
    return { diagnostics, drift, hasNodes: !!nodes };
  }, [template.content, template.nodes, template.canonicalityState]);

  const { diagnostics, drift, hasNodes } = info;

  const canonicalityLabel = template.canonicalityState ?? 'legacy';
  const syncLabel = diagnostics.syncState;
  const driftLabel = drift.severity;

  return (
    <div className="bg-bg-tertiary rounded-md p-3 space-y-2">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
        <Layers className="w-3 h-3" /> Canonicality
      </p>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-tertiary">State</span>
          <span className={`flex items-center gap-1 font-mono ${
            canonicalityLabel === 'semantic-canonical' ? 'text-green-500'
            : canonicalityLabel === 'hybrid' ? 'text-indigo-400'
            : 'text-text-tertiary'
          }`}>
            {driftIcon(driftLabel)}
            {canonicalityLabel}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-text-tertiary">Nodes</span>
          <span className={`flex items-center gap-1 ${hasNodes ? 'text-green-500' : 'text-amber-400'}`}>
            {hasNodes ? <CheckCircle className="w-3 h-3" /> : <Info className="w-3 h-3" />}
            {hasNodes ? 'Persisted' : 'Not stored'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-text-tertiary">Sync State</span>
          <span className={`font-mono text-xs ${
            syncLabel === 'synced' ? 'text-green-500'
            : syncLabel === 'content-dirty' ? 'text-amber-400'
            : syncLabel === 'conflict' ? 'text-red-400'
            : syncLabel === 'unsyncable' ? 'text-red-400'
            : 'text-amber-400'
          }`}>
            {syncLabel}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-text-tertiary">Drift</span>
          <span className={`font-mono text-xs ${
            driftLabel === 'none' ? 'text-green-500'
            : driftLabel === 'minor' ? 'text-amber-400'
            : driftLabel === 'moderate' ? 'text-amber-400'
            : 'text-red-400'
          }`}>
            {driftLabel}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-text-tertiary">Roundtrip</span>
          <span className={`flex items-center gap-1 ${
            diagnostics.similarityRatio >= 0.99 ? 'text-green-500' : 'text-amber-400'
          }`}>
            {diagnostics.parityPassed ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {Math.round(diagnostics.similarityRatio * 100)}%
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-text-tertiary">Fields</span>
          <span className="text-text font-mono">{diagnostics.fieldCount}</span>
        </div>
      </div>

      {/* Drift summary */}
      {drift.present && (
        <div className="pt-1 border-t border-border space-y-1">
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Drift Checks</p>
          {drift.checks.filter((c) => !c.passed).map((check) => (
            <div key={check.name} className="flex items-start gap-1.5 text-[11px]">
              {driftSeverityIcon(check.severity)}
              <div>
                <span className="text-text-secondary">{check.name}</span>
                <p className="text-text-tertiary">{check.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Canonical promotion advisory */}
      {canonicalityLabel === 'legacy' && hasNodes && (
        <p className="text-[10px] text-indigo-400/80 pt-1">
          Nodes are present but canonicality is 'legacy'. Content is still canonical source of truth.
        </p>
      )}
    </div>
  );
}

function driftIcon(severity: string) {
  switch (severity) {
    case 'none': return <CheckCircle className="w-3 h-3 text-green-500" />;
    case 'minor': return <AlertTriangle className="w-3 h-3 text-amber-400" />;
    case 'moderate': return <AlertTriangle className="w-3 h-3 text-amber-400" />;
    case 'severe': return <XCircle className="w-3 h-3 text-red-400" />;
    default: return <Info className="w-3 h-3 text-blue-400" />;
  }
}

function driftSeverityIcon(severity: string) {
  switch (severity) {
    case 'none': return <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />;
    case 'minor': return <Info className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />;
    case 'moderate': return <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />;
    case 'severe': return <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />;
    default: return <Info className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />;
  }
}

function tryParseNodes(nodesJson: string | undefined): DocumentRoot | null {
  if (!nodesJson) return null;
  try {
    return JSON.parse(nodesJson);
  } catch {
    return null;
  }
}

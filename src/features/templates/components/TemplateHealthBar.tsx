import { useMemo } from 'react';
import type { Template } from '../../../shared/types';
import { extractPlaceholders } from '../../../shared/utils/placeholders';
import { FIELD_CATALOG, getDeprecatedFields } from './semanticFieldCatalog';
import { parseToNodes } from '../../documentEngine/schema/serialization';
import { isTreeValid } from '../../documentEngine/validation/nodeValidation';
import { detectSyncState, verifyRoundtrip } from '../../documentEngine/sync/synchronization';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

interface TemplateHealthBarProps {
  template: Template;
}

interface HealthMetric {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'error' | 'info';
  tooltip?: string;
}

export function TemplateHealthBar({ template }: TemplateHealthBarProps) {
  const metrics = useMemo((): HealthMetric[] => {
    const placeholders = extractPlaceholders(template.content);
    const catalogKeys = new Set(FIELD_CATALOG.map((e) => e.key));
    const knownFields = placeholders.filter((p) => catalogKeys.has(p));
    const unknownFields = placeholders.filter((p) => !catalogKeys.has(p));
    const semanticCoverage = placeholders.length > 0
      ? Math.round((knownFields.length / placeholders.length) * 100)
      : 0;

    const deprecatedFields = getDeprecatedFields(placeholders);

    let nodesValid: boolean;
    try {
      const root = parseToNodes(template.content);
      nodesValid = isTreeValid(root);
    } catch {
      nodesValid = false;
    }

    // ── Canonical readiness metrics ──
    const syncState = detectSyncState(template.content, tryParseNodes(template.nodes));
    const roundtripStable = verifyRoundtrip(template.content);

    // Compute sync state tooltip
    const syncTooltip = syncState === 'synced'
      ? 'Content and nodes are synchronized'
      : syncState === 'content-dirty'
        ? 'Content changed since last sync'
        : syncState === 'node-dirty'
          ? 'Nodes changed independently of content'
          : syncState === 'conflict'
            ? 'Content and nodes have diverged'
            : 'Content cannot be parsed to nodes';

    const canonicalityLabel = template.canonicalityState ?? 'legacy';
    const canonicalityStatus: HealthMetric['status'] =
      canonicalityLabel === 'semantic-canonical' ? 'good'
      : canonicalityLabel === 'hybrid' ? 'info'
      : 'info';

    return [
      {
        label: 'Semantic Coverage',
        value: `${semanticCoverage}%`,
        status: semanticCoverage >= 80 ? 'good' : semanticCoverage >= 50 ? 'warning' : 'info',
        tooltip: `${knownFields.length} of ${placeholders.length} fields recognized in schema registry`,
      },
      {
        label: 'Placeholders',
        value: `${placeholders.length}`,
        status: placeholders.length > 0 ? 'info' : 'good',
        tooltip: `${unknownFields.length} uncatalogued, ${deprecatedFields.length} deprecated`,
      },
      {
        label: 'Validation',
        value: nodesValid ? 'Pass' : 'Issues',
        status: nodesValid ? 'good' : 'warning',
        tooltip: nodesValid ? 'Node tree parsed without structural issues' : 'Node tree has structural warnings',
      },
      {
        label: 'Sync',
        value: syncState === 'synced' ? 'Synced' : syncState === 'content-dirty' ? 'Dirty' : syncState === 'conflict' ? 'Conflict' : syncState === 'unsyncable' ? 'Unsync' : 'Dirty',
        status: syncState === 'synced' ? 'good' : syncState === 'conflict' ? 'error' : syncState === 'unsyncable' ? 'error' : 'warning',
        tooltip: syncTooltip,
      },
      {
        label: 'Roundtrip',
        value: roundtripStable ? 'Stable' : 'Unstable',
        status: roundtripStable ? 'good' : 'warning',
        tooltip: roundtripStable ? 'Content → nodes → content is deterministic' : 'Content changes after parse/serialize roundtrip',
      },
      {
        label: 'Canonical',
        value: canonicalityLabel === 'legacy' ? 'L' : canonicalityLabel === 'hybrid' ? 'H' : 'SC',
        status: canonicalityStatus,
        tooltip: `Canonicality: ${canonicalityLabel}`,
      },
    ];
  }, [template.content, template.nodes, template.canonicalityState]);

  const statusIcon = (status: HealthMetric['status']) => {
    switch (status) {
      case 'good': return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-3 h-3 text-amber-400" />;
      case 'error': return <XCircle className="w-3 h-3 text-red-400" />;
      case 'info': return <Info className="w-3 h-3 text-blue-400" />;
    }
  };

  return (
    <div className="flex items-stretch gap-px bg-border rounded-lg overflow-hidden" title="Template health indicators">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-tertiary min-w-0"
          title={m.tooltip}
        >
          {statusIcon(m.status)}
          <span className="text-[10px] text-text-tertiary uppercase truncate">{m.label}</span>
          <span className="text-[11px] text-text font-semibold tabular-nums ml-auto">{m.value}</span>
        </div>
      ))}
    </div>
  );
}

function tryParseNodes(nodesJson: string | undefined): import('../../documentEngine/schema/nodeTypes').DocumentRoot | null {
  if (!nodesJson) return null;
  try {
    return JSON.parse(nodesJson);
  } catch {
    return null;
  }
}

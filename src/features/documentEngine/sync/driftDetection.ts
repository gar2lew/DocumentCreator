/**
 * SEMANTIC DRIFT DETECTION
 *
 * Detects divergence between content and node representations,
 * unresolved synchronization states, deprecated usage,
 * and invalid semantic persistence.
 *
 * Drift detection is NON-BLOCKING — it produces diagnostics
 * but never alters data or prevents operations.
 */

import type { DocumentRoot } from '../schema/nodeTypes';
import { parseToNodes, serializeNodes } from '../schema/serialization';
import { detectSyncState, type SyncState } from './synchronization';
import type { TemplateCanonicalityState } from '../../../shared/types';

export type DriftSeverity = 'none' | 'minor' | 'moderate' | 'severe';

export interface DriftReport {
  present: boolean;
  severity: DriftSeverity;
  syncState: SyncState;
  checks: DriftCheck[];
  summary: string;
}

export interface DriftCheck {
  name: string;
  passed: boolean;
  severity: DriftSeverity;
  message: string;
}

/**
 * Performs a comprehensive drift detection analysis.
 * Returns a report with all findings — never throws.
 */
export function detectSemanticDrift(
  content: string,
  existingNodes?: DocumentRoot | null,
  currentCanonicality?: TemplateCanonicalityState
): DriftReport {
  const checks: DriftCheck[] = [];
  const syncState = detectSyncState(content, existingNodes);

  // 1. Sync state check
  checks.push({
    name: 'Synchronization State',
    passed: syncState === 'synced',
    severity: syncState === 'synced' ? 'none'
      : syncState === 'content-dirty' || syncState === 'node-dirty' ? 'minor'
      : syncState === 'conflict' ? 'moderate'
      : 'severe',
    message: syncStateMessage(syncState),
  });

  // 2. Content parseability
  let parseable: boolean;
  let roundtripStable: boolean;
  try {
    const parsed = parseToNodes(content);
    parseable = true;
    const reserialized = serializeNodes(parsed);
    roundtripStable = content.replace(/\s+/g, ' ').trim() === reserialized.replace(/\s+/g, ' ').trim();
  } catch {
    parseable = false;
    roundtripStable = false;
  }

  checks.push({
    name: 'Content Parseability',
    passed: parseable,
    severity: parseable ? 'none' : 'severe',
    message: parseable
      ? roundtripStable
        ? 'Content parses and roundtrips deterministically'
        : 'Content parses but does not roundtrip (minor normalization differences)'
      : 'Content cannot be parsed into structured nodes',
  });

  // 3. Node persistence check (if canonicality suggests nodes should exist)
  if (currentCanonicality === 'hybrid' || currentCanonicality === 'semantic-canonical') {
    const hasNodes = existingNodes !== undefined && existingNodes !== null;
    checks.push({
      name: 'Node Persistence',
      passed: hasNodes,
      severity: hasNodes ? 'none' : 'moderate',
      message: hasNodes
        ? 'Nodes are persisted'
        : `Canonicality is "${currentCanonicality}" but no nodes are stored`,
    });
  }

  // 4. Roundtrip stability
  checks.push({
    name: 'Deterministic Roundtrip',
    passed: roundtripStable,
    severity: roundtripStable ? 'none' : 'minor',
    message: roundtripStable
      ? 'Content → nodes → content is stable'
      : 'Content changes after parse/serialize roundtrip',
  });

  // 5. Unresolved sync state
  if (syncState !== 'synced' && syncState !== 'unsyncable') {
    checks.push({
      name: 'Pending Synchronization',
      passed: false,
      severity: syncState === 'content-dirty' || syncState === 'node-dirty' ? 'minor' : 'moderate',
      message: `Synchronization is in "${syncState}" state — ${
        syncState === 'content-dirty' ? 'content changed, nodes need regeneration'
        : syncState === 'node-dirty' ? 'nodes changed, content needs regeneration'
        : 'content and nodes have diverged independently'
      }`,
    });
  }

  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.passed).length;
  const maxSeverity = checks.reduce((max, c) => {
    const order: DriftSeverity[] = ['none', 'minor', 'moderate', 'severe'];
    return order.indexOf(c.severity) > order.indexOf(max) ? c.severity : max;
  }, 'none' as DriftSeverity);

  return {
    present: checks.some((c) => !c.passed),
    severity: maxSeverity,
    syncState,
    checks,
    summary: `${passedChecks}/${totalChecks} checks passed — ${maxSeverity} drift detected`,
  };
}

function syncStateMessage(state: SyncState): string {
  switch (state) {
    case 'synced': return 'Content and nodes are synchronized';
    case 'content-dirty': return 'Content has changed since last sync (nodes need regeneration)';
    case 'node-dirty': return 'Nodes have changed independently of content';
    case 'conflict': return 'Content and nodes have diverged independently';
    case 'unsyncable': return 'Content cannot be synchronised with node representation';
  }
}

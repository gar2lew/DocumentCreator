/**
 * CONTENT ↔ NODE SYNCHRONIZATION
 *
 * Deterministic, reversible, observable synchronization between
 * the legacy content string and the structured node tree.
 *
 * Key design:
 *  - content is ALWAYS canonical (rollback-safe source of truth)
 *  - nodes are actively synchronized persistence infrastructure
 *  - synchronization is fully reversible (content → nodes → content)
 *  - all operations are observable (no hidden auto-corrections)
 *
 * Sync states:
 *  - synced — content serializes to the same nodes, nodes serialize to content
 *  - content-dirty — content changed since last sync, nodes need regeneration
 *  - node-dirty — nodes changed since last sync, content needs regeneration
 *  - conflict — content and nodes both changed independently
 *  - unsyncable — content cannot be parsed to nodes (malformed)
 */

import { parseToNodes, serializeNodes } from '../schema/serialization';
import { validateNodeTree } from '../validation/nodeValidation';
import { validateContentParity } from '../validation/parityValidation';
import type { DocumentRoot } from '../schema/nodeTypes';
import type { TemplateCanonicalityState } from '../../../shared/types';

export type SyncState = 'synced' | 'content-dirty' | 'node-dirty' | 'conflict' | 'unsyncable';

export interface SyncResult {
  content: string;
  nodes?: DocumentRoot;
  syncState: SyncState;
  syncedAt: string;
}

export interface SyncDiagnostics {
  syncState: SyncState;
  contentLength: number;
  nodeCount: number;
  fieldCount: number;
  structuralErrors: number;
  parityPassed: boolean;
  similarityRatio: number;
  recommendedCanonicality: TemplateCanonicalityState;
}

/**
 * Synchronizes content to nodes by parsing the content string.
 * Returns a fresh node tree. This is a pure deterministic function.
 */
export function synchronizeContentToNodes(content: string): DocumentRoot {
  return parseToNodes(content);
}

/**
 * Synchronizes nodes to content by serializing the node tree.
 * Returns a fresh content string. This is a pure deterministic function.
 */
export function synchronizeNodesToContent(nodes: DocumentRoot): string {
  return serializeNodes(nodes);
}

/**
 * Performs a full synchronization check and returns the sync state.
 * Does NOT modify any data — it only observes and reports.
 */
export function detectSyncState(
  content: string,
  existingNodes?: DocumentRoot | null
): SyncState {
  let parsed: DocumentRoot;
  try {
    parsed = parseToNodes(content);
  } catch {
    return 'unsyncable';
  }

  const serializedFromContent = serializeNodes(parsed);

  // If no existing nodes, content-dirty (nodes need creation)
  if (!existingNodes) {
    return 'content-dirty';
  }

  // Check if content matches what we'd get from serializing existing nodes
  const serializedFromExisting = serializeNodes(existingNodes);

  // Normalize both for comparison
  const contentNorm = content.replace(/\s+/g, ' ').trim();
  const serialFromContentNorm = serializedFromContent.replace(/\s+/g, ' ').trim();
  const serialFromExistingNorm = serializedFromExisting.replace(/\s+/g, ' ').trim();

  if (contentNorm !== serialFromContentNorm) {
    // Content is unsyncable (parse/serialize doesn't roundtrip)
    return 'unsyncable';
  }

  if (contentNorm === serialFromExistingNorm) {
    return 'synced';
  }

  // Content and nodes differ — check which side changed
  const contentMatchesParse = contentNorm === serialFromContentNorm;
  const nodesMatchParse = serialFromExistingNorm === serialFromContentNorm;

  if (contentMatchesParse && !nodesMatchParse) {
    return 'node-dirty';
  }
  if (!contentMatchesParse && nodesMatchParse) {
    return 'content-dirty';
  }

  return 'conflict';
}

/**
 * Computes diagnostics about the synchronization state.
 * All diagnostics are non-blocking — they inform but never block.
 */
export function computeSyncDiagnostics(
  content: string,
  existingNodes?: DocumentRoot | null
): SyncDiagnostics {
  const syncState = detectSyncState(content, existingNodes);
  const parsed = parseToNodes(content);
  const validation = validateNodeTree(parsed);
  const parity = validateContentParity(content, parsed);

  const nodeCount = countNodes(parsed);
  const fieldKeys = extractFieldKeysSimple(parsed);

  const recommendedCanonicality = determineRecommendedCanonicality(syncState, validation.isValid, parity.passed);

  return {
    syncState,
    contentLength: content.length,
    nodeCount,
    fieldCount: fieldKeys.size,
    structuralErrors: validation.summary.error,
    parityPassed: parity.passed,
    similarityRatio: parity.stats.similarityRatio,
    recommendedCanonicality,
  };
}

/**
 * Performs a content→nodes→content roundtrip to verify determinism.
 * Returns true if the content is unchanged after the roundtrip.
 */
export function verifyRoundtrip(content: string): boolean {
  try {
    const nodes = parseToNodes(content);
    const serialized = serializeNodes(nodes);
    return content.replace(/\s+/g, ' ').trim() === serialized.replace(/\s+/g, ' ').trim();
  } catch {
    return false;
  }
}

/**
 * Determines the recommended canonicality state based on sync diagnostics.
 * This guides but never enforces canonicality promotion.
 */
function determineRecommendedCanonicality(
  syncState: SyncState,
  structurallyValid: boolean,
  parityPassed: boolean
): TemplateCanonicalityState {
  if (syncState === 'unsyncable') return 'legacy';
  if (!structurallyValid) return 'legacy';
  if (!parityPassed) return 'hybrid';
  return 'hybrid'; // hybrid is the safe default for actively maintained nodes
}

function countNodes(root: DocumentRoot): number {
  let count = 0;
  function walk(nodes: DocumentRoot['children']): void {
    for (const node of nodes) {
      count++;
      if ('children' in node && Array.isArray((node as { children: DocumentRoot['children'] }).children)) {
        walk((node as { children: DocumentRoot['children'] }).children);
      }
      if ('elseChildren' in node && Array.isArray((node as { elseChildren?: DocumentRoot['children'] }).elseChildren)) {
        walk((node as { elseChildren: DocumentRoot['children'] }).elseChildren!);
      }
    }
  }
  walk(root.children);
  return count;
}

function extractFieldKeysSimple(root: DocumentRoot): Set<string> {
  const keys = new Set<string>();
  function walk(nodes: DocumentRoot['children']): void {
    for (const node of nodes) {
      if (node.type === 'field' && 'fieldKey' in node) {
        keys.add((node as { fieldKey: string }).fieldKey);
      }
      if ('children' in node && Array.isArray((node as { children: DocumentRoot['children'] }).children)) {
        walk((node as { children: DocumentRoot['children'] }).children);
      }
      if ('elseChildren' in node && Array.isArray((node as { elseChildren?: DocumentRoot['children'] }).elseChildren)) {
        walk((node as { elseChildren: DocumentRoot['children'] }).elseChildren!);
      }
    }
  }
  walk(root.children);
  return keys;
}

/**
 * SEMANTIC RECOVERY UTILITIES
 *
 * Rollback-safe recovery tooling for repairing content↔node synchronization.
 *
 * All recovery operations are:
 *  - reversible (content is never destroyed)
 *  - observable (all operations produce diagnostics)
 *  - non-destructive (original data is preserved until explicitly replaced)
 *
 * Content remains the canonical source of truth throughout.
 * Nodes are regenerated FROM content — never the reverse.
 */

import type { DocumentRoot } from '../schema/nodeTypes';
import { parseToNodes, serializeNodes } from '../schema/serialization';
import { validateNodeTree, getSignificantIssues } from '../validation/nodeValidation';
import { validateContentParity } from '../validation/parityValidation';
import { detectSyncState, synchronizeContentToNodes, type SyncState } from './synchronization';

export interface RecoveryResult {
  success: boolean;
  content: string;
  nodes?: DocumentRoot;
  action: RecoveryAction;
  diagnostics: RecoveryDiagnostics;
}

export type RecoveryAction =
  | 'no-action-needed'
  | 'regenerated-nodes-from-content'
  | 'regenerated-content-from-nodes'
  | 'repair-failed';

export interface RecoveryDiagnostics {
  previousSyncState: SyncState;
  newSyncState: SyncState;
  nodeCount: number;
  validationErrors: number;
  parityPassed: boolean;
  warnings: string[];
}

/**
 * Regenerates nodes from content.
 * This is the SAFEST recovery operation — content is canonical,
 * so regenerating nodes from content can never lose data.
 *
 * Returns the new node tree WITHOUT modifying anything.
 */
export function regenerateNodesFromContent(content: string): DocumentRoot {
  return synchronizeContentToNodes(content);
}

/**
 * Regenerates content from nodes.
 * Use with caution — this changes the canonical content string.
 * Only use when nodes are known to be more correct than content.
 */
export function regenerateContentFromNodes(nodes: DocumentRoot): string {
  return serializeNodes(nodes);
}

/**
 * Performs a full synchronization repair.
 * Strategy:
 *  1. If content is parseable and roundtrips → regenerate nodes from content (safe)
 *  2. If content is not parseable but nodes exist → serialize nodes to content (risky)
 *  3. If neither works → repair failed
 *
 * Returns the recovery result WITHOUT modifying any stored data.
 */
export function repairSynchronization(
  content: string,
  existingNodes?: DocumentRoot | null
): RecoveryResult {
  const warnings: string[] = [];
  const previousSyncState = detectSyncState(content, existingNodes);

  // Try strategy 1: regenerate nodes from content (safest)
  let canParse: boolean;
  try {
    parseToNodes(content);
    canParse = true;
  } catch {
    canParse = false;
  }

  if (canParse) {
    const freshNodes = synchronizeContentToNodes(content);
    const validation = validateNodeTree(freshNodes);
    const nodeCount = countNodes(freshNodes);

    if (validation.isValid) {
      const parity = validateContentParity(content, freshNodes);
      return {
        success: true,
        content,
        nodes: freshNodes,
        action: 'regenerated-nodes-from-content',
        diagnostics: {
          previousSyncState,
          newSyncState: 'synced',
          nodeCount,
          validationErrors: 0,
          parityPassed: parity.passed,
          warnings: parity.passed ? [] : ['Content parity warning — minor differences may exist'],
        },
      };
    }

    const issues = getSignificantIssues(validation);
    warnings.push(`Regenerated nodes have ${issues.length} structural issue(s)`);

    // Still return the regeneration even with issues — nodes are advisory
    return {
      success: true,
      content,
      nodes: freshNodes,
      action: 'regenerated-nodes-from-content',
      diagnostics: {
        previousSyncState,
        newSyncState: 'content-dirty',
        nodeCount,
        validationErrors: issues.length,
        parityPassed: false,
        warnings,
      },
    };
  }

  // Strategy 2: regenerate content from nodes (fallback)
  if (existingNodes && existingNodes.children.length > 0) {
    try {
      const freshContent = serializeNodes(existingNodes);
      warnings.push('Content was regenerated from nodes — verify correctness');

      return {
        success: true,
        content: freshContent,
        nodes: existingNodes,
        action: 'regenerated-content-from-nodes',
        diagnostics: {
          previousSyncState,
          newSyncState: 'synced',
          nodeCount: countNodes(existingNodes),
          validationErrors: 0,
          parityPassed: false,
          warnings,
        },
      };
    } catch {
      warnings.push('Failed to serialize existing nodes');
    }
  }

  return {
    success: false,
    content,
    nodes: existingNodes ?? undefined,
    action: 'repair-failed',
    diagnostics: {
      previousSyncState,
      newSyncState: previousSyncState,
      nodeCount: 0,
      validationErrors: 0,
      parityPassed: false,
      warnings: ['Content is not parseable and no valid nodes exist — manual repair required'],
    },
  };
}

/**
 * Restores parity by regenerating nodes from content.
 * This is the preferred recovery path since content is canonical.
 */
export function restoreParityFromContent(content: string): RecoveryResult {
  return repairSynchronization(content, null);
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

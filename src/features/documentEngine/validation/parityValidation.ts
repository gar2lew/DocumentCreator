/**
 * DUAL-PERSISTENCE PARITY VALIDATION
 *
 * Compares serialized node output with raw content output
 * to verify that the structured node tree faithfully represents
 * the original content.
 *
 * Parity validation is used for:
 *  - migration safety checks
 *  - rollback confidence
 *  - semantic integrity verification
 *  - ensuring the node tree roundtrips correctly
 *
 * Validation is NON-BLOCKING — it produces diagnostics and
 * never alters rendered output.
 */

import type { DocumentRoot } from '../schema/nodeTypes';
import { parseToNodes, serializeNodes } from '../schema/serialization';

/**
 * Result of a parity comparison between raw content and node output.
 */
export interface ParityResult {
  /** Whether the comparison passed (no significant differences) */
  passed: boolean;
  /** Detailed differences found */
  differences: ParityDifference[];
  /** Statistical summary */
  stats: ParityStats;
}

/**
 * A single difference between raw content and node output.
 */
export interface ParityDifference {
  /** Human-readable description */
  description: string;
  /** The type of difference */
  type: 'whitespace' | 'ordering' | 'structure' | 'content' | 'missing_node' | 'extra_node';
  /** Portion of raw content involved (for context) */
  expected?: string;
  /** Portion of node output involved (for context) */
  actual?: string;
  /** Severity — content differences are more severe than whitespace */
  severity: 'info' | 'warning' | 'error';
}

/**
 * Statistical summary of a parity check.
 */
export interface ParityStats {
  /** Total character count of original content */
  originalLength: number;
  /** Total character count of serialized node output */
  serializedLength: number;
  /** Character-level similarity ratio (0-1, 1 = identical) */
  similarityRatio: number;
  /** Number of field keys extracted from the node tree */
  fieldCount: number;
}

/**
 * Compares raw template content with the serialized output of a
 * parsed-and-serialized node tree.
 *
 * This checks that the node parser and serializer faithfully
 * reproduce the original content without data loss.
 *
 * @param content — Original template content string
 * @param root — Parsed DocumentRoot (if already parsed, skips parsing)
 * @returns ParityResult with comparison details
 */
export function validateContentParity(
  content: string,
  root?: DocumentRoot
): ParityResult {
  const differences: ParityDifference[] = [];

  // Parse if not already provided
  const nodeRoot = root ?? parseToNodes(content);
  const serialized = serializeNodes(nodeRoot);

  // Basic character count comparison
  const originalTrimmed = content.trim();
  const serializedTrimmed = serialized.trim();

  if (originalTrimmed.length !== serializedTrimmed.length) {
    differences.push({
      description: `Content length differs: original=${originalTrimmed.length}, serialized=${serializedTrimmed.length}`,
      type: 'content',
      severity: originalTrimmed.length === serializedTrimmed.length ? 'info' : 'warning',
      expected: content,
      actual: serialized,
    });
  }

  // Exact match check
  if (originalTrimmed !== serializedTrimmed) {
    // Check if only whitespace differs
    const originalNorm = originalTrimmed.replace(/\s+/g, ' ').trim();
    const serializedNorm = serializedTrimmed.replace(/\s+/g, ' ').trim();

    if (originalNorm === serializedNorm) {
      differences.push({
        description: 'Content matches after normalizing whitespace — only spacing differences',
        type: 'whitespace',
        severity: 'info',
      });
    } else {
      // Find the first point of difference
      const minLen = Math.min(originalNorm.length, serializedNorm.length);
      let diffIndex = 0;
      while (diffIndex < minLen && originalNorm[diffIndex] === serializedNorm[diffIndex]) {
        diffIndex++;
      }

      differences.push({
        description: `Content differs at character ${diffIndex}`,
        type: 'content',
        severity: 'warning',
        expected: originalNorm.slice(Math.max(0, diffIndex - 20), diffIndex + 40),
        actual: serializedNorm.slice(Math.max(0, diffIndex - 20), diffIndex + 40),
      });
    }
  }

  // Check for structural parity (same number of <<key>> tokens)
  const originalTokens = content.match(/<<([^>>]+)>>/g) || [];
  const serializedTokens = serialized.match(/<<([^>>]+)>>/g) || [];

  if (originalTokens.length !== serializedTokens.length) {
    differences.push({
      description: `Token count differs: original=${originalTokens.length}, serialized=${serializedTokens.length}`,
      type: 'structure',
      severity: 'warning',
    });
  }

  // Check for token-level differences
  const originalTokenSet = new Set(originalTokens.map(normalizeToken));
  const serializedTokenSet = new Set(serializedTokens.map(normalizeToken));

  for (const token of originalTokenSet) {
    if (!serializedTokenSet.has(token)) {
      differences.push({
        description: `Token "${token}" present in original but missing from serialized output`,
        type: 'missing_node',
        severity: 'warning',
        expected: token,
      });
    }
  }

  for (const token of serializedTokenSet) {
    if (!originalTokenSet.has(token)) {
      differences.push({
        description: `Token "${token}" present in serialized output but not in original`,
        type: 'extra_node',
        severity: 'warning',
        actual: token,
      });
    }
  }

  // Compute stats
  const stats: ParityStats = {
    originalLength: content.length,
    serializedLength: serialized.length,
    similarityRatio: computeSimilarity(content, serialized),
    fieldCount: extractFieldKeysSimple(nodeRoot),
  };

  return {
    passed: differences.filter((d) => d.severity === 'error').length === 0,
    differences,
    stats,
  };
}

/**
 * Normalizes a <<token>> to a comparable form.
 */
function normalizeToken(token: string): string {
  return token.replace(/<<(.+?)>>/, '$1').trim().toLowerCase();
}

/**
 * Extracts field keys from a node tree (simple version to avoid circular deps).
 */
function extractFieldKeysSimple(root: DocumentRoot): number {
  const keys = new Set<string>();
  function walk(nodes: any[]): void {
    for (const node of nodes) {
      if (node.type === 'field') keys.add(node.fieldKey);
      if (node.children) walk(node.children);
      if (node.elseChildren) walk(node.elseChildren);
    }
  }
  walk(root.children);
  return keys.size;
}

/**
 * Computes a character-level similarity ratio between two strings.
 * Uses a simplified approach (character bigram overlap).
 * Returns 0-1 where 1 = identical.
 */
function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      set.add(s.slice(i, i + 2));
    }
    return set;
  };

  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  const union = bigramsA.size + bigramsB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

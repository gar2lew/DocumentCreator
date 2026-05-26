/**
 * RENDER PARITY TOOLING
 *
 * Compares legacy render output with semantic render output
 * for the same content and data.
 *
 * Used for:
 *  - rollout validation (verifying semantic render matches legacy)
 *  - migration governance (ensuring migrated content still renders correctly)
 *  - deterministic verification (catching regressions)
 *  - future canonical promotion readiness
 *
 * Parity checks are INTERNAL INFRASTRUCTURE only.
 * They are not exposed in the rendering pipeline and
 * never affect rendered output.
 */

import type { DocumentRoot } from '../schema/nodeTypes';
import { parseToNodes } from '../schema/serialization';
import { renderNodesToText, type PlaceholderData } from '../schema/renderSemantics';
import { applyPlaceholders } from '../../../shared/utils/placeholders';

/**
 * Result of a render parity comparison.
 */
export interface RenderParityResult {
  /** Whether the outputs match exactly */
  passed: boolean;
  /** The rendering mode that was used */
  mode: 'semantic' | 'legacy';
  /** Legacy render output */
  legacyOutput: string;
  /** Semantic render output */
  semanticOutput: string;
  /** Human-readable comparison report */
  report: RenderParityReport;
}

/**
 * Detailed render parity report.
 */
export interface RenderParityReport {
  /** Whether outputs are byte-identical */
  match: boolean;
  /** Character-level similarity ratio (0-1) */
  similarity: number;
  /** Output length of legacy render */
  legacyLength: number;
  /** Output length of semantic render */
  semanticLength: number;
  /** Tokens that appear in legacy output but not semantic */
  legacyOnlyTokens: string[];
  /** Tokens that appear in semantic output but not legacy */
  semanticOnlyTokens: string[];
  /** First position where outputs diverge (-1 if identical) */
  firstDifference: number;
}

/**
 * Compares the output of the legacy renderer and the semantic
 * renderer for the same content and data.
 *
 * Both paths are always executed regardless of the result,
 * ensuring both can be inspected independently.
 *
 * @param content — Template content string
 * @param data — Rendering context
 * @param root — Optional pre-parsed DocumentRoot (skips parsing if provided)
 * @returns RenderParityResult with comparison details
 */
export function compareRenderOutput(
  content: string,
  data: PlaceholderData,
  root?: DocumentRoot
): RenderParityResult {
  // Legacy path — always safe
  const legacyOutput = applyPlaceholders(content, data);

  // Semantic path
  let semanticOutput: string;
  let mode: 'semantic' | 'legacy';

  try {
    const nodeRoot = root ?? parseToNodes(content);
    semanticOutput = renderNodesToText(nodeRoot, data);
    mode = 'semantic';
  } catch {
    semanticOutput = legacyOutput;
    mode = 'legacy';
  }

  // Build comparison report
  const report = buildParityReport(legacyOutput, semanticOutput);

  return {
    passed: report.match,
    mode,
    legacyOutput,
    semanticOutput,
    report,
  };
}

/**
 * Builds a detailed comparison report between two render outputs.
 */
function buildParityReport(
  legacy: string,
  semantic: string
): RenderParityReport {
  const match = legacy === semantic;

  // Find first difference position
  let firstDifference = -1;
  if (!match) {
    const minLen = Math.min(legacy.length, semantic.length);
    for (let i = 0; i < minLen; i++) {
      if (legacy[i] !== semantic[i]) {
        firstDifference = i;
        break;
      }
    }
    if (firstDifference === -1 && legacy.length !== semantic.length) {
      firstDifference = minLen;
    }
  }

  // Extract unresolved tokens from each output
  const legacyTokens = extractTokens(legacy);
  const semanticTokens = extractTokens(semantic);

  const legacyOnlyTokens = legacyTokens.filter((t) => !semanticTokens.includes(t));
  const semanticOnlyTokens = semanticTokens.filter((t) => !legacyTokens.includes(t));

  return {
    match,
    similarity: computeSimilarityRatio(legacy, semantic),
    legacyLength: legacy.length,
    semanticLength: semantic.length,
    legacyOnlyTokens,
    semanticOnlyTokens,
    firstDifference,
  };
}

/**
 * Extracts unresolved <<key>> tokens from a rendered string.
 */
function extractTokens(output: string): string[] {
  const tokens: string[] = [];
  const regex = /<<([^>>]+)>>/g;
  let m;
  while ((m = regex.exec(output)) !== null) {
    tokens.push(m[1].trim().toLowerCase());
  }
  return [...new Set(tokens)];
}

/**
 * Computes a similarity ratio between two strings.
 * Returns 0-1 where 1 = identical.
 */
function computeSimilarityRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const distance = levenshteinDistance(a.slice(0, 1000), b.slice(0, 1000));
  return 1 - distance / Math.max(a.length, b.length, 1);
}

/**
 * Computes Levenshtein distance between two strings.
 * Operates on the first 1000 characters for performance.
 */
function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  const matrix: number[] = [];

  for (let i = 0; i <= bn; i++) matrix[i] = i;
  for (let i = 1; i <= an; i++) {
    let prev = i;
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(
        matrix[j] + 1,
        prev + 1,
        matrix[j - 1] + cost
      );
      matrix[j - 1] = prev;
      prev = val;
    }
    matrix[bn] = prev;
  }
  return matrix[bn];
}

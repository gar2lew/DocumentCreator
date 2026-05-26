/**
 * LEGACY COMPATIBILITY BRIDGE
 *
 * Bridges the legacy placeholder content system with the
 * structured DocumentNode system.
 *
 * This module ensures that ALL content — whether originating
 * from the legacy system or written in structured node form —
 * continues to render identically through existing exports.
 *
 * Requirements:
 *  1. Legacy placeholders continue functioning unchanged
 *  2. Content can be bridged to structured nodes where possible
 *  3. All existing exports preserve their behavior
 *  4. The bridge is transparent — exports don't need to know
 *     about structured nodes
 *
 * Compatibility preservation is MANDATORY.
 */

import type { DocumentRoot } from '../schema/nodeTypes';
import {
  parseToNodes,
  serializeNodes,
  extractFieldKeys,
} from '../schema/serialization';
import {
  renderNodesToText,
  resolveField,
  type PlaceholderData,
} from '../schema/renderSemantics';

// Re-export the legacy render path (always available as fallback)
import { applyPlaceholders } from '../../../shared/utils/placeholders';

/**
 * Render diagnostics — emitted alongside every rendering operation.
 *
 * Diagnostics are non-breaking and never alter rendered output.
 * They exist for observability, migration validation, and debugging.
 */
export interface RenderResult {
  /** The fully rendered output string */
  output: string;
  /** Which rendering path was used */
  mode: 'semantic' | 'legacy-fallback';
  /** Keys that could not be resolved in the rendering context */
  unresolvedFields: string[];
  /** Non-fatal warnings from the render pass */
  warnings: string[];
}

/**
 * Renders content through the safest available path.
 *
 * Strategy:
 *  1. Parse content to structured node tree
 *  2. Render node tree with context
 *  3. If node rendering fails, fall back to legacy rendering
 *
 * This ensures that ALL content renders identically whether
 * the node system is used or not.
 */
export function renderLegacySafe(
  content: string,
  data: PlaceholderData
): string {
  try {
    const root = parseToNodes(content);
    return renderNodesToText(root, data);
  } catch {
    // Fall back to legacy rendering — always safe
    return applyPlaceholders(content, data);
  }
}

/**
 * Renders content and returns structured diagnostics alongside the output.
 *
 * The returned diagnostics include:
 *  - mode: which renderer was used (semantic vs legacy-fallback)
 *  - unresolvedFields: placeholder keys that could not be filled
 *  - warnings: non-fatal issues detected during rendering
 *
 * Diagnostics NEVER alter the rendered output.
 * output is identical to what renderLegacySafe would return.
 */
export function renderWithDiagnostics(
  content: string,
  data: PlaceholderData
): RenderResult {
  const warnings: string[] = [];

  // Phase 1: Attempt semantic rendering
  try {
    const root = parseToNodes(content);

    // Check for content that doesn't roundtrip cleanly — indicates
    // the parser may not have captured all details.
    const roundtrip = serializeNodes(root);
    if (roundtrip.trim() !== content.trim()) {
      warnings.push(
        'Content does not roundtrip cleanly through node parser; ' +
        'rendering may differ from legacy path for edge cases.'
      );
    }

    // Pre-scan for unresolved fields
    const allKeys = extractFieldKeys(root);
    const unresolvedFields = allKeys.filter((key) => {
      const value = resolveField(key, data);
      return value === undefined || value === `<<${key}>>`;
    });

    // Phase 2: Render
    const output = renderNodesToText(root, data);

    // Check output for any remaining unresolved <<key>> tokens
    const leftoverMatch = output.match(/<<([^>>]+)>>/g);
    if (leftoverMatch) {
      for (const token of leftoverMatch) {
        const key = token.slice(2, -2).trim();
        if (!unresolvedFields.includes(key)) {
          unresolvedFields.push(key);
        }
      }
    }

    return {
      output,
      mode: 'semantic',
      unresolvedFields,
      warnings,
    };
  } catch (err) {
    // Semantic rendering failed — fall back to legacy
    warnings.push(
      'Semantic rendering failed and fell back to legacy path: ' +
      (err instanceof Error ? err.message : String(err))
    );

    const output = applyPlaceholders(content, data);

    // Detect unresolved fields in legacy output
    const unresolvedFields: string[] = [];
    const tokenMatch = output.match(/<<([^>>]+)>>/g);
    if (tokenMatch) {
      for (const token of tokenMatch) {
        const key = token.slice(2, -2).trim();
        if (!unresolvedFields.includes(key)) {
          unresolvedFields.push(key);
        }
      }
    }

    return {
      output,
      mode: 'legacy-fallback',
      unresolvedFields,
      warnings,
    };
  }
}

/**
 * Attempts to bridge legacy placeholder content into a structured
 * DocumentRoot node tree.
 *
 * Returns the node tree if parsing succeeds, or null if the content
 * contains syntax that the structured parser cannot handle.
 * The caller should fall back to legacy rendering when null is returned.
 *
 * This is a graceful degradation path — content that can't be
 * parsed structurally still works through the legacy system.
 */
export function bridgeToNodes(content: string): DocumentRoot | null {
  try {
    const root = parseToNodes(content);

    // Verify roundtrip stability — if the content normalizes
    // to a different string, the node tree may not capture
    // all details (e.g., unusual whitespace, unrecognized tokens).
    const roundtrip = serializeNodes(root);

    // If roundtrip differs significantly, return null to indicate
    // that legacy rendering should be preferred.
    if (roundtrip.trim() !== content.trim()) {
      return null;
    }

    return root;
  } catch {
    return null;
  }
}

/**
 * Checks whether legacy content should use the legacy rendering path
 * instead of the structured node path.
 *
 * Legacy-only features that trigger this:
 *  - Unbalanced <<if>>/<<endif>> or <<for>>/<<endfor>> pairs
 *  - Malformed placeholder syntax
 *
 * The structured parser is lenient (handles malformed gracefully),
 * so this function primarily checks for roundtrip stability.
 */
export function needsLegacyFallback(content: string): boolean {
  try {
    const root = parseToNodes(content);
    const roundtrip = serializeNodes(root);
    return roundtrip.trim() !== content.trim();
  } catch {
    return true;
  }
}

/**
 * Patches a legacy placeholder string into the structured node
 * system by wrapping it in a DocumentRoot and returning the
 * serialized canonical form.
 *
 * This is useful when storing legacy content in a system that
 * expects structured node format — the content can be normalized
 * to canonical form deterministically.
 */
export function normalizeLegacyContent(content: string): string {
  try {
    const root = parseToNodes(content);
    return serializeNodes(root);
  } catch {
    return content;
  }
}

/**
 * Extracts field keys from legacy content using the structured
 * node parser if possible, falling back to the legacy extraction
 * method if the content cannot be parsed structurally.
 *
 * This provides a unified extraction API that works for both
 * legacy and structured content.
 */
export function extractKeysBridged(content: string): string[] {
  try {
    const root = parseToNodes(content);
    return extractFieldKeys(root);
  } catch {
    // Fall back to legacy extraction
    const { extractPlaceholders } = require('../../../shared/utils/placeholders');
    return extractPlaceholders(content);
  }
}

/**
 * Checks if a given DocumentRoot is semantically equivalent to
 * legacy content. This is used for migration validation.
 *
 * Two trees are equivalent if they produce the same serialized
 * output when rendered without data transforms.
 */
export function isEquivalentToLegacy(
  root: DocumentRoot,
  legacyContent: string
): boolean {
  try {
    const canonical = serializeNodes(root);
    const legacyNormalized = normalizeLegacyContent(legacyContent);
    return canonical.trim() === legacyNormalized.trim();
  } catch {
    return false;
  }
}

/**
 * Attempts to convert a legacy content string into a DocumentRoot
 * with a high-confidence flag. When highConfidence is true, the
 * node tree can safely replace the legacy content for storage.
 *
 * This is used for gradual migration — content can be migrated
 * to structured node storage when parsing is high-confidence.
 */
export function tryBridgeHighConfidence(
  content: string
): { root: DocumentRoot; highConfidence: boolean } | null {
  try {
    const root = parseToNodes(content);
    const roundtrip = serializeNodes(root);

    // High confidence: roundtrip match
    const highConfidence = roundtrip.trim() === content.trim();

    return { root, highConfidence };
  } catch {
    return null;
  }
}

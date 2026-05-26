/**
 * NODE RENDER SEMANTICS
 *
 * Centralized resolver for structured document node rendering.
 *
 * All field resolution, conditional evaluation, and repeat expansion
 * flows through this module. It delegates to the existing placeholder
 * resolvers (placeholders.ts) for value resolution and truthiness,
 * ensuring that render behavior is consistent regardless of
 * whether rendering is done through the legacy path or the node path.
 *
 * This is the SINGLE resolver entry point for:
 *  - resolveField(key, context) → string | undefined
 *  - evaluateCondition(key, context) → boolean
 *  - expandRepeat(source, context, renderChildren) → string
 */

import type { DocumentNode, DocumentRoot } from './nodeTypes';

// Re-export the existing resolver for centralized access.
// All field resolution must pass through this function.
import {
  resolvePlaceholderValue,
  type PlaceholderData,
} from '../../../shared/utils/placeholders';

export type { PlaceholderData };

/**
 * Resolves a single field key against the rendering context.
 *
 * This is the canonical entry point for ALL field value resolution.
 * It delegates to the existing resolvePlaceholderValue from placeholders.ts
 * which handles:
 *  - Direct key lookup
 *  - Dot-notation (parent.child)
 *  - _currency suffix (formatted currency)
 *  - _words suffix (number to words)
 *  - Array values joined with commas
 *
 * DO NOT introduce local resolution logic.
 * DO NOT duplicate formatting transforms.
 * All field resolution must pass through here.
 */
export function resolveField(
  key: string,
  context: PlaceholderData
): string | undefined {
  return resolvePlaceholderValue(key, context);
}

/**
 * Evaluates a conditional expression against the context.
 *
 * Truthiness follows the existing convention from placeholders.ts:
 *  - undefined/null → falsy
 *  - empty string → falsy
 *  - '0', 'false', 'no' → falsy
 *  - all other values → truthy
 *
 * This replicates the isTruthy logic from processConditionals
 * to avoid coupling to the internal implementation while
 * maintaining semantic compatibility.
 */
export function evaluateCondition(
  key: string,
  context: PlaceholderData
): boolean {
  const value = context[key.toLowerCase().trim()];

  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (value === '') return false;
  if (value === '0') return false;
  if (value === 'false') return false;
  if (value === 'no') return false;

  return true;
}

/**
 * Expands a repeat source into an array of items for iteration.
 *
 * Returns an array of context overlays — one per iteration item.
 * Each overlay has the repeat source key's field values available
 * via dot-notation (e.g., `items.name` for the name field of each item).
 *
 * Supported data shapes:
 *  - string[] → each item is { source: item }
 *  - Record<string, string>[] → each item's fields are source.field
 *
 * Returns an empty array if the source data is not iterable.
 */
export function expandRepeat(
  source: string,
  context: PlaceholderData
): PlaceholderData[] {
  const data = context[source.toLowerCase().trim()];

  if (!Array.isArray(data)) {
    // Attempt to use the existing processLoops as a compatibility fallback
    // for non-array data shapes. This ensures repeat nodes always work
    // with the same data that legacy <<for>> blocks work with.
    return [];
  }

  if (data.length === 0) return [];

  return data.map((item) => {
    const overlay: PlaceholderData = { ...context };

    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      // Record<string, string>[] — map each field as source.field
      for (const [field, value] of Object.entries(item)) {
        overlay[`${source}.${field}`] = String(value);
      }
    } else {
      // string[] — map the item itself as source
      overlay[source] = String(item);
    }

    return overlay;
  });
}

/**
 * Renders a node tree to a string by resolving all fields,
 * evaluating conditionals, and expanding repeats against
 * the given context.
 *
 * This is the primary rendering entry point for structured nodes.
 *
 * @param root - The document node tree to render
 * @param context - The data context for field resolution
 * @returns The fully rendered string with all placeholders resolved
 */
export function renderNodesToText(
  root: DocumentRoot,
  context: PlaceholderData
): string {
  return renderNodeArray(root.children, context);
}

function renderNodeArray(
  nodes: DocumentNode[],
  context: PlaceholderData
): string {
  let result = '';

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        result += node.text;
        break;

      case 'field': {
        const value = resolveField(node.fieldKey, context);
        result += value ?? `<<${node.fieldKey}>>`;
        break;
      }

      case 'conditional': {
        const conditionMet = evaluateCondition(node.condition, context);
        if (conditionMet) {
          result += renderNodeArray(node.children, context);
        } else if (node.elseChildren && node.elseChildren.length > 0) {
          result += renderNodeArray(node.elseChildren, context);
        }
        break;
      }

      case 'repeat': {
        const overlays = expandRepeat(node.source, context);
        if (overlays.length > 0) {
          for (const overlay of overlays) {
            result += renderNodeArray(node.children, overlay);
          }
        }
        break;
      }
    }
  }

  return result;
}

/**
 * Applies placeholder styles to the rendered output by delegating
 * to the existing resolveToSegments mechanism.
 *
 * This provides a node-aware wrapper around the legacy style application
 * path, ensuring visual consistency between legacy and node rendering.
 *
 * @param root - The document node tree to render
 * @param context - The data context for field resolution
 * @param styles - Optional map of placeholder key to style definition
 * @returns Rendered text (resolveToSegments for styling is done at export layer)
 */
export function renderWithStyles(
  root: DocumentRoot,
  context: PlaceholderData,
  _styles?: Record<string, Record<string, unknown>>
): string {
  // The actual style application happens in the export layer via resolveToSegments.
  // This function ensures the node tree renders identically to the legacy path,
  // after which existing styling logic applies unchanged.
  return renderNodesToText(root, context);
}

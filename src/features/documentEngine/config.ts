/**
 * DOCUMENT ENGINE CONFIGURATION
 *
 * Feature flags and configuration for the structured document node system.
 *
 * The ENABLE_SEMANTIC_NODES flag controls whether TipTap editor
 * extensions for field/conditional/repeat nodes are registered.
 *
 * When disabled (default):
 *  - Editor renders placeholders as plain text tokens (<<key>>)
 *  - All rendering flows through legacy-safe bridge layer
 *
 * When enabled:
 *  - Editor renders field nodes as styled inline chips
 *  - Conditional and repeat blocks get visual indicators
 *  - Rendering still flows through the same bridge layer
 *
 * Enabling semantic nodes is for isolated testing and rendering
 * parity validation only. It does NOT change:
 *  - Storage schema
 *  - Export behavior
 *  - Content format
 *  - Resolver logic
 */

/**
 * Master feature flag for semantic node rendering in the editor.
 *
 * false  — editor renders placeholder tokens as plain text (default, production-safe)
 * true   — editor uses registered node extensions for semantic rendering (testing only)
 *
 * Toggle via environment variable or direct assignment.
 * In production, this MUST be false unless explicitly validated.
 */
export const ENABLE_SEMANTIC_NODES: boolean =
  import.meta.env?.VITE_ENABLE_SEMANTIC_NODES === 'true' || false;

/**
 * Returns the list of document engine TipTap extensions if semantic
 * nodes are enabled, or an empty array if they are disabled.
 *
 * This allows downstream editor configuration to conditionally include
 * these extensions without importing them directly and checking the flag.
 */
export function getSemanticNodeExtensions() {
  if (!ENABLE_SEMANTIC_NODES) return [];

  // Dynamic import ensures the extensions module is only loaded when
  // semantic nodes are enabled, preserving production bundle size.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { documentEngineExtensions } = require('./editor/tiptapNodes');
  return documentEngineExtensions;
}

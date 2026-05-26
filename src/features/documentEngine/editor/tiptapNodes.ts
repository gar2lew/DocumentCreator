/**
 * TIPTAP SEMANTIC NODE EXTENSIONS
 *
 * Foundational TipTap node definitions for structured document nodes.
 *
 * These extensions establish the semantic node types in the TipTap
 * editor context WITHOUT:
 *  - Rebuilding the editor UI
 *  - Fully redesigning the editing experience
 *  - Tightly coupling the schema to TipTap internals
 *
 * TipTap is an editing surface, NOT schema truth.
 * The canonical document representation is the DocumentNode tree.
 *
 * These extensions register node types that a future migration
 * can use to render structured nodes inline, but for now they
 * are groundwork only — content continues to be edited as
 * plain text with <<placeholder>> tokens.
 *
 * USAGE NOTE:
 * These extensions are NOT yet added to the active editor configuration.
 * They are registered here so that future editor initialization can
 * import and include them. Current editing continues through the
 * existing RichTextEditor component using StarterKit.
 */

import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Field node extension.
 *
 * Renders an inline field reference. In the current phase,
 * this node type exists for future use when the editor
 * transitions from raw placeholder text to structured nodes.
 *
 * The field node displays the fieldKey prominently and
 * is not editable inline (it represents a reference, not content).
 */
export const FieldNodeExtension = Node.create({
  name: 'fieldNode',

  group: 'inline',

  inline: true,

  selectable: true,

  draggable: false,

  atom: true,

  addAttributes() {
    return {
      fieldKey: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-field-key'),
        renderHTML: (attrs) => ({
          'data-field-key': attrs.fieldKey,
          'data-node-type': 'field',
        }),
      },
      display: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-display'),
        renderHTML: (attrs) => ({
          'data-display': attrs.display,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-node-type="field"]',
        getAttrs: (el) => {
          if (typeof el === 'string') return false;
          return {
            fieldKey: (el as HTMLElement).getAttribute('data-field-key'),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const key = node.attrs.fieldKey || 'unknown';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class:
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-900/40 text-indigo-300 text-xs font-mono border border-indigo-700/50',
        title: `Field: ${key}`,
      }),
      `<<${key}>>`,
    ];
  },
});

/**
 * Conditional block node extension.
 *
 * Renders a block-level conditional section. In the current phase,
 * this is a wrapper node that contains the condition's content and
 * renders with a visual indicator.
 */
export const ConditionalNodeExtension = Node.create({
  name: 'conditionalNode',

  group: 'block',

  content: 'block+',

  defining: true,

  addAttributes() {
    return {
      condition: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-condition'),
        renderHTML: (attrs) => ({
          'data-condition': attrs.condition,
          'data-node-type': 'conditional',
        }),
      },
      hasElse: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-has-else') === 'true',
        renderHTML: (attrs) => ({
          'data-has-else': attrs.hasElse ? 'true' : 'false',
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-node-type="conditional"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const condition = node.attrs.condition || 'unknown';
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class:
          'relative border-l-2 border-amber-600/50 pl-3 my-2',
        'data-condition': condition,
      }),
      [
        'div',
        {
          class:
            'text-xs text-amber-400/80 font-mono mb-1',
        },
        `<<if ${condition}>>`,
      ],
      ['div', { class: 'conditional-content' }, 0],
    ];
  },
});

/**
 * Repeating section node extension.
 *
 * Renders a block-level repeating section. In the current phase,
 * this is a wrapper node with a visual indicator that the content
 * repeats for each item in the data source.
 */
export const RepeatNodeExtension = Node.create({
  name: 'repeatNode',

  group: 'block',

  content: 'block+',

  defining: true,

  addAttributes() {
    return {
      source: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-source'),
        renderHTML: (attrs) => ({
          'data-source': attrs.source,
          'data-node-type': 'repeat',
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-node-type="repeat"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const source = node.attrs.source || 'unknown';
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class:
          'relative border-l-2 border-cyan-600/50 pl-3 my-2',
        'data-source': source,
      }),
      [
        'div',
        {
          class:
            'text-xs text-cyan-400/80 font-mono mb-1',
        },
        `<<for ${source}>>`,
      ],
      ['div', { class: 'repeat-content' }, 0],
    ];
  },
});

/**
 * A "document" wrapper node that mirrors DocumentRoot.
 * This allows TipTap to represent an entire document node tree
 * as a single structured document.
 */
export const DocumentRootExtension = Node.create({
  name: 'documentRoot',

  group: 'block',

  content: 'block+',

  parseHTML() {
    return [
      {
        tag: 'div[data-node-type="document-root"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-node-type': 'document-root',
      }),
      0,
    ];
  },
});

/**
 * Convenience array of all document engine node extensions.
 * Use this when configuring TipTap for structured document editing.
 */
export const documentEngineExtensions = [
  FieldNodeExtension,
  ConditionalNodeExtension,
  RepeatNodeExtension,
  DocumentRootExtension,
];

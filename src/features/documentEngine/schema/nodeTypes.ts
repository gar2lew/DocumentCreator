/**
 * STRUCTURED NODE TYPES
 *
 * Schema-native document node definitions.
 * These are editor-agnostic pure data types representing
 * the semantic structure of a document template.
 */

/**
 * A plain text segment. Never contains placeholder syntax.
 */
export interface TextNode {
  type: 'text';
  text: string;
}

/**
 * A field reference node. Resolves to a value from
 * the rendering context at render time.
 *
 * Field nodes support:
 *  - dot-notation key resolution (parent.child)
 *  - _currency suffix for formatted currency output
 *  - _words suffix for number-to-words output
 */
export interface FieldNode {
  type: 'field';
  fieldKey: string;
  display?: string;
}

/**
 * A conditional block node. Its children are only rendered
 * when the condition field evaluates as truthy.
 *
 * When condition is falsy, elseChildren (if present) are rendered instead.
 *
 * Truthiness follows the existing convention:
 *  - undefined/null → falsy
 *  - empty string → falsy
 *  - '0', 'false', 'no' → falsy
 *  - all other values → truthy
 */
export interface ConditionalNode {
  type: 'conditional';
  condition: string;
  children: DocumentNode[];
  elseChildren?: DocumentNode[];
}

/**
 * A repeating section node. Its children are rendered once
 * per item in the source array from the rendering context.
 *
 * Inside the repeat block, child FieldNode references can use
 * dot-notation (source.field) to access item properties.
 */
export interface RepeatNode {
  type: 'repeat';
  source: string;
  children: DocumentNode[];
}

/**
 * A root document node. Wraps a sequence of child nodes.
 */
export interface DocumentRoot {
  type: 'document';
  children: DocumentNode[];
}

/**
 * Discriminated union of all document node types.
 */
export type DocumentNode =
  | TextNode
  | FieldNode
  | ConditionalNode
  | RepeatNode;

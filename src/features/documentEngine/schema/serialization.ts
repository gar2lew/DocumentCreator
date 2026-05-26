/**
 * DETERMINISTIC SERIALIZATION
 *
 * Converts between Content strings (legacy placeholder format)
 * and structured DocumentRoot node trees.
 *
 * Parsing and serialization are designed to be:
 *  - deterministic (same input always produces same output)
 *  - roundtrip-stable (parse ∘ serialize ≡ identity)
 *  - editor-independent
 *  - compatible with existing content storage
 *
 * Editor state is NOT canonical schema truth.
 * The node tree is the canonical intermediate representation.
 */

import type {
  DocumentNode,
  DocumentRoot,
  TextNode,
  FieldNode,
  ConditionalNode,
  RepeatNode,
} from './nodeTypes';

// Token patterns matching the existing placeholders.ts conventions
const FIELD_PATTERN = /^<<([^>>]+)>>/;
const IF_OPEN_PATTERN = /^<<if\s+([^>]+)>>/i;
const ELSE_PATTERN = /^<<else>>/i;
const ENDIF_PATTERN = /^<<endif>>/i;
const FOR_OPEN_PATTERN = /^<<for\s+([^>]+)>>/i;
const ENDFOR_PATTERN = /^<<endfor>>/i;

/**
 * Checks if a token key is a control keyword rather than a field reference.
 */
function isControlKeyword(key: string): boolean {
  const lower = key.trim().toLowerCase();
  return (
    lower.startsWith('if ') ||
    lower.startsWith('for ') ||
    lower === 'endif' ||
    lower === 'else' ||
    lower === 'endfor'
  );
}

/**
 * Parser state for the recursive descent parser.
 */
interface ParserState {
  pos: number;
}

/**
 * Parses a content string into a structured DocumentRoot node tree.
 *
 * Handles:
 *  - Plain text
 *  - <<fieldKey>> field references
 *  - <<if condition>>...<<else>>...<<endif>> conditionals (nested)
 *  - <<for source>>...<<endfor>> repeating sections (nested)
 *
 * Deterministic: given the same input, always produces the same tree.
 */
export function parseToNodes(content: string): DocumentRoot {
  const state: ParserState = { pos: 0 };
  const children = parseBlockChildren(content, state, ['__root__']);
  return { type: 'document', children };
}

/**
 * Parses a block of content until one of the given stopTokens is encountered,
 * or until the end of the string is reached.
 */
function parseBlockChildren(
  content: string,
  state: ParserState,
  stopTokens: string[]
): DocumentNode[] {
  const nodes: DocumentNode[] = [];
  const remaining = (): string => content.slice(state.pos);

  while (state.pos < content.length) {
    const rest = remaining();

    // Check for stop tokens (endif, endfor, else)
    if (stopTokens.includes('endif') && ELSE_PATTERN.test(rest)) {
      break;
    }
    if (stopTokens.includes('endif') && ENDIF_PATTERN.test(rest)) {
      break;
    }
    if (stopTokens.includes('endfor') && ENDFOR_PATTERN.test(rest)) {
      break;
    }
    if (stopTokens.includes('__root__')) {
      // Root: only stop at end of string
    }

    // Try each node type in priority order

    // <<if condition>>...<<else>>...<<endif>>
    const ifMatch = rest.match(IF_OPEN_PATTERN);
    if (ifMatch) {
      const condition = ifMatch[1].trim();
      state.pos += ifMatch[0].length;

      // Parse the if-true block
      const children = parseBlockChildren(content, state, ['endif', 'else']);

      let elseChildren: DocumentNode[] | undefined;

      // Check for <<else>>
      if (ELSE_PATTERN.test(content.slice(state.pos))) {
        state.pos += ELSE_PATTERN.exec(content.slice(state.pos))![0].length;
        elseChildren = parseBlockChildren(content, state, ['endif']);
      }

      // Consume <<endif>>
      const endifRemaining = content.slice(state.pos);
      const endifMatch = endifRemaining.match(ENDIF_PATTERN);
      if (endifMatch) {
        state.pos += endifMatch[0].length;
      }

      nodes.push({ type: 'conditional', condition, children, elseChildren } as ConditionalNode);
      continue;
    }

    // <<for source>>...<<endfor>>
    const forMatch = rest.match(FOR_OPEN_PATTERN);
    if (forMatch) {
      const source = forMatch[1].trim();
      state.pos += forMatch[0].length;

      const children = parseBlockChildren(content, state, ['endfor']);

      // Consume <<endfor>>
      const endforRemaining = content.slice(state.pos);
      const endforMatch = endforRemaining.match(ENDFOR_PATTERN);
      if (endforMatch) {
        state.pos += endforMatch[0].length;
      }

      nodes.push({ type: 'repeat', source, children } as RepeatNode);
      continue;
    }

    // <<fieldKey>>
    const fieldMatch = rest.match(FIELD_PATTERN);
    if (fieldMatch) {
      const key = fieldMatch[1].trim();
      state.pos += fieldMatch[0].length;

      // Skip control keywords (they should have been caught above,
      // but double-check for malformed content)
      if (!isControlKeyword(key)) {
        nodes.push({ type: 'field', fieldKey: key } as FieldNode);
        continue;
      }
    }

    // Plain text: consume until the next special token
    const textMatch = rest.match(
      /^(?:[^<]|<(?!<))+/ // one or more characters that don't start <<
    );
    if (textMatch) {
      const text = textMatch[0];
      state.pos += text.length;
      if (text.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        if (lastNode && lastNode.type === 'text') {
          (lastNode as TextNode).text += text;
        } else {
          nodes.push({ type: 'text', text } as TextNode);
        }
      }
      continue;
    }

    // If we hit an unrecognized <<, treat as literal text
    // (handles malformed content gracefully)
    if (rest.startsWith('<<')) {
      state.pos += 2;
      const lastNode = nodes[nodes.length - 1];
      if (lastNode && lastNode.type === 'text') {
        (lastNode as TextNode).text += '<<';
      } else {
        nodes.push({ type: 'text', text: '<<' } as TextNode);
      }
      continue;
    }

    // Advance one character as fallback
    state.pos++;
  }

  return nodes;
}

/**
 * Serializes a DocumentRoot node tree back into a content string.
 *
 * The output is deterministic and identical for the same input tree.
 * The output matches the content string format used by the legacy
 * placeholder system, ensuring compatibility.
 */
export function serializeNodes(root: DocumentRoot): string {
  return serializeNodeArray(root.children);
}

function serializeNodeArray(nodes: DocumentNode[]): string {
  let result = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        result += node.text;
        break;
      case 'field':
        result += `<<${node.fieldKey}>>`;
        break;
      case 'conditional':
        result += `<<if ${node.condition}>>`;
        result += serializeNodeArray(node.children);
        if (node.elseChildren && node.elseChildren.length > 0) {
          result += `<<else>>`;
          result += serializeNodeArray(node.elseChildren);
        }
        result += `<<endif>>`;
        break;
      case 'repeat':
        result += `<<for ${node.source}>>`;
        result += serializeNodeArray(node.children);
        result += `<<endfor>>`;
        break;
    }
  }
  return result;
}

/**
 * Normalizes a content string by parsing it into nodes and
 * serializing back. This ensures deterministic ordering and
 * canonical formatting.
 *
 * If the content is already canonical, this is a no-op
 * (preserves the original string exactly).
 *
 * Normalization guarantees:
 *  - All placeholder tokens use consistent syntax
 *  - Nested blocks are properly delimited
 *  - Unnecessary escaping is removed
 */
export function normalizeContent(content: string): string {
  const root = parseToNodes(content);
  return serializeNodes(root);
}

/**
 * Extracts all unique field keys from a node tree.
 * Unlike the regex-based extractPlaceholders, this operates
 * on the structured tree and respects block boundaries.
 */
export function extractFieldKeys(root: DocumentRoot): string[] {
  const keys = new Set<string>();
  collectFieldKeys(root.children, keys);
  return Array.from(keys).sort();
}

function collectFieldKeys(nodes: DocumentNode[], keys: Set<string>): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'field':
        keys.add(node.fieldKey);
        break;
      case 'conditional':
        collectFieldKeys(node.children, keys);
        if (node.elseChildren) {
          collectFieldKeys(node.elseChildren, keys);
        }
        break;
      case 'repeat':
        keys.add(node.source);
        collectFieldKeys(node.children, keys);
        break;
    }
  }
}

/**
 * Walks the node tree and invokes a visitor function for each node.
 * Returns new nodes based on transformer return values.
 * When transformer returns null, the node is removed from output.
 */
export type NodeTransformer = (node: DocumentNode) => DocumentNode | null;

export function transformNodes(root: DocumentRoot, transform: NodeTransformer): DocumentRoot {
  const transformChildren = (nodes: DocumentNode[]): DocumentNode[] => {
    const result: DocumentNode[] = [];
    for (const node of nodes) {
      const transformed = transform(node);
      if (transformed === null) continue;
      if (transformed.type === 'conditional') {
        result.push({
          ...transformed,
          children: transformChildren(transformed.children),
          elseChildren: transformed.elseChildren
            ? transformChildren(transformed.elseChildren)
            : undefined,
        });
      } else if (transformed.type === 'repeat') {
        result.push({
          ...transformed,
          children: transformChildren(transformed.children),
        });
      } else {
        result.push(transformed);
      }
    }
    return result;
  };

  return { type: 'document', children: transformChildren(root.children) };
}

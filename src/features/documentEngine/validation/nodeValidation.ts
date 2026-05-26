/**
 * STRUCTURAL NODE VALIDATION
 *
 * Validates a DocumentRoot node tree for structural integrity.
 *
 * Checks performed:
 *  - Unknown or malformed field references
 *  - Invalid conditional structures (empty condition, missing children)
 *  - Malformed repeat nodes (empty source)
 *  - Unsupported node types not in the DocumentNode union
 *  - Illegal nesting (e.g., DocumentRoot inside a field)
 *
 * Validation is NON-BLOCKING — it produces warnings and diagnostics
 * but never throws. Rendered output is unaffected by validation results.
 */

import type { DocumentNode, DocumentRoot } from '../schema/nodeTypes';
import { extractFieldKeys } from '../schema/serialization';

/**
 * Severity level for a validation issue.
 */
export type ValidationSeverity = 'info' | 'warning' | 'error';

/**
 * A single validation issue found during tree inspection.
 */
export interface ValidationIssue {
  /** Path to the node with the issue (human-readable, e.g. "children[2].children[0]") */
  path: string;
  /** The issue severity */
  severity: ValidationSeverity;
  /** Human-readable description */
  message: string;
  /** The node type where the issue was found */
  nodeType: DocumentNode['type'] | 'unknown';
  /** Optional field key or condition/source reference */
  reference?: string;
}

/**
 * Result of a validation pass.
 */
export interface ValidationResult {
  /** All issues found during validation */
  issues: ValidationIssue[];
  /** Count of issues by severity */
  summary: {
    info: number;
    warning: number;
    error: number;
  };
  /** Whether the tree has no errors (warnings and info are acceptable) */
  isValid: boolean;
}

/**
 * Options for validation behavior.
 */
export interface ValidationOptions {
  /** If true, perform deep recursion checks (default: true) */
  deep?: boolean;
  /** If true, check for duplicate field keys (default: false) */
  checkDuplicates?: boolean;
  /** Known valid field keys — used to detect unknown references */
  knownFields?: Set<string>;
}

/**
 * Validates a DocumentRoot node tree for structural integrity.
 *
 * This function NEVER throws. All findings are returned as
 * structured diagnostics.
 *
 * @param root — The document node tree to validate
 * @param options — Optional validation configuration
 * @returns ValidationResult with all issues found
 */
export function validateNodeTree(
  root: DocumentRoot,
  options: ValidationOptions = {}
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const deep = options.deep !== false;

  if (root.type !== 'document') {
    issues.push({
      path: '<root>',
      severity: 'error',
      message: `Root node must have type "document", got "${root.type}"`,
      nodeType: 'unknown',
    });
  }

  if (!Array.isArray(root.children)) {
    issues.push({
      path: '<root>',
      severity: 'error',
      message: 'Root node must have a children array',
      nodeType: 'unknown',
    });
    return summarize(issues);
  }

  if (deep) {
    validateNodeArray(root.children, 'children', issues, options);
  }

  // Check for duplicate field keys if requested
  if (options.checkDuplicates) {
    const keys = new Set<string>();
    const duplicates = new Set<string>();
    const allKeys = extractFieldKeys(root);
    for (const key of allKeys) {
      if (keys.has(key)) duplicates.add(key);
      keys.add(key);
    }
    for (const dup of duplicates) {
      issues.push({
        path: '<root>',
        severity: 'warning',
        message: `Duplicate field key: "${dup}"`,
        nodeType: 'field',
        reference: dup,
      });
    }
  }

  // Check for unknown field references
  if (options.knownFields && options.knownFields.size > 0) {
    const allKeys = extractFieldKeys(root);
    for (const key of allKeys) {
      if (!options.knownFields.has(key)) {
        issues.push({
          path: '<root>',
          severity: 'info',
          message: `Unknown field reference: "${key}" (not in known fields)`,
          nodeType: 'field',
          reference: key,
        });
      }
    }
  }

  return summarize(issues);
}

/**
 * Recursively validates an array of DocumentNodes.
 */
function validateNodeArray(
  nodes: DocumentNode[],
  path: string,
  issues: ValidationIssue[],
  options: ValidationOptions
): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodePath = `${path}[${i}]`;
    validateSingleNode(node, nodePath, issues, options);
  }
}

/**
 * Validates a single DocumentNode.
 */
function validateSingleNode(
  node: DocumentNode,
  path: string,
  issues: ValidationIssue[],
  options: ValidationOptions
): void {
  switch (node.type) {
    case 'text':
      // Text nodes are always valid
      break;

    case 'field':
      validateFieldNode(node, path, issues);
      break;

    case 'conditional':
      validateConditionalNode(node, path, issues, options);
      break;

    case 'repeat':
      validateRepeatNode(node, path, issues, options);
      break;

    default:
      issues.push({
        path,
        severity: 'error',
        message: `Unknown node type: "${(node as any).type}"`,
        nodeType: 'unknown',
      });
      break;
  }
}

/**
 * Validates a FieldNode.
 */
function validateFieldNode(
  node: { fieldKey: string; display?: string },
  path: string,
  issues: ValidationIssue[]
): void {
  if (!node.fieldKey || node.fieldKey.trim() === '') {
    issues.push({
      path,
      severity: 'error',
      message: 'Field node has an empty fieldKey',
      nodeType: 'field',
    });
  }

  // Field keys should not contain special characters that conflict with
  // the legacy placeholder syntax. This is an info-level check.
  if (node.fieldKey && /[<>&]/.test(node.fieldKey)) {
    issues.push({
      path,
      severity: 'warning',
      message: `Field key "${node.fieldKey}" contains characters that may conflict with legacy syntax`,
      nodeType: 'field',
      reference: node.fieldKey,
    });
  }
}

/**
 * Validates a ConditionalNode.
 */
function validateConditionalNode(
  node: { condition: string; children: DocumentNode[]; elseChildren?: DocumentNode[] },
  path: string,
  issues: ValidationIssue[],
  options: ValidationOptions
): void {
  if (!node.condition || node.condition.trim() === '') {
    issues.push({
      path,
      severity: 'error',
      message: 'Conditional node has an empty condition',
      nodeType: 'conditional',
    });
  }

  if (!Array.isArray(node.children)) {
    issues.push({
      path,
      severity: 'error',
      message: 'Conditional node must have a children array',
      nodeType: 'conditional',
    });
  }

  if (node.children && options.deep) {
    validateNodeArray(node.children, `${path}.children`, issues, options);
  }

  if (node.elseChildren) {
    if (!Array.isArray(node.elseChildren)) {
      issues.push({
        path,
        severity: 'error',
        message: 'Conditional node elseChildren must be an array',
        nodeType: 'conditional',
      });
    } else if (options.deep) {
      validateNodeArray(node.elseChildren, `${path}.elseChildren`, issues, options);
    }
  }
}

/**
 * Validates a RepeatNode.
 */
function validateRepeatNode(
  node: { source: string; children: DocumentNode[] },
  path: string,
  issues: ValidationIssue[],
  options: ValidationOptions
): void {
  if (!node.source || node.source.trim() === '') {
    issues.push({
      path,
      severity: 'error',
      message: 'Repeat node has an empty source',
      nodeType: 'repeat',
    });
  }

  if (!Array.isArray(node.children)) {
    issues.push({
      path,
      severity: 'error',
      message: 'Repeat node must have a children array',
      nodeType: 'repeat',
    });
  }

  if (node.children && options.deep) {
    validateNodeArray(node.children, `${path}.children`, issues, options);
  }
}

/**
 * Summarizes validation results.
 */
function summarize(issues: ValidationIssue[]): ValidationResult {
  const summary = { info: 0, warning: 0, error: 0 };

  for (const issue of issues) {
    summary[issue.severity]++;
  }

  return {
    issues,
    summary,
    isValid: summary.error === 0,
  };
}

/**
 * Convenience: returns true if the tree has no errors.
 * Does NOT throw — safe for use in rendering paths.
 */
export function isTreeValid(root: DocumentRoot, options?: ValidationOptions): boolean {
  return validateNodeTree(root, options).isValid;
}

/**
 * Convenience: returns only warning and error issues.
 */
export function getSignificantIssues(root: DocumentRoot, options?: ValidationOptions): ValidationIssue[] {
  const result = validateNodeTree(root, options);
  return result.issues.filter((i) => i.severity !== 'info');
}

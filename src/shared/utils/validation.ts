import { extractPlaceholders, applyPlaceholders, normalizePlaceholderData } from './placeholders';
import type { Template } from '../types';

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

function isMissingResolvedValue(resolved: string, key: string): boolean {
  return resolved === `<<${key}>>` || resolved.trim() === '';
}

/**
 * Validates that all <<placeholder>> values are filled before export.
 * Returns errors for empty required fields and warnings for optional patterns.
 */
export function validateExport(
  template: Template,
  allData: Record<string, string>
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const normalizedData = normalizePlaceholderData(allData);

  // Check text content and uploaded DOCX placeholders
  const keys = new Set([
    ...extractPlaceholders(template.content),
    ...(template.type === 'docx' ? template.placeholders ?? [] : []),
  ]);
  for (const key of keys) {
    const resolved = applyPlaceholders(`<<${key}>>`, normalizedData);
    if (isMissingResolvedValue(resolved, key)) {
      // Still has its original placeholder — not filled
      issues.push({
        field: key,
        message: `<<${key}>> has no value`,
        severity: 'error',
      });
    }
  }

  // Check PDF field placeholders
  if (template.type === 'pdf') {
    for (const field of template.fields) {
      if (field.placeholder) {
        const resolved = applyPlaceholders(field.placeholder, normalizedData);
        if (resolved.includes('<<') || resolved.trim() === '') {
          issues.push({
            field: field.name,
            message: `PDF field "${field.name}" placeholder ${field.placeholder} is unfilled`,
            severity: 'error',
          });
        }
      }
    }

    if (!template.pdfStoragePath) {
      issues.push({
        field: 'pdf_source',
        message: 'No PDF source uploaded — export will generate a blank PDF',
        severity: 'warning',
      });
    }
  }

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
  };
}

/**
 * Checks that a template has at least a name and some content before saving.
 */
export function validateTemplate(name: string, content: string): string | null {
  if (!name.trim()) return 'Template name is required';
  if (content.trim().length < 10) return 'Template content is too short';
  return null;
}

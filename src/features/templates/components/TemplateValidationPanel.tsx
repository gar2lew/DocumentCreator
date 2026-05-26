import { useMemo } from 'react';
import type { Template } from '../../../shared/types';
import { extractPlaceholders, extractConditionalKeys, extractLoopKeys } from '../../../shared/utils/placeholders';
import { parseToNodes } from '../../documentEngine/schema/serialization';
import { validateNodeTree, getSignificantIssues } from '../../documentEngine/validation/nodeValidation';
import { getFieldByKey, getDeprecatedFields } from './semanticFieldCatalog';
import { needsMigration, getMigrationsInRange } from '../../documentEngine/migrations/pipeline';
import { CURRENT_SCHEMA_VERSION } from '../../documentEngine/schema/templateDocument';
import { AlertTriangle, Info, XCircle, AlertCircle, ChevronRight } from 'lucide-react';

interface TemplateValidationPanelProps {
  template: Template;
}

interface ValidationGroup {
  title: string;
  iconName: 'alert-circle' | 'x-circle' | 'info' | 'alert-triangle';
  items: { message: string; severity: 'error' | 'warning' | 'info' }[];
}

export function TemplateValidationPanel({ template }: TemplateValidationPanelProps) {
  const groups = useMemo((): ValidationGroup[] => {
    const result: ValidationGroup[] = [];
    const placeholders = extractPlaceholders(template.content);
    const conditionalKeys = extractConditionalKeys(template.content);
    const loopKeys = extractLoopKeys(template.content);

    // ── Structural validation via node tree ──
    let parseFailed = false;
    let parseResult: { issues: { message: string; severity: string; nodePath?: string }[] } | null = null;
    try {
      const root = parseToNodes(template.content);
      const validation = validateNodeTree(root);
      const issues = getSignificantIssues(validation.issues);
      if (issues.length > 0) {
        parseResult = { issues };
      }
    } catch {
      parseFailed = true;
    }
    if (parseFailed) {
      result.push({
        title: 'Parse Error',
        iconName: 'x-circle',
        items: [{ message: 'Content could not be parsed as nodes', severity: 'warning' }],
      });
    } else if (parseResult) {
      result.push({
        title: 'Structural Issues',
        iconName: 'alert-circle',
        items: parseResult.issues.map((i) => ({
          message: `${i.message}${i.nodePath ? ` (at ${i.nodePath})` : ''}`,
          severity: i.severity === 'error' ? 'error' : 'warning',
        })),
      });
    }

    // ── Unresolved fields ──
    const unresolved = placeholders.filter((p) => !getFieldByKey(p));
    if (unresolved.length > 0) {
      result.push({
        title: `Unresolved Fields (${unresolved.length})`,
        iconName: 'info',
        items: unresolved.map((key) => ({
          message: `<<${key}>> — not in schema registry`,
          severity: 'info' as const,
        })),
      });
    }

    // ── Deprecated fields ──
    const deprecated = getDeprecatedFields(placeholders);
    if (deprecated.length > 0) {
      result.push({
        title: `Deprecated Fields (${deprecated.length})`,
        iconName: 'alert-triangle',
        items: deprecated.map((f) => ({
          message: `<<${f.key}>>${f.deprecationNotice ? ` — ${f.deprecationNotice}` : ''}`,
          severity: 'warning' as const,
        })),
      });
    }

    // ── Condition diagnostics ──
    const conditionIssues = conditionalKeys.filter((k) => !getFieldByKey(k) && !placeholders.includes(k));
    if (conditionIssues.length > 0) {
      result.push({
        title: 'Condition Diagnostics',
        iconName: 'info',
        items: conditionIssues.map((key) => ({
          message: `<<if ${key}>> — condition field not in registry`,
          severity: 'info' as const,
        })),
      });
    }

    // ── Loop diagnostics ──
    const loopIssues = loopKeys.filter((k) => !getFieldByKey(k) && !placeholders.includes(k));
    if (loopIssues.length > 0) {
      result.push({
        title: 'Repeat Diagnostics',
        iconName: 'info',
        items: loopIssues.map((key) => ({
          message: `<<for ${key}>> — repeat source not in registry`,
          severity: 'info' as const,
        })),
      });
    }

    // ── Migration advisories ──
    const schemaVer = template.schemaVersion ?? 1;
    if (needsMigration(schemaVer)) {
      const available = getMigrationsInRange(schemaVer, CURRENT_SCHEMA_VERSION);
      result.push({
        title: 'Migration Available',
        iconName: 'info',
        items: available.map((m) => ({
          message: `v${m.targetVersion}: ${m.name}`,
          severity: 'info' as const,
        })),
      });
    }

    // ── All clear ──
    if (result.length === 0) {
      result.push({
        title: 'All Clear',
        iconName: 'alert-circle',
        items: [{ message: 'No validation issues detected', severity: 'info' }],
      });
    }

    // ── Loop diagnostics ──
    const loopIssues = loopKeys.filter((k) => !getFieldByKey(k) && !placeholders.includes(k));
    if (loopIssues.length > 0) {
      result.push({
        title: 'Repeat Diagnostics',
        icon: <Info className="w-3.5 h-3.5 text-blue-400" />,
        items: loopIssues.map((key) => ({
          message: `<<for ${key}>> — repeat source not in registry`,
          severity: 'info' as const,
        })),
      });
    }

    // ── Migration advisories ──
    const schemaVer = template.schemaVersion ?? 1;
    if (needsMigration(schemaVer)) {
      const available = getMigrationsInRange(schemaVer, CURRENT_SCHEMA_VERSION);
      result.push({
        title: 'Migration Available',
        iconName: 'info',
        items: available.map((m) => ({
          message: `v${m.targetVersion}: ${m.name}`,
          severity: 'info' as const,
        })),
      });
    }

    // ── All clear ──
    if (result.length === 0) {
      result.push({
        title: 'All Clear',
        iconName: 'alert-circle',
        items: [{ message: 'No validation issues detected', severity: 'info' }],
      });
    }

    return result;
  }, [template.content, template.schemaVersion]);

  const summaryLine = useMemo(() => {
    const errors = groups.reduce((s, g) => s + g.items.filter((i) => i.severity === 'error').length, 0);
    const warnings = groups.reduce((s, g) => s + g.items.filter((i) => i.severity === 'warning').length, 0);
    const infos = groups.reduce((s, g) => s + g.items.length, 0);
    if (errors > 0) return { text: `${errors} error${errors > 1 ? 's' : ''}`, status: 'error' as const };
    if (warnings > 0) return { text: `${warnings} warning${warnings > 1 ? 's' : ''}`, status: 'warning' as const };
    return { text: `${infos} item${infos > 1 ? 's' : ''}`, status: 'good' as const };
  }, [groups]);

  const statusDot = (status: 'error' | 'warning' | 'good') => {
    switch (status) {
      case 'error': return 'bg-red-400';
      case 'warning': return 'bg-amber-400';
      case 'good': return 'bg-green-500';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${statusDot(summaryLine.status)}`} />
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Validation</span>
        <span className="text-[10px] text-text-tertiary">{summaryLine.text}</span>
      </div>

      {groups.map((group) => {
        const iconEl = group.iconName === 'alert-circle'
          ? <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          : group.iconName === 'x-circle'
            ? <XCircle className="w-3.5 h-3.5 text-red-400" />
            : group.iconName === 'alert-triangle'
              ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              : <Info className="w-3.5 h-3.5 text-blue-400" />;
        return (
          <details key={group.title} className="bg-bg-tertiary rounded-md overflow-hidden">
            <summary className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer hover:bg-bg-secondary transition-colors text-xs text-text-secondary">
              <ChevronRight className="w-3 h-3 text-text-tertiary shrink-0" />
              {iconEl}
              <span className="font-medium">{group.title}</span>
              <span className="text-text-tertiary ml-auto">({group.items.length})</span>
            </summary>
            <div className="px-2.5 pb-2 space-y-1">
              {group.items.map((item, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                  {item.severity === 'error' ? (
                    <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                  ) : item.severity === 'warning' ? (
                    <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                  ) : (
                    <Info className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
                  )}
                  <span className="text-text-tertiary">{item.message}</span>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

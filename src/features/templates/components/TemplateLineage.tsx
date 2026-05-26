import { useMemo } from 'react';
import type { Template } from '../../../shared/types';
import { GitBranch, ArrowRight, FileText } from 'lucide-react';

interface TemplateLineageProps {
  template: Template;
  templates: Template[];
}

export function TemplateLineage({ template, templates }: TemplateLineageProps) {
  const ancestors = useMemo(() => {
    const chain: Template[] = [];
    let currentId = template.createdFrom;
    let maxDepth = 10;
    while (currentId && maxDepth > 0) {
      const ancestor = templates.find((t) => t.id === currentId);
      if (ancestor) {
        chain.push(ancestor);
        currentId = ancestor.createdFrom;
      } else {
        break;
      }
      maxDepth--;
    }
    return chain;
  }, [template.createdFrom, templates]);

  if (!template.createdFrom && ancestors.length === 0) {
    return (
      <div className="bg-bg-tertiary rounded-md p-3 space-y-2">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
          <GitBranch className="w-3 h-3" /> Lineage
        </p>
        <p className="text-[11px] text-text-tertiary">Original template — no ancestry recorded.</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-tertiary rounded-md p-3 space-y-2">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
        <GitBranch className="w-3 h-3" /> Lineage
      </p>
      <div className="space-y-1">
        {ancestors.length > 0 && (
          <div className="space-y-1 mb-2">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Ancestors</p>
            {ancestors.map((a) => (
              <div key={a.id} className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
                <FileText className="w-3 h-3 shrink-0 text-text-tertiary" />
                <span className="truncate">{a.name}</span>
                <span className="text-[10px] text-text-tertiary ml-auto">v{a.currentVersion}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px]">
          <FileText className="w-3 h-3 text-indigo-400 shrink-0" />
          <span className="text-text font-medium truncate">{template.name}</span>
          <ArrowRight className="w-3 h-3 text-text-tertiary shrink-0" />
          <span className="text-text-tertiary shrink-0">v{template.currentVersion}</span>
        </div>

        <div className="text-[10px] text-text-tertiary pt-1 space-y-0.5">
          <div className="flex justify-between">
            <span>Created</span>
            <span>{template.createdAt.toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Updated</span>
            <span>{template.updatedAt.toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Schema Version</span>
            <span className="font-mono">v{template.schemaVersion ?? 1}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

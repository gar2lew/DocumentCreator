import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTemplates } from '../features/templates/hooks/useTemplates';
import { extractPlaceholders } from '../shared/utils/placeholders';
import { ArrowLeft, FileText, Search } from 'lucide-react';

export function TemplateVariablesLibrary() {
  const navigate = useNavigate();
  const { templates } = useTemplates();
  const [search, setSearch] = useState('');

  const allVariables = useMemo(() => {
    const map = new Map<string, { templates: Set<string>; count: number }>();

    for (const template of templates) {
      const placeholders = template.placeholders?.length
        ? template.placeholders
        : extractPlaceholders(template.content);

      for (const key of placeholders) {
        const existing = map.get(key) ?? { templates: new Set(), count: 0 };
        existing.templates.add(template.name);
        existing.count++;
        map.set(key, existing);
      }
    }

    return Array.from(map.entries())
      .map(([key, data]) => ({
        key,
        templates: Array.from(data.templates),
        count: data.count,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [templates]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allVariables;
    const q = search.toLowerCase();
    return allVariables.filter(
      (v) => v.key.toLowerCase().includes(q) || v.templates.some((t) => t.toLowerCase().includes(q))
    );
  }, [allVariables, search]);

  const totalPlaceholders = allVariables.length;
  const totalTemplates = new Set(allVariables.flatMap((v) => v.templates)).size;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-bg-secondary border-b border-border shrink-0">
        <button
          onClick={() => navigate('/templates')}
          className="text-text-tertiary hover:text-text p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-text">Template Variables Library</h1>
      </div>

      {/* Stats */}
      <div className="px-6 py-4 bg-bg-secondary border-b border-border shrink-0">
        <div className="flex gap-6">
          <div>
            <p className="text-2xl font-bold text-text">{totalPlaceholders}</p>
            <p className="text-xs text-text-tertiary">Unique variables</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-text">{totalTemplates}</p>
            <p className="text-xs text-text-tertiary">Templates using variables</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3 bg-bg-secondary border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search variables or templates..."
            className="w-full bg-bg-input border border-border-secondary rounded-lg pl-10 pr-4 py-2 text-text text-sm placeholder:text-text-tertiary focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Variables list */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
            <p className="text-text-secondary">
              {search ? 'No variables match your search.' : 'No templates found.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((variable) => (
              <div
                key={variable.key}
                className="bg-bg-secondary border border-border rounded-xl p-4 hover:border-border-secondary transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-semibold text-indigo-400 truncate">
                      &lt;&lt;{variable.key}&gt;&gt;
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      Used in {variable.count} template{variable.count > 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="shrink-0 bg-bg-tertiary text-text-secondary text-xs px-2 py-1 rounded-full">
                    {variable.count}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {variable.templates.map((name) => (
                    <span
                      key={name}
                      className="bg-bg-tertiary text-text-tertiary text-xs px-2 py-0.5 rounded-md"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

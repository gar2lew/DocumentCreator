import { useProjects } from '../hooks/useProjects';
import { ChevronDown, Building2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function ProjectSelector() {
  const { projects, selectedProject, setSelectedProject } = useProjects();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-bg-tertiary hover:bg-bg-tertiary border border-border-secondary rounded-lg px-3 py-2 text-sm text-text min-w-[180px] max-w-[260px] transition-colors"
      >
        <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="flex-1 text-left truncate">
          {selectedProject ? selectedProject.name : 'Select project…'}
        </span>
        <ChevronDown className={`w-4 h-4 text-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-full min-w-[220px] bg-bg-secondary border border-border-secondary rounded-xl shadow-2xl z-50 py-1 max-h-60 overflow-y-auto">
          <button
            onClick={() => { setSelectedProject(null); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-text-tertiary hover:bg-bg-tertiary hover:text-text transition-colors"
          >
            None
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedProject(p); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-bg-tertiary ${
                selectedProject?.id === p.id ? 'text-indigo-400 bg-indigo-900/20' : 'text-text'
              }`}
            >
              {p.name}
              {p.acn && <span className="ml-2 text-xs text-text-tertiary">ACN {p.acn}</span>}
            </button>
          ))}
          {projects.length === 0 && (
            <p className="px-3 py-2 text-sm text-text-tertiary">No projects found</p>
          )}
        </div>
      )}
    </div>
  );
}

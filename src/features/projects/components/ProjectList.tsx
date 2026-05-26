import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { ProjectForm } from './ProjectForm';
import { useAppStore } from '../../../store';
import type { Project } from '../../../shared/types';
import { Plus, Pencil, Trash2, Building2, ArrowRight } from 'lucide-react';

export function ProjectList() {
  const { currentUser } = useAppStore();

  if (!currentUser) {
    return <div className="p-6 text-text-tertiary">Loading...</div>;
  }

  return <ProjectListContent currentUser={currentUser} />;
}

function ProjectListContent({ currentUser }: { currentUser: NonNullable<ReturnType<typeof useAppStore.getState>['currentUser']> }) {
  const { projects, loading, create, update, remove } = useProjects();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-text-tertiary text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {loading ? (
        <div className="text-text-tertiary text-sm">Loading...</div>
      ) : projects.length === 0 ? (
        <EmptyState onAdd={() => setShowForm(true)} onGenerate={() => navigate('/documents/generate')} />
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={() => setEditing(p)}
              onDelete={() => confirm(`Delete "${p.name}"?`) && remove(p.id)}
            />
          ))}
        </div>
      )}

      {(showForm || editing) && (
        <ProjectForm
          initial={editing ?? undefined}
          organisationId={currentUser.organisationId}
          createdBy={currentUser.uid}
          onSave={editing
            ? (data) => update(editing.id, data)
            : async (data) => { await create(data); }
          }
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-5 hover:border-border-secondary transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-900/40 rounded-lg">
            <Building2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-text">{project.name}</h3>
            {project.acn && <p className="text-xs text-text-tertiary">ACN: {project.acn}</p>}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1.5 text-text-tertiary hover:text-text hover:bg-bg-tertiary rounded transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-text-tertiary hover:text-red-400 hover:bg-bg-tertiary rounded transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {project.bankDetails.bankName && (
        <div className="mt-3 pt-3 border-t border-border text-xs text-text-tertiary space-y-1">
          <p><span className="text-text-tertiary">Bank:</span> {project.bankDetails.bankName}</p>
          <p><span className="text-text-tertiary">BSB:</span> {project.bankDetails.bsb} <span className="ml-2 text-text-tertiary">Account:</span> {project.bankDetails.accountNumber}</p>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAdd, onGenerate }: { onAdd: () => void; onGenerate: () => void }) {
  return (
    <div className="text-center py-20 text-text-tertiary bg-bg-secondary border border-border rounded-xl">
      <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
      <p className="text-lg font-medium text-text-secondary">Create your first project</p>
      <p className="text-sm mt-1 text-text-tertiary">Projects store ACN and bank details for generated documents</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button onClick={onAdd} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" />
          Create Project
        </button>
        <button onClick={onGenerate} className="inline-flex items-center gap-2 border border-border-secondary hover:border-border-secondary text-text-secondary px-4 py-2 rounded-lg text-sm font-medium">
          Go to Generate Document
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

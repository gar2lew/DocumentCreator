import { useAppStore } from '../store';
import { useTemplates } from '../features/templates/hooks/useTemplates';
import { useProjects } from '../features/projects/hooks/useProjects';
import { useNavigate } from 'react-router-dom';
import { FileText, Building2, Plus, ArrowRight } from 'lucide-react';

export function Dashboard() {
  const { currentUser } = useAppStore();
  const { templates } = useTemplates();
  const { projects } = useProjects();
  const navigate = useNavigate();

  const recentTemplates = templates.slice(0, 5);

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome back{currentUser?.displayName ? `, ${currentUser.displayName.split(' ')[0]}` : ''}
        </h1>
        <p className="text-gray-400 text-sm mt-1">Manage your templates and generate documents</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard
          icon={<FileText className="w-5 h-5 text-indigo-400" />}
          label="Templates"
          value={templates.length}
          bg="bg-indigo-900/20"
          onClick={() => navigate('/templates')}
        />
        <StatCard
          icon={<Building2 className="w-5 h-5 text-emerald-400" />}
          label="Projects"
          value={projects.length}
          bg="bg-emerald-900/20"
          onClick={() => navigate('/projects')}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <button
          onClick={() => navigate('/templates')}
          className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:border-indigo-700 rounded-xl transition-colors text-left group"
        >
          <div className="p-2 bg-indigo-900/30 rounded-lg">
            <Plus className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">New Template</p>
            <p className="text-xs text-gray-500">Create a document template</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-indigo-400 transition-colors" />
        </button>
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:border-emerald-700 rounded-xl transition-colors text-left group"
        >
          <div className="p-2 bg-emerald-900/30 rounded-lg">
            <Plus className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">New Project</p>
            <p className="text-xs text-gray-500">Add a client or project</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-emerald-400 transition-colors" />
        </button>
      </div>

      {/* Recent templates */}
      {recentTemplates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">Recent Templates</h2>
            <button onClick={() => navigate('/templates')} className="text-xs text-indigo-400 hover:text-indigo-300">View all</button>
          </div>
          <div className="space-y-2">
            {recentTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/templates/${t.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl text-left transition-colors"
              >
                <FileText className="w-4 h-4 text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{t.name}</p>
                  <p className="text-xs text-gray-600">v{t.currentVersion} · {t.updatedAt.toLocaleDateString()}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, bg, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex items-center gap-4 p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors text-left">
      <div className={`p-3 ${bg} rounded-xl`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-gray-400">{label}</p>
      </div>
    </button>
  );
}

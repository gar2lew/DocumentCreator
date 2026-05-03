import { useEffect, useState } from 'react';
import type { TemplateVersion } from '../../../shared/types';
import { useTemplates } from '../hooks/useTemplates';
import { History, RotateCcw, X } from 'lucide-react';

interface Props {
  templateId: string;
  onClose: () => void;
}

export function VersionHistory({ templateId, onClose }: Props) {
  const { getVersions, restore } = useTemplates();
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    getVersions(templateId).then((v) => {
      setVersions(v);
      setLoading(false);
    });
  }, [templateId, getVersions]);

  async function handleRestore(version: TemplateVersion) {
    if (!confirm(`Restore v${version.version}? This will create a new version.`)) return;
    setRestoring(version.id);
    try {
      await restore(templateId, version);
      onClose();
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Version History</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
            <p className="p-6 text-gray-400 text-sm">Loading…</p>
          ) : versions.length === 0 ? (
            <p className="p-6 text-gray-400 text-sm">No versions found.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {versions.map((v, i) => (
                <div key={v.id} className="px-6 py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${i === 0 ? 'text-indigo-400' : 'text-gray-300'}`}>
                        v{v.version}
                      </span>
                      {i === 0 && (
                        <span className="text-xs bg-indigo-900/40 text-indigo-400 px-1.5 py-0.5 rounded font-medium">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5 truncate">
                      {v.comment ?? `Version ${v.version}`}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {v.savedAt.toLocaleString()} · {v.savedBy}
                    </p>
                  </div>
                  {i !== 0 && (
                    <button
                      onClick={() => handleRestore(v)}
                      disabled={restoring === v.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-300 hover:border-indigo-500 hover:text-indigo-400 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {restoring === v.id ? 'Restoring…' : 'Restore'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

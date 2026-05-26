import { useEffect, useMemo, useState } from 'react';
import type { DocumentGenerated } from '../../../shared/types';
import { getGeneratedDocuments, logDocumentAccess, cleanupOldDocuments, type AccessLog } from '../services/documentService';
import { useAppStore } from '../../../store';
import { FileText, File, Download, Clock, Eye, Users, Trash2, Settings, Search, X, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function DocumentHistory() {
  const { currentUser } = useAppStore();
  const [docs, setDocs] = useState<DocumentGenerated[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [showRetention, setShowRetention] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const [cleaning, setCleaning] = useState(false);
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | 'pdf' | 'docx'>('all');
  const navigate = useNavigate();

  const filteredDocs = useMemo(() => {
    let result = docs;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d) =>
        d.templateName.toLowerCase().includes(q) ||
        d.projectName.toLowerCase().includes(q)
      );
    }

    if (formatFilter !== 'all') {
      result = result.filter((d) => d.format === formatFilter);
    }

    return result;
  }, [docs, search, formatFilter]);

  async function handleRegenerate(doc: DocumentGenerated) {
    navigate(`/documents/generate`, { state: { templateId: doc.templateId, projectId: doc.projectId, prefillData: doc.placeholderData } });
  }

  useEffect(() => {
    if (!currentUser?.organisationId) {
      setDocs([]);
      setLoading(false);
      return;
    }

    getGeneratedDocuments(currentUser.organisationId).then((d) => {
      setDocs(d);
      setLoading(false);
    }).catch((error) => {
      console.error('Firestore query error:', error);
      if (error.code === 'failed-precondition') {
        console.warn('Missing Firestore index. Create it from Firebase console.');
      }
      setLoading(false);
    });
  }, [currentUser]);

  async function handleDownload(doc: DocumentGenerated) {
    if (currentUser) {
      await logDocumentAccess(doc.id, currentUser.uid, currentUser.displayName, 'download');
    }
  }

  async function handleCleanup() {
    if (!currentUser?.organisationId) return;
    if (!confirm(`Delete all documents older than ${retentionDays} days? This cannot be undone.`)) return;

    setCleaning(true);
    try {
      const deleted = await cleanupOldDocuments(currentUser.organisationId, retentionDays);
      setDocs((prev) => prev.filter((d) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - retentionDays);
        return d.generatedAt >= cutoff;
      }));
      alert(`Deleted ${deleted} old document${deleted !== 1 ? 's' : ''}.`);
    } catch (err) {
      alert('Cleanup failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">Document History</h1>
            <p className="text-text-tertiary text-sm mt-1">
              {filteredDocs.length} of {docs.length} document{docs.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowRetention(!showRetention)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showRetention ? 'bg-indigo-600 text-white' : 'text-text-tertiary hover:text-text hover:bg-bg-tertiary'
            }`}
          >
            <Settings className="w-4 h-4" />
            Retention
          </button>
        </div>

        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search by template or project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg-input border border-border-secondary rounded-lg pl-9 pr-8 py-2 text-sm text-text placeholder:text-text-tertiary focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value as typeof formatFilter)}
            className="bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Formats</option>
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
          </select>
        </div>

        {showRetention && (
          <div className="mt-4 bg-bg-secondary border border-border rounded-xl p-4">
            <p className="text-sm font-medium text-text mb-3">Auto-delete documents older than:</p>
            <div className="flex items-center gap-3">
              <select
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text text-sm"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>1 year</option>
              </select>
              <button
                onClick={handleCleanup}
                disabled={cleaning}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {cleaning ? 'Cleaning...' : 'Delete Old Documents'}
              </button>
            </div>
            <p className="text-xs text-text-tertiary mt-2">
              This will permanently delete documents and their files from storage.
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-text-tertiary text-sm">Loading…</p>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-16 text-text-tertiary">
          {search || formatFilter !== 'all' ? (
            <>
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-text-tertiary font-medium">No documents match your filters</p>
              <button
                onClick={() => { setSearch(''); setFormatFilter('all'); }}
                className="mt-3 text-sm text-indigo-300 hover:text-indigo-200"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-text-tertiary font-medium">No documents generated yet</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map((doc) => {
            const accessLogs = (doc as any).accessLogs as AccessLog[] | undefined;
            const isExpanded = expandedDoc === doc.id;
            const downloadCount = accessLogs?.filter((l) => l.action === 'download').length ?? 0;
            const viewCount = accessLogs?.filter((l) => l.action === 'view').length ?? 0;

            return (
              <div key={doc.id} className="bg-bg-secondary border border-border rounded-xl overflow-hidden hover:border-border-secondary transition-colors">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="p-2 bg-bg-tertiary rounded-lg">
                    {doc.format === 'docx'
                      ? <FileText className="w-5 h-5 text-blue-400" />
                      : <File className="w-5 h-5 text-red-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}>
                    <p className="font-medium text-text truncate">{doc.templateName}</p>
                    <p className="text-sm text-text-tertiary mt-0.5">
                      {doc.projectName && <><span className="text-text-tertiary">{doc.projectName}</span> · </>}
                      {doc.format.toUpperCase()} · {doc.generatedAt.toLocaleString()}
                    </p>
                  </div>
                  {(downloadCount > 0 || viewCount > 0) && (
                    <div className="flex items-center gap-3 text-xs text-text-tertiary shrink-0">
                      {downloadCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Download className="w-3 h-3" /> {downloadCount}
                        </span>
                      )}
                      {viewCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" /> {viewCount}
                        </span>
                      )}
                    </div>
                  )}
                  <a
                    href={doc.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleDownload(doc)}
                    className="p-2 text-text-tertiary hover:text-text hover:bg-bg-tertiary rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleRegenerate(doc)}
                    className="p-2 text-text-tertiary hover:text-indigo-400 hover:bg-bg-tertiary rounded-lg transition-colors"
                    title="Regenerate"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {isExpanded && accessLogs && accessLogs.length > 0 && (
                  <div className="border-t border-border px-5 py-3 bg-bg-tertiary/50">
                    <p className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Access Log
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {accessLogs
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .map((log, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-text-tertiary">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              log.action === 'download' ? 'bg-blue-400' : 'bg-green-400'
                            }`} />
                            <span>{log.userName}</span>
                            <span className="text-text-tertiary">{log.action}</span>
                            <span className="ml-auto">{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

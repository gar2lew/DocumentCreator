import { useState } from 'react';
import { Archive, Clock, Download, FileText } from 'lucide-react';
import { useDocumentPacks } from '../hooks/useDocumentPacks';
import type { DocumentPackFile, DocumentPackKind } from '../services/documentPackService';
import { downloadDocumentPack } from '../services/documentPackDownloadService';
import type { PersistedDocumentPack, PersistedDocumentPackFile } from '../services/documentPackPersistenceService';
import { useCanDo } from '../../../shared/components/RoleGuard';

interface Props {
  dealId: string;
}

function formatFileType(type: string): string {
  if (type.includes('pdf')) return 'PDF';
  if (type.includes('word') || type.includes('docx')) return 'DOCX';
  return type.toUpperCase();
}

function inferPackKind(name: string): DocumentPackKind {
  return name.toLowerCase().includes('deed') ? 'deed' : 'loan_agreement';
}

async function fetchPackFile(file: PersistedDocumentPackFile): Promise<DocumentPackFile> {
  const response = await fetch(file.url);
  if (!response.ok) throw new Error(`Could not download ${file.name}`);

  return {
    kind: inferPackKind(file.name),
    templateId: '',
    templateName: file.name,
    filename: file.name,
    blob: await response.blob(),
  };
}

export function DocumentPackHistory({ dealId }: Props) {
  const canView = useCanDo('viewer');
  const { packs, loading, error } = useDocumentPacks(dealId);
  const [downloadingPackId, setDownloadingPackId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownloadPack(pack: PersistedDocumentPack) {
    if (!canView) return;
    if (pack.packUrl) return;

    setDownloadingPackId(pack.id);
    setDownloadError(null);

    try {
      const packFiles = await Promise.all(pack.files.map(fetchPackFile));
      await downloadDocumentPack(packFiles);
    } catch (downloadFailure) {
      setDownloadError(downloadFailure instanceof Error ? downloadFailure.message : 'Could not download pack.');
    } finally {
      setDownloadingPackId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Loading document packs...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">Could not load document packs.</p>;
  }

  if (packs.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        <Clock className="w-9 h-9 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium text-gray-400">No document packs generated yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {packs.map((pack) => (
        <div key={pack.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-gray-800 rounded-lg">
              <Archive className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Document Pack</p>
              <p className="text-xs text-gray-500">{pack.createdAt.toLocaleString()}</p>
            </div>
            {pack.packUrl ? (
              <a
                href={canView ? pack.packUrl : undefined}
                target={canView ? '_blank' : undefined}
                rel={canView ? 'noopener noreferrer' : undefined}
                aria-disabled={!canView}
                onClick={(event) => {
                  if (!canView) event.preventDefault();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                title={canView ? 'Download Pack' : 'Viewer access required'}
              >
                <Download className="w-3.5 h-3.5" />
                Download Pack
              </a>
            ) : (
              <button
                type="button"
                onClick={() => handleDownloadPack(pack)}
                disabled={!canView || downloadingPackId === pack.id}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                title={canView ? 'Download Pack' : 'Viewer access required'}
              >
                <Download className="w-3.5 h-3.5" />
                {downloadingPackId === pack.id ? 'Downloading...' : 'Download Pack'}
              </button>
            )}
          </div>

          {downloadError && <p className="mb-3 text-xs text-red-400">{downloadError}</p>}

          <div className="space-y-2">
            {pack.files.map((file) => (
              <div key={`${pack.id}:${file.name}`} className="flex items-center gap-3 rounded-lg bg-gray-950 px-3 py-2">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{file.name}</p>
                  <p className="text-xs text-gray-600">{formatFileType(file.type)}</p>
                </div>
                <a
                  href={canView ? file.url : undefined}
                  target={canView ? '_blank' : undefined}
                  rel={canView ? 'noopener noreferrer' : undefined}
                  aria-disabled={!canView}
                  onClick={(event) => {
                    if (!canView) event.preventDefault();
                  }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  title={canView ? `Download ${file.name}` : 'Viewer access required'}
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

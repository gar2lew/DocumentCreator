import { useEffect, useState } from 'react';
import type { DocumentGenerated } from '../../../shared/types';
import { getGeneratedDocuments } from '../services/documentService';
import { useAppStore } from '../../../store';
import { FileText, File, Download, Clock } from 'lucide-react';

export function DocumentHistory() {
  const { currentUser } = useAppStore();
  const [docs, setDocs] = useState<DocumentGenerated[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Document History</h1>
        <p className="text-gray-400 text-sm mt-1">All generated documents across your organisation</p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-gray-400 font-medium">No documents generated yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 hover:border-gray-700 transition-colors">
              <div className="p-2 bg-gray-800 rounded-lg">
                {doc.format === 'docx'
                  ? <FileText className="w-5 h-5 text-blue-400" />
                  : <File className="w-5 h-5 text-red-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{doc.templateName}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {doc.projectName && <><span className="text-gray-400">{doc.projectName}</span> · </>}
                  {doc.format.toUpperCase()} · {doc.generatedAt.toLocaleString()}
                </p>
              </div>
              <a
                href={doc.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

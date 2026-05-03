import { useState } from 'react';
import { Archive, AlertCircle, FileArchive } from 'lucide-react';
import type { Deal } from '../../deals/types';
import { generateAndPersistDocumentPack } from '../services/documentPackPersistenceService';
import { DocumentPackHistory } from './DocumentPackHistory';
import { useCanDo } from '../../../shared/components/RoleGuard';
import type { Project, Template, User } from '../../../shared/types';

interface Props {
  deal: Deal;
  project?: Project | null;
  templates: Template[];
  currentUser: User | null;
}

export function DealDocumentPanel({ deal, project, templates, currentUser }: Props) {
  const canEdit = useCanDo('editor');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGeneratePack() {
    if (!canEdit) {
      setError('You do not have permission to generate document packs.');
      return;
    }

    if (!currentUser) {
      setError('Sign in before generating a document pack.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      await generateAndPersistDocumentPack(deal, templates, currentUser.uid, project);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Could not generate document pack.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-800 rounded-lg">
          <Archive className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-white">Documents</h2>
          <p className="text-sm text-gray-500">Generate and download document packs for this deal.</p>
        </div>
        <button
          type="button"
          onClick={handleGeneratePack}
          disabled={generating || !currentUser || !canEdit || templates.length === 0}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          title={!canEdit ? 'Editor access required' : 'Generate Document Pack'}
        >
          <FileArchive className="w-4 h-4" />
          {generating ? 'Generating...' : 'Generate Document Pack'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <DocumentPackHistory dealId={deal.id} />
    </section>
  );
}

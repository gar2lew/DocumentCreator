import { useState } from 'react';
import type { Template } from '../../../shared/types';
import { uploadFirebaseBlob } from '../../../shared/firebase/storage';
import { extractDocxPlaceholders } from '../../../shared/utils/docxPlaceholders';
import { updateTemplateFileUrl } from '../services/templateService';
import { X } from 'lucide-react';

interface Props {
  organisationId: string;
  createdBy: string;
  onCreate: (data: Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'currentVersion' | 'locked'>) => Promise<Template>;
  onClose: () => void;
}

export function NewTemplateModal({ organisationId, createdBy, onCreate, onClose }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'text' | 'docx'>('text');
  const [templateKind, setTemplateKind] = useState<Template['templateKind']>(null);
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (type === 'docx' && !docxFile) {
      setError('Upload a DOCX template file.');
      return;
    }

    setLoading(true);
    try {
      const template = await onCreate({
        organisationId,
        createdBy,
        name,
        description,
        type,
        templateKind,
        content: type === 'text' ? `Dear <<client_name>>,\n\n` : '',
        fields: [],
      });

      if (type === 'docx' && docxFile) {
        const placeholders = await extractDocxPlaceholders(docxFile);
        const path = `templates/${organisationId}/${template.id}/v${template.currentVersion}.docx`;
        const { downloadUrl } = await uploadFirebaseBlob(
          path,
          docxFile,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        await updateTemplateFileUrl(template.id, downloadUrl, placeholders, false);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text">New Template</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-text-tertiary mb-1">Name <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-indigo-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Service Agreement"
            />
          </div>
          <div>
            <label className="block text-sm text-text-tertiary mb-1">Description</label>
            <input
              className="w-full bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-indigo-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="block text-sm text-text-tertiary mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['text', 'docx'] as const).map((nextType) => (
                <button
                  key={nextType}
                  type="button"
                  onClick={() => {
                    setType(nextType);
                    if (nextType !== 'docx') setDocxFile(null);
                  }}
                  className={`py-3 rounded-lg border text-sm font-medium transition-colors ${
                    type === nextType
                      ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300'
                      : 'border-border-secondary text-text-tertiary hover:border-border-secondary hover:text-text'
                  }`}
                >
                  {nextType === 'text' ? 'Text Template' : 'DOCX Upload'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-tertiary mb-1">Template Kind</label>
            <select
              value={templateKind ?? ''}
              onChange={(e) => setTemplateKind((e.target.value || null) as Template['templateKind'])}
              className="w-full bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">None</option>
              <option value="deed">Deed</option>
              <option value="loan_agreement">Loan Agreement</option>
            </select>
          </div>
          {type === 'docx' && (
            <div>
              <label className="block text-sm text-text-tertiary mb-1">DOCX File <span className="text-red-400">*</span></label>
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setDocxFile(e.target.files?.[0] ?? null)}
                className="w-full bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text text-sm file:mr-3 file:rounded-md file:border-0 file:bg-bg-tertiary file:px-3 file:py-1.5 file:text-text"
                required
              />
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-border-secondary text-text-secondary hover:text-text text-sm">Cancel</button>
            <button type="submit" disabled={loading || !name || (type === 'docx' && !docxFile)} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm">
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

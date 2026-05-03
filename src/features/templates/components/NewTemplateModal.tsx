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
  const [type, setType] = useState<'text' | 'docx' | 'pdf'>('text');
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
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">New Template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Service Agreement"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['text', 'docx', 'pdf'] as const).map((nextType) => (
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
                      : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                  }`}
                >
                  {nextType === 'text' ? 'Text' : nextType === 'docx' ? 'DOCX' : 'PDF'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Template Kind</label>
            <select
              value={templateKind ?? ''}
              onChange={(e) => setTemplateKind((e.target.value || null) as Template['templateKind'])}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">None</option>
              <option value="deed">Deed</option>
              <option value="loan_agreement">Loan Agreement</option>
            </select>
          </div>
          {type === 'docx' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">DOCX File <span className="text-red-400">*</span></label>
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setDocxFile(e.target.files?.[0] ?? null)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-700 file:px-3 file:py-1.5 file:text-white"
                required
              />
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white text-sm">Cancel</button>
            <button type="submit" disabled={loading || !name || (type === 'docx' && !docxFile)} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm">
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

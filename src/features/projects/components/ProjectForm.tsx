import { useState } from 'react';
import type { Project } from '../../../shared/types';
import { X } from 'lucide-react';

interface Props {
  initial?: Partial<Project>;
  onSave: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onClose: () => void;
  organisationId: string;
  createdBy: string;
}

export function ProjectForm({ initial, onSave, onClose, organisationId, createdBy }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [acn, setAcn] = useState(initial?.acn ?? '');
  const [bankName, setBankName] = useState(initial?.bankDetails?.bankName ?? '');
  const [accountName, setAccountName] = useState(initial?.bankDetails?.accountName ?? '');
  const [bsb, setBsb] = useState(initial?.bankDetails?.bsb ?? '');
  const [accountNumber, setAccountNumber] = useState(initial?.bankDetails?.accountNumber ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSave({
        organisationId,
        createdBy,
        name,
        acn,
        bankDetails: { bankName, accountName, bsb, accountNumber },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            {initial?.id ? 'Edit Project' : 'New Project'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="Project / Client Name" required>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="ACN">
            <input className={inputCls} value={acn} onChange={(e) => setAcn(e.target.value)} placeholder="000 000 000" />
          </Field>

          <div className="border-t border-gray-800 pt-4">
            <p className="text-sm font-medium text-gray-400 mb-3">Bank Details</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank Name">
                <input className={inputCls} value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </Field>
              <Field label="Account Name">
                <input className={inputCls} value={accountName} onChange={(e) => setAccountName(e.target.value)} />
              </Field>
              <Field label="BSB">
                <input className={inputCls} value={bsb} onChange={(e) => setBsb(e.target.value)} placeholder="000-000" />
              </Field>
              <Field label="Account Number">
                <input className={inputCls} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
              </Field>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors text-sm">
              {loading ? 'Saving…' : 'Save Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}{required && <span className="text-red-400 ml-1">*</span>}</label>
      {children}
    </div>
  );
}

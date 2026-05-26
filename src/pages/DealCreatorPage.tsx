import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { useDeals } from '../features/deals/hooks/useDeals';
import { useTemplates } from '../features/templates/hooks/useTemplates';
import { ExportPanel } from '../features/export/components/ExportPanel';
import type { DealType } from '../features/deals/types';
import { ArrowRight, FileText } from 'lucide-react';

interface DealRouteState {
  dealId?: string;
  projectId?: string;
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DealCreatorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state ?? {}) as DealRouteState;
  const { projects, selectedProject, setSelectedProject, selectedTemplate } = useAppStore();
  const { templates } = useTemplates();
  const initialProjectId = routeState.projectId ?? selectedProject?.id ?? projects[0]?.id ?? '';
  const [projectId, setProjectId] = useState(initialProjectId);
  const [dealType, setDealType] = useState<DealType>('deed_settlement');
  const [clientName, setClientName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interest, setInterest] = useState('');
  const [settlementDate, setSettlementDate] = useState(todayInputValue());
  const [createdDealId, setCreatedDealId] = useState(routeState.dealId ?? '');
  const [showExport, setShowExport] = useState(Boolean(routeState.dealId));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { create } = useDeals(projectId);

  const project = useMemo(
    () => projects.find((item) => item.id === projectId) ?? selectedProject,
    [projects, projectId, selectedProject]
  );
  const exportTemplate = selectedTemplate ?? templates[0] ?? null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!project) {
      setError('Select a project before creating a deal.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const deal = await create(project, {
        type: dealType,
        clientName: clientName.trim(),
        lender: { name: clientName.trim() },
        financials: {
          principal: Number(principal) || 0,
          interest: Number(interest) || 0,
        },
        dates: {
          agreementDate: todayInputValue(),
          settlementDate,
        },
      });
      setSelectedProject(project);
      setCreatedDealId(deal.id);
      setShowExport(true);
      navigate('/deals/new', {
        replace: true,
        state: { dealId: deal.id, projectId: project.id },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create deal');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Create Deal</h1>
        <p className="text-text-tertiary text-sm mt-1">Start with deal data, then generate from a template.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-bg-secondary border border-border rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Project">
            <select
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                const next = projects.find((item) => item.id === event.target.value);
                if (next) setSelectedProject(next);
              }}
              className={inputClass}
              required
            >
              <option value="">Select project</option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Deal Type">
            <select
              value={dealType}
              onChange={(event) => setDealType(event.target.value as DealType)}
              className={inputClass}
            >
              <option value="deed_settlement">Deed settlement</option>
              <option value="loan_agreement">Loan agreement</option>
            </select>
          </Field>
          <Field label="Client Name">
            <input
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Settlement Date">
            <input
              type="date"
              value={settlementDate}
              onChange={(event) => setSettlementDate(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Principal">
            <input
              value={principal}
              onChange={(event) => setPrincipal(event.target.value)}
              inputMode="decimal"
              className={inputClass}
              required
            />
          </Field>
          <Field label="Interest">
            <input
              value={interest}
              onChange={(event) => setInterest(event.target.value)}
              inputMode="decimal"
              className={inputClass}
            />
          </Field>
        </div>

        {project && (
          <div className="rounded-lg border border-border bg-bg/60 p-3 text-xs text-text-tertiary">
            <p className="text-text-secondary font-medium mb-1">Project snapshot</p>
            <p>ACN: {project.acn || 'Not set'}</p>
            <p>Bank: {project.bankDetails.bankName || 'Not set'}</p>
            <p>Account: {project.bankDetails.accountName || 'Not set'}</p>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving || !projectId}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? 'Creating...' : 'Create Deal'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {!exportTemplate && (
        <div className="mt-4 flex items-center gap-2 text-sm text-amber-300 bg-amber-900/10 border border-amber-800 rounded-lg p-3">
          <FileText className="w-4 h-4" />
          Create or select a template before exporting this deal.
        </div>
      )}

      {showExport && exportTemplate && (
        <ExportPanel
          template={exportTemplate}
          manualData={{}}
          initialDealId={createdDealId}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

const inputClass = 'w-full bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-indigo-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-text-tertiary mb-1">{label}</span>
      {children}
    </label>
  );
}

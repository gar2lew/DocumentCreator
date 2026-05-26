import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle, FileArchive, FileText, Plus } from 'lucide-react';
import { useAppStore } from '../store';
import { useTemplates } from '../features/templates/hooks/useTemplates';
import { useProjects } from '../features/projects/hooks/useProjects';
import { ProjectSelector } from '../features/projects/components/ProjectSelector';
import { ProjectForm } from '../features/projects/components/ProjectForm';
import { useDeals } from '../features/deals/hooks/useDeals';
import type { DealType } from '../features/deals/types';
import type { Template } from '../shared/types';
import { generateAndPersistDocumentPack } from '../features/document-packs/services/documentPackPersistenceService';

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function kindLabel(template: Template): string {
  if (template.templateKind === 'deed') return 'Deed';
  if (template.templateKind === 'loan_agreement') return 'Loan Agreement';
  return 'No pack kind';
}

function dealTypeForTemplate(template: Template): DealType {
  return template.templateKind === 'loan_agreement' ? 'loan_agreement' : 'deed_settlement';
}

export function DocumentBuilderPage() {
  const { currentUser, selectedTemplate, setSelectedTemplate } = useAppStore();
  const { templates, loading: loadingTemplates } = useTemplates();
  const { selectedProject, create: createProject, setSelectedProject } = useProjects();
  const { create: createDeal } = useDeals(selectedProject?.id);

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [clientName, setClientName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interest, setInterest] = useState('');
  const [settlementDate, setSettlementDate] = useState(todayInputValue());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPackId, setGeneratedPackId] = useState('');

  const selectableTemplates = useMemo(
    () => templates.filter((template) => template.templateKind),
    [templates]
  );

  async function handleCreateProject(data: Parameters<typeof createProject>[0]) {
    const project = await createProject(data);
    setSelectedProject(project);
  }

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    if (!currentUser) {
      setError('Sign in before generating documents.');
      return;
    }
    if (!selectedTemplate) {
      setError('Select a template before generating documents.');
      return;
    }
    if (!selectedTemplate.templateKind) {
      setError('Select a document-pack template before generating documents.');
      return;
    }
    if (!selectedProject) {
      setError('Select or create a project before generating documents.');
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedPackId('');

    try {
      const deal = await createDeal(selectedProject, {
        type: dealTypeForTemplate(selectedTemplate),
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
      const pack = await generateAndPersistDocumentPack(deal, [selectedTemplate], currentUser.uid, selectedProject);
      setGeneratedPackId(pack.id);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Could not generate documents.');
    } finally {
      setGenerating(false);
    }
  }

  if (!currentUser) return null;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Document Builder</h1>
        <p className="text-text-tertiary text-sm mt-1">Select a template, choose a project, enter deal data, and generate documents.</p>
      </div>

      <div className="space-y-5">
        <section className="bg-bg-secondary border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <StepNumber value="1" />
            <h2 className="text-base font-semibold text-text">Template</h2>
          </div>
          {loadingTemplates ? (
            <p className="text-sm text-text-tertiary">Loading templates...</p>
          ) : selectableTemplates.length === 0 ? (
            <p className="text-sm text-amber-300">No document-pack templates found. Set a template kind on a template first.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectableTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplate(template)}
                  className={`text-left rounded-lg border p-4 transition-colors ${
                    selectedTemplate?.id === template.id
                      ? 'border-indigo-500 bg-indigo-900/20'
                      : 'border-border bg-bg hover:border-border-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <p className="text-sm font-medium text-white truncate">{template.name}</p>
                  </div>
                  <p className="text-xs text-text-tertiary mt-2">{kindLabel(template)} / {template.type.toUpperCase()}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="bg-bg-secondary border border-border rounded-xl p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <StepNumber value="2" />
              <h2 className="text-base font-semibold text-text">Project</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowProjectForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-bg-tertiary px-3 py-2 text-sm font-medium text-text hover:bg-bg-tertiary border border-border-secondary"
            >
              <Plus className="w-4 h-4" />
              Create New Project
            </button>
          </div>
          <ProjectSelector />
          {selectedProject && (
            <div className="mt-4 rounded-lg border border-border bg-bg/60 p-3 text-xs text-text-tertiary">
              <p className="text-text-secondary font-medium mb-1">{selectedProject.name}</p>
              <p>ACN: {selectedProject.acn || 'Not set'}</p>
              <p>Bank: {selectedProject.bankDetails.bankName || 'Not set'}</p>
            </div>
          )}
        </section>

        <form onSubmit={handleGenerate} className="bg-bg-secondary border border-border rounded-xl p-5 space-y-5">
          <div className="flex items-center gap-2">
            <StepNumber value="3" />
            <h2 className="text-base font-semibold text-text">Deal Data</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Client Name">
              <input value={clientName} onChange={(event) => setClientName(event.target.value)} className={inputClass} required />
            </Field>
            <Field label="Settlement Date">
              <input type="date" value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)} className={inputClass} required />
            </Field>
            <Field label="Principal">
              <input value={principal} onChange={(event) => setPrincipal(event.target.value)} inputMode="decimal" className={inputClass} required />
            </Field>
            <Field label="Interest">
              <input value={interest} onChange={(event) => setInterest(event.target.value)} inputMode="decimal" className={inputClass} />
            </Field>
          </div>

          <div className="border-t border-border pt-5">
            <div className="flex items-center gap-2 mb-3">
              <StepNumber value="4" />
              <h2 className="text-base font-semibold text-text">Generate</h2>
            </div>

            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
            {generatedPackId && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-green-900/60 bg-green-950/40 px-3 py-2 text-sm text-green-300">
                <CheckCircle className="w-4 h-4" />
                Document pack generated.
              </div>
            )}

            <button
              type="submit"
              disabled={generating || !selectedTemplate || !selectedProject}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              <FileArchive className="w-4 h-4" />
              {generating ? 'Generating...' : 'Generate Documents'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {showProjectForm && (
        <ProjectForm
          organisationId={currentUser.organisationId}
          createdBy={currentUser.uid}
          onSave={handleCreateProject}
          onClose={() => setShowProjectForm(false)}
        />
      )}
    </div>
  );
}

const inputClass = 'w-full bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-indigo-500';

function StepNumber({ value }: { value: string }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
      {value}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-text-tertiary mb-1">{label}</span>
      {children}
    </label>
  );
}

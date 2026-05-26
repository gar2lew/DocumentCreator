import { useEffect, useMemo, useState } from 'react';
import type { DocumentGenerated, Template } from '../../../shared/types';
import { useExport } from '../hooks/useExport';
import { useAppStore } from '../../../store';
import { buildProjectPlaceholders } from '../../../shared/utils/placeholders';
import { extractPlaceholders } from '../../../shared/utils/placeholders';
import { validateExport } from '../../../shared/utils/validation';
import { getLastGeneratedDocument } from '../services/documentService';
import { useDeals } from '../../deals/hooks/useDeals';
import type { Deal, DealType } from '../../deals/types';
import { mapDealToPlaceholders } from '../../deals/utils/mapDealToPlaceholders';
import { X, FileText, File, Download, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

interface Props {
  template: Template;
  manualData: Record<string, string>;
  initialDealId?: string;
  onClose: () => void;
}

interface PlaceholderDiff {
  key: string;
  before: string;
  after: string;
}

interface PlaceholderSetDiff {
  key: string;
  status: 'added' | 'removed';
}

function buildPlaceholderDiff(
  previous: Record<string, string> | null,
  current: Record<string, string>
): PlaceholderDiff[] {
  if (!previous) return [];

  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  return Array.from(keys)
    .sort()
    .filter((key) => (previous[key] ?? '') !== (current[key] ?? ''))
    .map((key) => ({
      key,
      before: previous[key] ?? '',
      after: current[key] ?? '',
    }));
}

function buildPlaceholderSetDiff(previousContent: string | undefined, currentContent: string): PlaceholderSetDiff[] {
  if (!previousContent) return [];

  const previous = new Set(extractPlaceholders(previousContent));
  const current = new Set(extractPlaceholders(currentContent));
  const added = Array.from(current)
    .filter((key) => !previous.has(key))
    .map((key) => ({ key, status: 'added' as const }));
  const removed = Array.from(previous)
    .filter((key) => !current.has(key))
    .map((key) => ({ key, status: 'removed' as const }));

  return [...added, ...removed].sort((a, b) => a.key.localeCompare(b.key));
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeNumericInput(value: string): string {
  let hasDecimalPoint = false;

  return value
    .replace(/[^\d.]/g, '')
    .split('')
    .filter((character) => {
      if (character !== '.') return true;
      if (hasDecimalPoint) return false;
      hasDecimalPoint = true;
      return true;
    })
    .join('');
}

function numberValue(value: string): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ExportPanel({ template, manualData, initialDealId = '', onClose }: Props) {
  const { exportDocument, exporting, error } = useExport();
  const { currentUser, selectedProject, projects, setSelectedProject } = useAppStore();
  const [done, setDone] = useState(false);
  const [lastUrl, setLastUrl] = useState('');
  const [dealProjectId, setDealProjectId] = useState(selectedProject?.id ?? '');
  const [selectedDealId, setSelectedDealId] = useState(initialDealId);
  const [dealType, setDealType] = useState<DealType>('deed_settlement');
  const [clientName, setClientName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interest, setInterest] = useState('');
  const [settlementDate, setSettlementDate] = useState(todayInputValue());
  const [dealError, setDealError] = useState<string | null>(null);
  const [exportGuardError, setExportGuardError] = useState<string | null>(null);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [lastExportResult, setLastExportResult] = useState<{
    key: string;
    doc: DocumentGenerated | null;
  } | null>(null);
  const [watermark, setWatermark] = useState<'none' | 'draft' | 'confidential'>('none');
  const projectOptions = useMemo(() => {
    const byId = new Map(projects.map((project) => [project.id, project]));
    if (selectedProject) byId.set(selectedProject.id, selectedProject);
    return Array.from(byId.values());
  }, [projects, selectedProject]);
  const dealProject = projectOptions.find((project) => project.id === dealProjectId) ?? selectedProject;
  const { deals, loading: loadingDeals, error: dealsError, create: createDeal } = useDeals(dealProject?.id);
  const selectedDeal = deals.find((deal) => deal.id === selectedDealId) ?? null;

  useEffect(() => {
    if (initialDealId) setSelectedDealId(initialDealId);
  }, [initialDealId]);

  const allData = useMemo(() => {
    const projectData = selectedProject ? buildProjectPlaceholders(selectedProject) : {};
    const dealData = selectedDeal
      ? mapDealToPlaceholders(selectedDeal, dealProject)
      : {};
    return { ...projectData, ...dealData, ...manualData };
  }, [selectedProject, selectedDeal, dealProject, manualData]);

  const validation = useMemo(() => validateExport(template, allData), [template, allData]);
  const missingRequiredPlaceholders = useMemo(() => {
    const templatePlaceholders = template.placeholders ?? [];
    const placeholders = templatePlaceholders.length > 0
      ? templatePlaceholders
      : extractPlaceholders(template.content);

    return placeholders.filter((placeholder) => {
      const value = allData[placeholder];
      return value == null || String(value).trim() === '';
    });
  }, [template.content, template.placeholders, allData]);
  const requiredPlaceholderError = missingRequiredPlaceholders.length > 0
    ? `Missing required fields: ${missingRequiredPlaceholders.join(', ')}`
    : null;
  const lastExportKey = useMemo(() => {
    if (!currentUser) return '';
    return `${currentUser.organisationId}:${template.id}:${selectedProject?.id ?? ''}`;
  }, [currentUser, template.id, selectedProject?.id]);
  const lastExport = lastExportResult?.key === lastExportKey ? lastExportResult.doc : null;
  const loadingDiff = Boolean(currentUser && lastExportResult?.key !== lastExportKey);
  const diff = useMemo(() => buildPlaceholderDiff(lastExport?.placeholderData ?? null, allData), [lastExport, allData]);
  const placeholderDiff = useMemo(
    () => buildPlaceholderSetDiff(lastExport?.templateContent, template.content),
    [lastExport?.templateContent, template.content]
  );

  useEffect(() => {
    let active = true;
    if (!currentUser) {
      return;
    }

    getLastGeneratedDocument(currentUser.organisationId, template.id, selectedProject?.id ?? '')
      .then((doc) => {
        if (active) setLastExportResult({ key: lastExportKey, doc });
      })
      .catch(() => {
        if (active) setLastExportResult({ key: lastExportKey, doc: null });
      });

    return () => {
      active = false;
    };
  }, [currentUser, template.id, selectedProject?.id, lastExportKey]);

  async function handleCreateDeal() {
    if (!dealProject) {
      setDealError('Select a project before creating a deal.');
      return;
    }

    setCreatingDeal(true);
    setDealError(null);
    try {
      const created = await createDeal(dealProject, {
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
      setSelectedDealId(created.id);
      setSelectedProject(dealProject);
    } catch (err) {
      setDealError(err instanceof Error ? err.message : 'Could not create deal');
    } finally {
      setCreatingDeal(false);
    }
  }

  async function handleExport(format: 'pdf' | 'docx') {
    if (requiredPlaceholderError) {
      setExportGuardError(requiredPlaceholderError);
      return;
    }

    if (!validation.valid) return;
    setExportGuardError(null);
    const url = await exportDocument(template, format, allData, watermark === 'none' ? undefined : watermark);
    if (url) { setLastUrl(url); setDone(true); }
  }

  const hasErrors = validation.issues.some((i) => i.severity === 'error');
  const canExport = validation.valid && !requiredPlaceholderError;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-text">Export Document</h2>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-white font-medium">Export complete</p>
              <p className="text-sm text-text-tertiary mt-1">Your file download has started and is saved to document history.</p>
              <a href={lastUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-indigo-400 text-sm hover:underline">
                Open in new tab
              </a>
            </div>
          ) : (
            <>
              {/* Project indicator */}
              {selectedProject ? (
                <p className="text-sm text-text-tertiary">
                  Exporting <strong className="text-text">{template.name}</strong> with project data from{' '}
                  <strong className="text-indigo-300">{selectedProject.name}</strong>
                </p>
              ) : (
                <p className="text-sm text-text-tertiary">
                  Exporting <strong className="text-text">{template.name}</strong> — no project selected
                </p>
              )}

              {selectedDeal ? (
                <div className="rounded-xl border border-border bg-bg/60 p-3">
                  <p className="text-xs font-semibold text-text-secondary">Using Deal</p>
                  <p className="text-sm text-white mt-1">
                    {selectedDeal.lender.name || 'Unnamed lender'} - {selectedDeal.financials.total}
                  </p>
                </div>
              ) : (
                <DealSetup
                  projects={projectOptions}
                  deals={deals}
                  selectedProjectId={dealProjectId}
                  selectedDealId={selectedDealId}
                  dealType={dealType}
                  clientName={clientName}
                  principal={principal}
                  interest={interest}
                  settlementDate={settlementDate}
                  loadingDeals={loadingDeals}
                  creatingDeal={creatingDeal}
                  error={dealError ?? dealsError}
                  onProjectChange={(projectId) => {
                    setDealProjectId(projectId);
                    setSelectedDealId('');
                    const project = projectOptions.find((item) => item.id === projectId);
                    if (project) setSelectedProject(project);
                  }}
                  onDealChange={setSelectedDealId}
                  onDealTypeChange={setDealType}
                  onClientNameChange={setClientName}
                  onPrincipalChange={setPrincipal}
                  onInterestChange={setInterest}
                  onSettlementDateChange={setSettlementDate}
                  onCreateDeal={handleCreateDeal}
                />
              )}

              {/* Validation issues */}
              {validation.issues.length > 0 && (
                <div className={`rounded-xl border p-3 space-y-1.5 ${
                  hasErrors ? 'border-red-800 bg-red-900/10' : 'border-amber-800 bg-amber-900/10'
                }`}>
                  <p className={`text-xs font-semibold ${hasErrors ? 'text-red-400' : 'text-amber-400'}`}>
                    {hasErrors ? '⚠ Missing required values' : '⚠ Warnings'}
                  </p>
                  {validation.issues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-2">
                      {issue.severity === 'error'
                        ? <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                        : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      }
                      <span className="text-xs text-text-secondary">{issue.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {requiredPlaceholderError && (
                <div className="flex items-start gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{requiredPlaceholderError}</span>
                </div>
              )}

              {/* Export diff preview */}
              <div className="rounded-xl border border-border bg-bg/60 p-3">
                <p className="text-xs font-semibold text-text-secondary">Changes since last export</p>
                {loadingDiff ? (
                  <p className="text-xs text-text-tertiary mt-2">Checking document history...</p>
                ) : !lastExport ? (
                  <p className="text-xs text-text-tertiary mt-2">No previous export found for this template and project.</p>
                ) : diff.length === 0 && placeholderDiff.length === 0 ? (
                  <p className="text-xs text-green-400 mt-2">No placeholder changes detected.</p>
                ) : (
                  <div className="mt-2 max-h-36 overflow-y-auto space-y-2">
                    {placeholderDiff.map((item) => (
                      <div key={`${item.status}:${item.key}`} className="text-xs">
                        <p className="font-mono text-text-secondary">&lt;&lt;{item.key}&gt;&gt;</p>
                        <p className={item.status === 'added' ? 'text-green-300' : 'text-amber-300'}>
                          Placeholder {item.status}
                        </p>
                      </div>
                    ))}
                    {diff.map((item) => (
                      <div key={item.key} className="text-xs">
                        <p className="font-mono text-text-secondary">&lt;&lt;{item.key}&gt;&gt;</p>
                        <p className="text-text-tertiary line-through truncate">{item.before || '(empty)'}</p>
                        <p className="text-green-300 truncate">{item.after || '(empty)'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Watermark options */}
              <div className="rounded-xl border border-border bg-bg/60 p-3">
                <p className="text-xs font-semibold text-text-secondary mb-2">Watermark / Stamp</p>
                <div className="flex gap-2">
                  {(['none', 'draft', 'confidential'] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setWatermark(option)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors border ${
                        watermark === option
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-bg-input text-text-tertiary border-border-secondary hover:text-text'
                      }`}
                    >
                      {option === 'none' ? 'None' : option === 'draft' ? 'DRAFT' : 'CONFIDENTIAL'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format buttons */}
              {canExport && (
                <div className="space-y-3">
                  <FormatButton
                    icon={<FileText className="w-5 h-5 text-blue-400" />}
                    label="Word Document (.docx)"
                    description="Editable document with text formatting"
                    onClick={() => handleExport('docx')}
                    loading={exporting}
                  />
                  <FormatButton
                    icon={<File className="w-5 h-5 text-red-400" />}
                    label="PDF Document (.pdf)"
                    description={template.type === 'pdf' && template.pdfStoragePath
                      ? 'Fill PDF fields overlay and export'
                      : 'Generate PDF from text content'}
                    onClick={() => handleExport('pdf')}
                    loading={exporting}
                  />
                </div>
              )}

              {(exportGuardError || error) && (
                <div className="flex items-start gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{exportGuardError || error}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DealSetup({
  projects,
  deals,
  selectedProjectId,
  selectedDealId,
  dealType,
  clientName,
  principal,
  interest,
  settlementDate,
  loadingDeals,
  creatingDeal,
  error,
  onProjectChange,
  onDealChange,
  onDealTypeChange,
  onClientNameChange,
  onPrincipalChange,
  onInterestChange,
  onSettlementDateChange,
  onCreateDeal,
}: {
  projects: { id: string; name: string }[];
  deals: Deal[];
  selectedProjectId: string;
  selectedDealId: string;
  dealType: DealType;
  clientName: string;
  principal: string;
  interest: string;
  settlementDate: string;
  loadingDeals: boolean;
  creatingDeal: boolean;
  error: string | null;
  onProjectChange: (projectId: string) => void;
  onDealChange: (dealId: string) => void;
  onDealTypeChange: (type: DealType) => void;
  onClientNameChange: (value: string) => void;
  onPrincipalChange: (value: string) => void;
  onInterestChange: (value: string) => void;
  onSettlementDateChange: (value: string) => void;
  onCreateDeal: () => void;
}) {
  const total = numberValue(principal) + numberValue(interest);

  return (
    <div className="rounded-xl border border-border bg-bg/60 p-3 space-y-3">
      <p className="text-xs font-semibold text-text-secondary">Deal data</p>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={selectedProjectId}
          onChange={(event) => onProjectChange(event.target.value)}
          className="col-span-2 bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text text-sm"
        >
          <option value="">Select project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        <select
          value={selectedDealId}
          onChange={(event) => onDealChange(event.target.value)}
          className="col-span-2 bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text text-sm"
        >
          <option value="">{loadingDeals ? 'Loading deals...' : 'No deal selected'}</option>
          {deals.map((deal) => (
            <option key={deal.id} value={deal.id}>
              {deal.lender.name || 'Unnamed lender'} - {deal.financials.total}
            </option>
          ))}
        </select>
        <select
          value={dealType}
          onChange={(event) => onDealTypeChange(event.target.value as DealType)}
          className="bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text text-sm"
        >
          <option value="deed_settlement">Deed settlement</option>
          <option value="loan_agreement">Loan agreement</option>
        </select>
        <input
          value={clientName}
          onChange={(event) => onClientNameChange(event.target.value)}
          placeholder="Client Name"
          className="bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text text-sm placeholder-text-tertiary"
        />
        <input
          value={principal}
          onChange={(event) => onPrincipalChange(sanitizeNumericInput(event.target.value))}
          placeholder="Principal"
          inputMode="decimal"
          className="bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text text-sm placeholder-text-tertiary"
        />
        <input
          value={interest}
          onChange={(event) => onInterestChange(sanitizeNumericInput(event.target.value))}
          placeholder="Interest"
          inputMode="decimal"
          className="bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text text-sm placeholder-text-tertiary"
        />
        <input
          value={formatNumber(total)}
          readOnly
          aria-label="Total"
          className="col-span-2 bg-bg-secondary border border-border-secondary rounded-lg px-3 py-2 text-text-secondary text-sm"
        />
        <input
          value={settlementDate}
          onChange={(event) => onSettlementDateChange(event.target.value)}
          type="date"
          className="col-span-2 bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text text-sm"
        />
      </div>
      <button
        type="button"
        onClick={onCreateDeal}
        disabled={creatingDeal || !selectedProjectId || !clientName.trim()}
        className="w-full py-2 rounded-lg bg-bg-tertiary hover:bg-bg-tertiary disabled:opacity-50 text-text text-sm border border-border-secondary"
      >
        {creatingDeal ? 'Creating deal...' : 'Create deal from project'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function FormatButton({ icon, label, description, onClick, loading }: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-4 p-4 bg-bg-tertiary hover:bg-bg-tertiary border border-border-secondary hover:border-border-secondary rounded-xl text-left transition-colors disabled:opacity-50"
    >
      <div className="p-2 bg-bg-secondary rounded-lg">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
      </div>
      {loading ? (
        <div className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
      ) : (
        <Download className="w-4 h-4 text-text-tertiary shrink-0" />
      )}
    </button>
  );
}

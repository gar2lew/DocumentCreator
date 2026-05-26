import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle, Download, FileText, FolderOpen, Search, X, Layers } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTemplates } from '../../templates/hooks/useTemplates';
import { useProjects } from '../../projects/hooks/useProjects';
import type { Project, Template } from '../../../shared/types';
import { buildProjectPlaceholders, extractPlaceholders, normalizePlaceholderKey } from '../../../shared/utils/placeholders';
import { exportToDocx, generateDocxFromTemplate } from '../../export/services/docxExporter';
import { exportPdfWithFields, exportTextToPdf } from '../../export/services/pdfExporter';
import { uploadFirebaseBlob } from '../../../shared/firebase/storage';
import { saveGeneratedDocument } from '../../export/services/documentService';
import { useAppStore } from '../../../store';

function templateTypeLabel(template: Template): string {
  if (template.type === 'docx') return 'DOCX';
  if (template.type === 'pdf') return 'PDF';
  return 'TEXT';
}

function safeFilename(name: string, extension: string): string {
  const base = name.trim().replace(/[^\w.-]+/g, '_') || 'document';
  return `${base}_${Date.now()}.${extension}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function placeholdersForTemplate(template: Template | null): string[] {
  if (!template) return [];

  const keys = new Set<string>();
  for (const placeholder of template.placeholders ?? []) {
    keys.add(normalizePlaceholderKey(placeholder));
  }

  if (keys.size === 0 && template.type === 'text') {
    for (const placeholder of extractPlaceholders(template.content)) {
      keys.add(normalizePlaceholderKey(placeholder));
    }
  }

  if (keys.size === 0 && template.type === 'pdf') {
    for (const field of template.fields) {
      if (field.placeholder) {
        extractPlaceholders(field.placeholder).forEach((placeholder) => keys.add(placeholder));
      } else if (field.name) {
        keys.add(normalizePlaceholderKey(field.name));
      }
    }
  }

  return Array.from(keys).sort();
}

async function renderDocument(template: Template, placeholderData: Record<string, string>, watermark?: 'draft' | 'confidential'): Promise<{ blob: Blob; filename: string }> {
  if (template.type === 'pdf') {
    const bytes = await exportPdfWithFields(template, placeholderData, watermark);
    return {
      blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
      filename: safeFilename(template.name, 'pdf'),
    };
  }

  if (template.type === 'docx') {
    if (!template.fileUrl) throw new Error('No DOCX file uploaded for this template');
    return {
      blob: await generateDocxFromTemplate(template.fileUrl, placeholderData, watermark),
      filename: safeFilename(template.name, 'docx'),
    };
  }

  const bytes = await exportTextToPdf(template.content, placeholderData, watermark, template.styles);
  return {
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
    filename: safeFilename(template.name, 'pdf'),
  };
}

export function GenerateDocumentPage() {
  const { currentUser } = useAppStore();
  const { templates, loading: templatesLoading } = useTemplates();
  const { projects, loading: projectsLoading, selectedProject, setSelectedProject } = useProjects();
  const location = useLocation();
  const state = location.state as { templateId?: string; projectId?: string; prefillData?: Record<string, string> } | null;

  const [selectedTemplateId, setSelectedTemplateId] = useState(state?.templateId ?? '');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [projectId, setProjectId] = useState(state?.projectId ?? selectedProject?.id ?? '');
  const [placeholderData, setPlaceholderData] = useState<Record<string, string>>(state?.prefillData ?? {});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [watermark, setWatermark] = useState<'draft' | 'confidential' | 'none'>('none');
  const [exportFormat, setExportFormat] = useState<'auto' | 'pdf' | 'docx'>('auto');

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const filteredTemplates = useMemo(() => {
    let result = templates;
    if (templateSearch.trim()) {
      const q = templateSearch.toLowerCase();
      result = result.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [templates, templateSearch]);

  const batchTemplates = useMemo(
    () => templates.filter((t) => selectedTemplateIds.has(t.id)),
    [templates, selectedTemplateIds]
  );

  const project = useMemo(
    () => projects.find((item) => item.id === projectId) ?? null,
    [projects, projectId]
  );
  const placeholders = useMemo(
    () => placeholdersForTemplate(selectedTemplate),
    [selectedTemplate]
  );

  useEffect(() => {
    if (!project) return;
    setSelectedProject(project);
  }, [project, setSelectedProject]);

  useEffect(() => {
    const projectDefaults = project ? buildProjectPlaceholders(project) : {};
    setPlaceholderData((current) => {
      const next: Record<string, string> = {};
      for (const placeholder of placeholders) {
        next[placeholder] = current[placeholder] ?? projectDefaults[placeholder] ?? '';
      }
      return next;
    });
  }, [placeholders, project]);

  async function handleGenerate() {
    if (!project) {
      setError('Select a project before generating.');
      return;
    }

    const templatesToGenerate = batchMode
      ? batchTemplates
      : selectedTemplate ? [selectedTemplate] : [];

    if (templatesToGenerate.length === 0) {
      setError('Select a template before generating.');
      return;
    }

    if (!batchMode) {
      const missing = placeholders.filter((placeholder) => !placeholderData[placeholder]?.trim());
      if (missing.length > 0) {
        setError(`Missing required fields: ${missing.join(', ')}`);
        return;
      }
    }

    setGenerating(true);
    setError(null);
    setSuccess('');

    const wm = watermark === 'none' ? undefined : watermark;
    const projectData = buildProjectPlaceholders(project);
    const generatedFiles: string[] = [];

    try {
      for (const template of templatesToGenerate) {
        const data = batchMode
          ? { ...projectData, ...placeholderData }
          : { ...projectData, ...placeholderData };

        let blob: Blob;
        let filename: string;

        if (exportFormat === 'pdf') {
          if (template.type === 'pdf') {
            const bytes = await exportPdfWithFields(template, data, wm);
            blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
            filename = safeFilename(template.name, 'pdf');
          } else {
            const bytes = await exportTextToPdf(template.content, data, wm, template.styles);
            blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
            filename = safeFilename(template.name, 'pdf');
          }
        } else if (exportFormat === 'docx') {
          if (template.type === 'docx' && template.fileUrl) {
            blob = await generateDocxFromTemplate(template.fileUrl, data, wm);
          } else {
            blob = await exportToDocx(template.content, data, wm, template.styles);
          }
          filename = safeFilename(template.name, 'docx');
        } else {
          const rendered = await renderDocument(template, data, wm);
          blob = rendered.blob;
          filename = rendered.filename;
        }

        if (currentUser) {
          const path = `generated/${currentUser.organisationId}/${filename}`;
          const { downloadUrl: url } = await uploadFirebaseBlob(path, blob, blob.type);

          await saveGeneratedDocument({
            organisationId: currentUser.organisationId,
            templateId: template.id,
            templateName: template.name,
            projectId: project.id,
            projectName: project.name,
            format: filename.endsWith('.pdf') ? 'pdf' : 'docx',
            storagePath: path,
            downloadUrl: url,
            generatedBy: currentUser.uid,
            placeholderData: data,
            templateContent: template.content,
          });
        }

        downloadBlob(blob, filename);
        generatedFiles.push(filename);
      }

      setSuccess(`Generated ${generatedFiles.length} file${generatedFiles.length > 1 ? 's' : ''}: ${generatedFiles.join(', ')}`);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Could not generate document.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Generate Document</h1>
        <p className="text-text-tertiary text-sm mt-1">Select a template, choose a project, complete the fields, and download the generated file.</p>
      </div>

      <div className="space-y-5">
        <section className="bg-bg-secondary border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <StepNumber value="1" />
              <h2 className="text-base font-semibold text-text">Template</h2>
            </div>
            <button
              type="button"
              onClick={() => { setBatchMode(!batchMode); setSelectedTemplateIds(new Set()); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                batchMode ? 'bg-indigo-600 text-white' : 'text-text-tertiary hover:text-text hover:bg-bg-tertiary'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              {batchMode ? 'Batch' : 'Single'}
            </button>
          </div>

          {templatesLoading ? (
            <p className="text-sm text-text-tertiary">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-amber-300">Create a template before generating a document.</p>
          ) : (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="w-full bg-bg-input border border-border-secondary rounded-lg pl-9 pr-8 py-2 text-sm text-text placeholder:text-text-tertiary focus:outline-none focus:border-indigo-500 transition-colors"
                />
                {templateSearch && (
                  <button
                    onClick={() => setTemplateSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTemplates.map((template) => {
                  const isSelected = batchMode
                    ? selectedTemplateIds.has(template.id)
                    : selectedTemplateId === template.id;

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        if (batchMode) {
                          setSelectedTemplateIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(template.id)) next.delete(template.id);
                            else next.add(template.id);
                            return next;
                          });
                        } else {
                          setSelectedTemplateId(template.id);
                        }
                      }}
                      className={`text-left rounded-lg border p-4 transition-colors ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-900/20'
                          : 'border-border bg-bg hover:border-border-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-400" />
                        <p className="text-sm font-medium text-white truncate">{template.name}</p>
                      </div>
                      <p className="text-xs text-text-tertiary mt-2">{templateTypeLabel(template)}</p>
                    </button>
                  );
                })}
              </div>

              {batchMode && selectedTemplateIds.size > 0 && (
                <p className="mt-3 text-sm text-indigo-300">
                  {selectedTemplateIds.size} template{selectedTemplateIds.size > 1 ? 's' : ''} selected
                </p>
              )}
            </>
          )}
        </section>

        <section className="bg-bg-secondary border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <StepNumber value="2" />
            <h2 className="text-base font-semibold text-text">Project</h2>
          </div>

          {projectsLoading ? (
            <p className="text-sm text-text-tertiary">Loading projects...</p>
          ) : (
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className={inputClass}
            >
              <option value="">Select project</option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          )}

          {project && <ProjectSnapshot project={project} />}
        </section>

        <section className="bg-bg-secondary border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <StepNumber value="3" />
            <h2 className="text-base font-semibold text-text">Document Fields</h2>
          </div>

          {!selectedTemplate ? (
            <p className="text-sm text-text-tertiary">Select a template to show its fields.</p>
          ) : placeholders.length === 0 ? (
            <p className="text-sm text-text-tertiary">This template does not define any placeholders.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {placeholders.map((placeholder) => (
                <Field key={placeholder} label={placeholder}>
                  <input
                    value={placeholderData[placeholder] ?? ''}
                    onChange={(event) => setPlaceholderData((current) => ({
                      ...current,
                      [placeholder]: event.target.value,
                    }))}
                    className={inputClass}
                  />
                </Field>
              ))}
            </div>
          )}
        </section>

        <section className="bg-bg-secondary border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <StepNumber value="4" />
            <h2 className="text-base font-semibold text-text">Generate</h2>
          </div>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-tertiary">Format:</span>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}
                className="bg-bg-input border border-border-secondary rounded-lg px-2.5 py-1.5 text-sm text-text focus:outline-none focus:border-indigo-500"
              >
                <option value="auto">Auto (template default)</option>
                <option value="pdf">PDF</option>
                <option value="docx">DOCX</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-text-tertiary">Watermark:</span>
              <select
                value={watermark}
                onChange={(e) => setWatermark(e.target.value as typeof watermark)}
                className="bg-bg-input border border-border-secondary rounded-lg px-2.5 py-1.5 text-sm text-text focus:outline-none focus:border-indigo-500"
              >
                <option value="none">None</option>
                <option value="draft">DRAFT</option>
                <option value="confidential">CONFIDENTIAL</option>
              </select>
            </div>
          </div>

          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
          {success && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-green-900/60 bg-green-950/40 px-3 py-2 text-sm text-green-300">
              <CheckCircle className="w-4 h-4" />
              {success}
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || (!batchMode && !selectedTemplate) || (batchMode && selectedTemplateIds.size === 0) || !project}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {generating ? 'Generating...' : batchMode ? `Generate ${selectedTemplateIds.size} Documents` : 'Generate Document'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      </div>
    </div>
  );
}

function ProjectSnapshot({ project }: { project: Project }) {
  return (
    <div className="mt-4 rounded-lg border border-border bg-bg/60 p-3 text-xs text-text-tertiary">
      <div className="mb-1 flex items-center gap-2 text-text-secondary font-medium">
        <FolderOpen className="w-4 h-4" />
        {project.name}
      </div>
      <p>ACN: {project.acn || 'Not set'}</p>
      <p>Bank: {project.bankDetails.bankName || 'Not set'}</p>
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

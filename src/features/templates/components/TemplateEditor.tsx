import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTemplates } from "../hooks/useTemplates";
import { useAppStore } from "../../../store";
import { VersionHistory } from "./VersionHistory";
import { ProjectSelector } from "../../projects/components/ProjectSelector";
import { ExportPanel } from "../../export/components/ExportPanel";
import { RichTextEditor } from "../../../shared/components/RichTextEditor";
import { buildProjectPlaceholders, extractPlaceholders, extractConditionalKeys, extractLoopKeys, resolveToSegments, type TemplateStyles, type PlaceholderStyle } from "../../../shared/utils/placeholders";
import { useDebounce } from "../../../shared/utils/useDebounce";
import type { Template } from "../../../shared/types";
import type { Editor } from "@tiptap/react";
import { getSemanticNodeExtensions } from "../../documentEngine/config";
import { SemanticAuthoringPanel } from "./SemanticAuthoringPanel";
import { TemplateHealthBar } from "./TemplateHealthBar";
import { TemplateValidationPanel } from "./TemplateValidationPanel";
import { MigrationIndicator } from "./MigrationIndicator";
import { TemplateLineage } from "./TemplateLineage";
import { CanonicalitySection } from "./CanonicalitySection";
import { SectionManager } from "./SectionManager";
import { TransactionPreview } from "./TransactionPreview";
import { ResolverDiagnostics } from "./ResolverDiagnostics";
import { GovernanceDashboard } from "./GovernanceDashboard";
import {
  Lock,
  Unlock,
  History,
  ArrowLeft,
  Eye,
  Code,
  Download,
  AlertCircle,
  CheckCircle,
  RotateCcw,
  Shield,
} from "lucide-react";

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

function buildDraftSignature(content: string, name: string, description: string, templateKind: Template["templateKind"]): string {
  return JSON.stringify({ content, name, description, templateKind: templateKind ?? null });
}

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { templates, save, toggleLock, setSelectedTemplate } = useTemplates();
  const { selectedProject } = useAppStore();

  const [template, setTemplate] = useState<Template | null>(null);
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateKind, setTemplateKind] = useState<Template["templateKind"]>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showHistory, setShowHistory] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [manualData, setManualData] = useState<Record<string, string>>({});
  const [sidebarTab, setSidebarTab] = useState<'placeholders' | 'styles' | 'semantic' | 'governance'>('placeholders');
  const [templateStyles, setTemplateStyles] = useState<TemplateStyles>({});
  const [selectedStylePlaceholder, setSelectedStylePlaceholder] = useState<string>('');
  const saveComment = useRef<string | undefined>(undefined);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [lifecycleState, setLifecycleState] = useState<Template['lifecycleState']>(undefined);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [dealId, setDealId] = useState<string | undefined>(undefined);
  const [transactionType, setTransactionType] = useState<Template['transactionType']>(undefined);

  const semanticExtensions = useMemo(() => getSemanticNodeExtensions(), []);
  const lastSavedSignature = useRef("");

  // Load template when it first appears in the store or changes externally
  useEffect(() => {
    const t = templates.find((t) => t.id === id);
    if (t) {
      setTemplate(t);
      // Only reset content/name if we haven't started editing yet
      if (saveStatus === "idle") {
        setContent(t.content);
        setName(t.name);
        setDescription(t.description);
        setTemplateKind(t.templateKind ?? null);
        setTemplateStyles(t.styles ?? {});
        setLifecycleState(t.lifecycleState);
        setSectionIds(t.sectionIds ?? []);
        setDealId(t.dealId);
        setTransactionType(t.transactionType);
        lastSavedSignature.current = buildDraftSignature(t.content, t.name, t.description, t.templateKind) + JSON.stringify(t.styles) + (t.lifecycleState ?? '');
      }
      setSelectedTemplate(t);
    }
  }, [id, templates]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------ debounced auto-save (500ms) ----------------
  const performSave = useCallback(
    async (tid: string, c: string, n: string, d: string, kind: Template["templateKind"], fields: Template["fields"], styles: Template["styles"], lc?: Template['lifecycleState'], sids?: string[], did?: string, tt?: Template['transactionType']) => {
      const nextSignature = buildDraftSignature(c, n, d, kind) + JSON.stringify(styles) + (lc ?? '') + JSON.stringify(sids) + (did ?? '') + (tt ?? '');
      if (!template || template.locked || nextSignature === lastSavedSignature.current) return;

      setSaveStatus("saving");
      try {
        await save(tid, { name: n, description: d, templateKind: kind ?? null, content: c, fields, styles, lifecycleState: lc, sectionIds: sids, dealId: did, transactionType: tt }, saveComment.current);
        lastSavedSignature.current = nextSignature;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    },
    [save, template],
  );

  const debouncedSave = useDebounce(performSave, 600);

  function handleStyleChange(key: string, style: Partial<PlaceholderStyle>) {
    setTemplateStyles((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...style },
    }));
  }

  function handleContentChange(val: string) {
    if (!template || template.locked) return;
    setContent(val);
    if (buildDraftSignature(val, name, description, templateKind) === lastSavedSignature.current) return;
    setSaveStatus("pending");
    debouncedSave(template.id, val, name, description, templateKind, template.fields, templateStyles, lifecycleState, sectionIds, dealId, transactionType);
  }

  function handleNameChange(val: string) {
    if (!template || template.locked) return;
    setName(val);
    if (buildDraftSignature(content, val, description, templateKind) === lastSavedSignature.current) return;
    setSaveStatus("pending");
    debouncedSave(template.id, content, val, description, templateKind, template.fields, templateStyles, lifecycleState, sectionIds, dealId, transactionType);
  }

  function handleTemplateKindChange(val: string) {
    if (!template || template.locked) return;
    const nextKind = (val || null) as Template["templateKind"];
    setTemplateKind(nextKind);
    if (buildDraftSignature(content, name, description, nextKind) === lastSavedSignature.current) return;
    setSaveStatus("pending");
    debouncedSave(template.id, content, name, description, nextKind, template.fields, templateStyles, lifecycleState, sectionIds, dealId, transactionType);
  }

  function handleLifecycleStateChange(val: string) {
    if (!template || template.locked) return;
    const next = (val || undefined) as Template['lifecycleState'];
    setLifecycleState(next);
    debouncedSave(template.id, content, name, description, templateKind, template.fields, templateStyles, next, sectionIds, dealId, transactionType);
  }

  function handleSectionIdsChange(ids: string[]) {
    setSectionIds(ids);
    if (template && !template.locked) {
      performSave(template.id, content, name, description, templateKind, template.fields, templateStyles, lifecycleState, ids, dealId, transactionType);
    }
  }

  function handleDealIdChange(id: string | undefined) {
    setDealId(id);
    if (template && !template.locked) {
      performSave(template.id, content, name, description, templateKind, template.fields, templateStyles, lifecycleState, sectionIds, id, transactionType);
    }
  }

  function handleTransactionTypeChange(t: Template['transactionType']) {
    setTransactionType(t);
    if (template && !template.locked) {
      performSave(template.id, content, name, description, templateKind, template.fields, templateStyles, lifecycleState, sectionIds, dealId, t);
    }
  }

  // Manual save (e.g. Ctrl+S)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (template && !template.locked) {
          performSave(template.id, content, name, description, templateKind, template.fields, templateStyles, lifecycleState, sectionIds, dealId, transactionType);
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [template, content, name, description, templateKind, templateStyles, lifecycleState, sectionIds, dealId, transactionType, performSave]);

  const placeholders = extractPlaceholders(content);
  const conditionalKeys = extractConditionalKeys(content);
  const loopKeys = extractLoopKeys(content);

  const previewContent = useCallback(() => {
    const projectData = selectedProject ? buildProjectPlaceholders(selectedProject) : {};
    const allData = { ...projectData, ...manualData };
    const segments = resolveToSegments(content, allData);

    return segments.map((seg) => {
      if (seg.type === 'literal') return seg.text;
      const style = templateStyles?.[seg.key || ''];
      if (!style) return seg.text;

      const cssStyle: string[] = [];
      if (style.fontFamily) cssStyle.push(`font-family: ${style.fontFamily}`);
      if (style.fontSize) cssStyle.push(`font-size: ${style.fontSize}px`);
      if (style.bold) cssStyle.push('font-weight: bold');
      if (style.italic) cssStyle.push('font-style: italic');
      if (style.underline) cssStyle.push('text-decoration: underline');
      if (style.alignment === 'center') cssStyle.push('text-align: center');
      else if (style.alignment === 'right') cssStyle.push('text-align: right');

      return `<span style="${cssStyle.join('; ')}">${seg.text}</span>`;
    }).join('');
  }, [content, selectedProject, manualData, templateStyles]);

  if (!template) return <div className="p-6 text-text-tertiary">Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-bg-secondary border-b border-border shrink-0 flex-wrap gap-y-2">
        <button
          onClick={() => navigate("/templates")}
          className="text-text-tertiary hover:text-text p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <input
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          disabled={template.locked}
          className="bg-transparent text-white font-semibold text-base focus:outline-none border-b border-transparent focus:border-gray-600 transition-colors disabled:cursor-not-allowed truncate max-w-[180px]"
        />

        <select
          value={templateKind ?? ""}
          onChange={(e) => handleTemplateKindChange(e.target.value)}
          disabled={template.locked}
          className="bg-bg-input border border-border-secondary rounded-lg px-2 py-1 text-xs text-text focus:outline-none focus:border-indigo-500 disabled:cursor-not-allowed"
        >
          <option value="">None</option>
          <option value="deed">Deed</option>
          <option value="loan_agreement">Loan Agreement</option>
        </select>

        <select
          value={lifecycleState ?? ""}
          onChange={(e) => handleLifecycleStateChange(e.target.value)}
          disabled={template.locked}
          className="bg-bg-input border border-border-secondary rounded-lg px-2 py-1 text-xs text-text focus:outline-none focus:border-indigo-500 disabled:cursor-not-allowed"
        >
          <option value="">Draft</option>
          <option value="review">Review</option>
          <option value="approved">Approved</option>
          <option value="deprecated">Deprecated</option>
          <option value="archived">Archived</option>
        </select>

        {template.locked && (
          <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-900/20 px-2 py-1 rounded-full">
            <AlertCircle className="w-3 h-3" /> Locked
          </span>
        )}

        <SaveIndicator status={saveStatus} />

        <span className="text-xs text-text-tertiary hidden sm:block">v{template.currentVersion}</span>

        <div className="flex-1 min-w-0" />

        <ProjectSelector />

        <ModeToggle mode={mode} onChange={setMode} />

        <button
          onClick={() => setShowHistory(true)}
          className="p-2 text-text-tertiary hover:text-text hover:bg-bg-tertiary rounded-lg transition-colors"
          title="Version History"
        >
          <History className="w-4 h-4" />
        </button>
        <button
          onClick={() => toggleLock(template.id, !template.locked)}
          className="p-2 text-text-tertiary hover:text-amber-400 hover:bg-bg-tertiary rounded-lg transition-colors"
          title={template.locked ? "Unlock template" : "Lock template"}
        >
          {template.locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="px-4 py-1.5 bg-bg-secondary border-b border-border shrink-0">
        <TemplateHealthBar template={template} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 overflow-auto relative">
          {mode === "edit" ? (
            <RichTextEditor
              content={content}
              onChange={handleContentChange}
              disabled={template.locked}
              additionalExtensions={semanticExtensions}
              onEditorReady={setEditorInstance}
            />
          ) : (
            <div className="p-8 max-w-3xl mx-auto">
              <div className="bg-white rounded-xl p-10 shadow-lg text-gray-900 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewContent() }} />
            </div>
          )}
        </div>

        {/* Placeholder sidebar */}
        {mode === "edit" && (
          <div className="w-72 border-l border-border bg-bg-secondary overflow-y-auto shrink-0 flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-border shrink-0">
              <button
                onClick={() => setSidebarTab('semantic')}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${sidebarTab === 'semantic' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-text-tertiary hover:text-text'}`}
              >
                Semantic
              </button>
              <button
                onClick={() => setSidebarTab('placeholders')}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${sidebarTab === 'placeholders' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-text-tertiary hover:text-text'}`}
              >
                Values
              </button>
              <button
                onClick={() => setSidebarTab('styles')}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${sidebarTab === 'styles' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-text-tertiary hover:text-text'}`}
              >
                Styles
              </button>
              <button
                onClick={() => setSidebarTab('governance')}
                className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-0.5 ${sidebarTab === 'governance' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-text-tertiary hover:text-text'}`}
              >
                <Shield className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {sidebarTab === 'semantic' ? (
                <SemanticAuthoringPanel
                  editor={editorInstance}
                  templateKind={templateKind}
                  existingPlaceholders={placeholders}
                  existingConditionals={conditionalKeys}
                  existingLoops={loopKeys}
                />
              ) : sidebarTab === 'placeholders' ? (
                <PlaceholderPanel
                  placeholders={placeholders}
                  conditionalKeys={conditionalKeys}
                  loopKeys={loopKeys}
                  manualData={manualData}
                  selectedProject={selectedProject}
                  onManualDataChange={setManualData}
                />
              ) : sidebarTab === 'styles' ? (
                <StylePanel
                  placeholders={placeholders}
                  styles={templateStyles}
                  selectedPlaceholder={selectedStylePlaceholder}
                  onSelectPlaceholder={setSelectedStylePlaceholder}
                  onStyleChange={handleStyleChange}
                />
              ) : (
                <div className="space-y-4">
                  <CanonicalitySection template={template} />
                  <TransactionPreview
                    template={template}
                    onDealIdChange={handleDealIdChange}
                    onTransactionTypeChange={handleTransactionTypeChange}
                  />
                  <SectionManager template={template} onSectionIdsChange={handleSectionIdsChange} />
                  {/* Template Lifecycle State */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Template Lifecycle</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        template.lifecycleState === 'draft' || !template.lifecycleState ? 'bg-bg-input text-text-tertiary' :
                        template.lifecycleState === 'review' ? 'bg-blue-900/30 text-blue-400' :
                        template.lifecycleState === 'approved' ? 'bg-green-900/30 text-green-400' :
                        template.lifecycleState === 'deprecated' ? 'bg-amber-900/30 text-amber-400' :
                        'bg-red-900/30 text-red-400'
                      }`}>
                        {(template.lifecycleState ?? 'draft').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-tertiary">Id: {template.id}</p>
                  </div>
                  <GovernanceDashboard template={template} />
                  <ResolverDiagnostics template={template} />
                  <TemplateValidationPanel template={template} />
                  <MigrationIndicator template={template} />
                  <TemplateLineage template={template} templates={templates} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showHistory && <VersionHistory templateId={template.id} onClose={() => setShowHistory(false)} />}
      {showExport && (
        <ExportPanel template={{ ...template, content }} manualData={manualData} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const map: Record<SaveStatus, { label: string; cls: string; icon?: React.ReactNode }> = {
    idle: { label: "", cls: "" },
    pending: { label: "Unsaved", cls: "text-amber-400", icon: <RotateCcw className="w-3 h-3 animate-spin" /> },
    saving: { label: "Saving…", cls: "text-text-tertiary", icon: <RotateCcw className="w-3 h-3 animate-spin" /> },
    saved: { label: "Saved", cls: "text-green-400", icon: <CheckCircle className="w-3 h-3" /> },
    error: { label: "Save failed", cls: "text-red-400", icon: <AlertCircle className="w-3 h-3" /> },
  };
  const { label, cls, icon } = map[status];
  return (
    <span className={`flex items-center gap-1 text-xs ${cls}`}>
      {icon}
      {label}
    </span>
  );
}

function ModeToggle({ mode, onChange }: { mode: "edit" | "preview"; onChange: (m: "edit" | "preview") => void }) {
  return (
    <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-1">
      {(["edit", "preview"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${mode === m ? "bg-indigo-600 text-text" : "text-text-tertiary hover:text-text"}`}
        >
          {m === "edit" ? (
            <>
              <Code className="w-3 h-3" />
              Edit
            </>
          ) : (
            <>
              <Eye className="w-3 h-3" />
              Preview
            </>
          )}
        </button>
      ))}
    </div>
  );
}

function PlaceholderPanel({
  placeholders,
  conditionalKeys,
  loopKeys,
  manualData,
  selectedProject,
  onManualDataChange,
}: {
  placeholders: string[];
  conditionalKeys: string[];
  loopKeys: string[];
  manualData: Record<string, string>;
  selectedProject: { name: string } | null;
  onManualDataChange: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
}) {
  return (
    <>
      {loopKeys.length > 0 && (
        <>
          <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            Loops ({loopKeys.length})
          </p>
          <div className="space-y-1.5 mb-4">
            {loopKeys.map((key) => (
              <div key={`loop-${key}`} className="rounded-md px-2 py-1.5 text-xs font-mono bg-purple-900/20 text-purple-400">
                &lt;&lt;for {key}&gt;&gt;
              </div>
            ))}
          </div>
        </>
      )}

      {conditionalKeys.length > 0 && (
        <>
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Conditions ({conditionalKeys.length})
          </p>
          <div className="space-y-1.5 mb-4">
            {conditionalKeys.map((key) => {
              const isActive = manualData[key] !== undefined && manualData[key] !== '';
              return (
                <div key={`cond-${key}`} className={`rounded-md px-2 py-1.5 text-xs font-mono ${isActive ? 'bg-green-900/20 text-green-400' : 'bg-amber-900/20 text-amber-400'}`}>
                  &lt;&lt;if {key}&gt;&gt;
                </div>
              );
            })}
          </div>
        </>
      )}

      {placeholders.length > 0 && (
        <>
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
            Placeholders ({placeholders.length})
          </p>
          <div className="space-y-2">
            {placeholders.map((key) => {
              const autoValue = selectedProject ? buildProjectPlaceholders(selectedProject)[key] : undefined;
              return (
                <div key={key}>
                  <label className="block text-xs text-text-tertiary mb-0.5 font-mono">&lt;&lt;{key}&gt;&gt;</label>
                  <input
                    className="w-full bg-bg-input border border-border-secondary rounded-md px-2 py-1.5 text-xs text-text focus:outline-none focus:border-indigo-500"
                    value={manualData[key] ?? ""}
                    onChange={(e) => onManualDataChange((d) => ({ ...d, [key]: e.target.value }))}
                    placeholder={autoValue ?? "(from project)"}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedProject && (
        <p className="text-xs text-text-tertiary mt-3 flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-green-500" />
          Using data from <span className="text-text-tertiary">{selectedProject.name}</span>
        </p>
      )}
      <p className="text-xs text-text-tertiary mt-2">Manual values override project data.</p>
    </>
  );
}

function StylePanel({
  placeholders,
  styles,
  selectedPlaceholder,
  onSelectPlaceholder,
  onStyleChange,
}: {
  placeholders: string[];
  styles: TemplateStyles;
  selectedPlaceholder: string;
  onSelectPlaceholder: (key: string) => void;
  onStyleChange: (key: string, style: Partial<PlaceholderStyle>) => void;
}) {
  const currentStyle = selectedPlaceholder ? styles[selectedPlaceholder] || {} : {};

  function applyToAll(field: keyof PlaceholderStyle, value: PlaceholderStyle[typeof field]) {
    const newStyles: TemplateStyles = {};
    for (const key of placeholders) {
      newStyles[key] = { ...(styles[key] || {}), [field]: value };
    }
    for (const [key, style] of Object.entries(newStyles)) {
      onStyleChange(key, style);
    }
  }

  if (placeholders.length === 0) {
    return <p className="text-xs text-text-tertiary">No placeholders to style.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Placeholder selector */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Select Placeholder</label>
        <select
          value={selectedPlaceholder}
          onChange={(e) => onSelectPlaceholder(e.target.value)}
          className="w-full bg-bg-input border border-border-secondary rounded-lg px-2 py-1.5 text-xs text-text focus:outline-none focus:border-indigo-500"
        >
          <option value="">-- Select --</option>
          {placeholders.map((key) => (
            <option key={key} value={key}>&lt;&lt;{key}&gt;&gt;</option>
          ))}
        </select>
      </div>

      {selectedPlaceholder && (
        <>
          {/* Font Family */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Font Family</label>
            <select
              value={currentStyle.fontFamily || ''}
              onChange={(e) => onStyleChange(selectedPlaceholder, { fontFamily: e.target.value || undefined })}
              className="w-full bg-bg-input border border-border-secondary rounded-lg px-2 py-1.5 text-xs text-text focus:outline-none focus:border-indigo-500"
            >
              <option value="">Default</option>
              <option value="Calibri">Calibri</option>
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
            </select>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Font Size (pt)</label>
            <input
              type="number"
              min="6"
              max="72"
              value={currentStyle.fontSize || ''}
              onChange={(e) => onStyleChange(selectedPlaceholder, { fontSize: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full bg-bg-input border border-border-secondary rounded-lg px-2 py-1.5 text-xs text-text focus:outline-none focus:border-indigo-500"
              placeholder="Auto"
            />
          </div>

          {/* Alignment */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Alignment</label>
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  onClick={() => onStyleChange(selectedPlaceholder, { alignment: currentStyle.alignment === align ? undefined : align })}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors ${
                    currentStyle.alignment === align
                      ? 'bg-indigo-600 text-white'
                      : 'bg-bg-input text-text-tertiary hover:text-text border border-border-secondary'
                  }`}
                >
                  {align.charAt(0).toUpperCase() + align.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Style toggles */}
          <div className="flex gap-2">
            <button
              onClick={() => onStyleChange(selectedPlaceholder, { bold: !currentStyle.bold })}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors ${
                currentStyle.bold ? 'bg-indigo-600 text-white' : 'bg-bg-input text-text-tertiary border border-border-secondary'
              }`}
            >
              B
            </button>
            <button
              onClick={() => onStyleChange(selectedPlaceholder, { italic: !currentStyle.italic })}
              className={`flex-1 py-1.5 rounded-md text-xs italic transition-colors ${
                currentStyle.italic ? 'bg-indigo-600 text-white' : 'bg-bg-input text-text-tertiary border border-border-secondary'
              }`}
            >
              I
            </button>
            <button
              onClick={() => onStyleChange(selectedPlaceholder, { underline: !currentStyle.underline })}
              className={`flex-1 py-1.5 rounded-md text-xs underline transition-colors ${
                currentStyle.underline ? 'bg-indigo-600 text-white' : 'bg-bg-input text-text-tertiary border border-border-secondary'
              }`}
            >
              U
            </button>
          </div>

          {/* Apply to all */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-text-secondary mb-2">Apply to all placeholders</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => applyToAll('fontSize', currentStyle.fontSize)}
                disabled={!currentStyle.fontSize}
                className="py-1.5 px-2 rounded-md text-xs bg-bg-tertiary text-text-tertiary hover:text-text disabled:opacity-30 border border-border-secondary"
              >
                Font Size
              </button>
              <button
                onClick={() => applyToAll('fontFamily', currentStyle.fontFamily)}
                disabled={!currentStyle.fontFamily}
                className="py-1.5 px-2 rounded-md text-xs bg-bg-tertiary text-text-tertiary hover:text-text disabled:opacity-30 border border-border-secondary"
              >
                Font Family
              </button>
              <button
                onClick={() => applyToAll('alignment', currentStyle.alignment)}
                disabled={!currentStyle.alignment}
                className="py-1.5 px-2 rounded-md text-xs bg-bg-tertiary text-text-tertiary hover:text-text disabled:opacity-30 border border-border-secondary"
              >
                Alignment
              </button>
              <button
                onClick={() => applyToAll('bold', currentStyle.bold)}
                disabled={currentStyle.bold === undefined}
                className="py-1.5 px-2 rounded-md text-xs bg-bg-tertiary text-text-tertiary hover:text-text disabled:opacity-30 border border-border-secondary"
              >
                Bold
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

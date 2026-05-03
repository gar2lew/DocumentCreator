import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTemplates } from "../hooks/useTemplates";
import { useAppStore } from "../../../store";
import { VersionHistory } from "./VersionHistory";
import { ProjectSelector } from "../../projects/components/ProjectSelector";
import { ExportPanel } from "../../export/components/ExportPanel";
import { applyPlaceholders, buildProjectPlaceholders, extractPlaceholders } from "../../../shared/utils/placeholders";
import { useDebounce } from "../../../shared/utils/useDebounce";
import type { Template } from "../../../shared/types";
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
  const saveComment = useRef<string | undefined>(undefined);
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
        lastSavedSignature.current = buildDraftSignature(t.content, t.name, t.description, t.templateKind);
      }
      setSelectedTemplate(t);
    }
  }, [id, templates]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------ debounced auto-save (500ms) ----------------
  const performSave = useCallback(
    async (tid: string, c: string, n: string, d: string, kind: Template["templateKind"], fields: Template["fields"]) => {
      const nextSignature = buildDraftSignature(c, n, d, kind);
      if (!template || template.locked || nextSignature === lastSavedSignature.current) return;

      setSaveStatus("saving");
      try {
        await save(tid, { name: n, description: d, templateKind: kind ?? null, content: c, fields }, saveComment.current);
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

  function handleContentChange(val: string) {
    if (!template || template.locked) return;
    setContent(val);
    if (buildDraftSignature(val, name, description, templateKind) === lastSavedSignature.current) return;
    setSaveStatus("pending");
    debouncedSave(template.id, val, name, description, templateKind, template.fields);
  }

  function handleNameChange(val: string) {
    if (!template || template.locked) return;
    setName(val);
    if (buildDraftSignature(content, val, description, templateKind) === lastSavedSignature.current) return;
    setSaveStatus("pending");
    debouncedSave(template.id, content, val, description, templateKind, template.fields);
  }

  function handleTemplateKindChange(val: string) {
    if (!template || template.locked) return;
    const nextKind = (val || null) as Template["templateKind"];
    setTemplateKind(nextKind);
    if (buildDraftSignature(content, name, description, nextKind) === lastSavedSignature.current) return;
    setSaveStatus("pending");
    debouncedSave(template.id, content, name, description, nextKind, template.fields);
  }

  // Manual save (e.g. Ctrl+S)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (template && !template.locked) {
          performSave(template.id, content, name, description, templateKind, template.fields);
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [template, content, name, description, templateKind, performSave]);

  const placeholders = extractPlaceholders(content);

  const previewContent = useCallback(() => {
    const projectData = selectedProject ? buildProjectPlaceholders(selectedProject) : {};
    return applyPlaceholders(content, { ...projectData, ...manualData });
  }, [content, selectedProject, manualData]);

  if (!template) return <div className="p-6 text-gray-400">Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0 flex-wrap gap-y-2">
        <button
          onClick={() => navigate("/templates")}
          className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
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
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:cursor-not-allowed"
        >
          <option value="">None</option>
          <option value="deed">Deed</option>
          <option value="loan_agreement">Loan Agreement</option>
        </select>

        {template.locked && (
          <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-900/20 px-2 py-1 rounded-full">
            <AlertCircle className="w-3 h-3" /> Locked
          </span>
        )}

        <SaveIndicator status={saveStatus} />

        <span className="text-xs text-gray-600 hidden sm:block">v{template.currentVersion}</span>

        <div className="flex-1 min-w-0" />

        <ProjectSelector />

        <ModeToggle mode={mode} onChange={setMode} />

        <button
          onClick={() => setShowHistory(true)}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          title="Version History"
        >
          <History className="w-4 h-4" />
        </button>
        <button
          onClick={() => toggleLock(template.id, !template.locked)}
          className="p-2 text-gray-400 hover:text-amber-400 hover:bg-gray-800 rounded-lg transition-colors"
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

      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 overflow-auto relative">
          {mode === "edit" ? (
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              disabled={template.locked}
              className="w-full h-full min-h-full p-6 bg-gray-950 text-gray-100 font-mono text-sm resize-none focus:outline-none disabled:cursor-not-allowed leading-relaxed"
              placeholder={`Start writing your template.\n\nUse <<placeholder>> for dynamic values.\n\nExamples:\n  <<client_name>>\n  <<date>>\n  <<amount_currency>>\n  <<amount_words>>`}
              spellCheck={false}
            />
          ) : (
            <div className="p-8 max-w-3xl mx-auto">
              <div className="bg-white rounded-xl p-10 shadow-lg text-gray-900 whitespace-pre-wrap leading-relaxed text-sm">
                {previewContent() || <span className="text-gray-400 italic">Nothing to preview.</span>}
              </div>
            </div>
          )}
        </div>

        {/* Placeholder sidebar */}
        {placeholders.length > 0 && mode === "edit" && (
          <div className="w-64 border-l border-gray-800 bg-gray-900 overflow-y-auto shrink-0">
            <div className="p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Placeholders ({placeholders.length})
              </p>
              <div className="space-y-2">
                {placeholders.map((key) => {
                  const autoValue = selectedProject ? buildProjectPlaceholders(selectedProject)[key] : undefined;
                  return (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-0.5 font-mono">&lt;&lt;{key}&gt;&gt;</label>
                      <input
                        className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        value={manualData[key] ?? ""}
                        onChange={(e) => setManualData((d) => ({ ...d, [key]: e.target.value }))}
                        placeholder={autoValue ?? "(from project)"}
                      />
                    </div>
                  );
                })}
              </div>
              {selectedProject && (
                <p className="text-xs text-gray-600 mt-3 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  Using data from <span className="text-gray-400">{selectedProject.name}</span>
                </p>
              )}
              <p className="text-xs text-gray-600 mt-2">Manual values override project data.</p>
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
    saving: { label: "Saving…", cls: "text-gray-400", icon: <RotateCcw className="w-3 h-3 animate-spin" /> },
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
    <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
      {(["edit", "preview"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${mode === m ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"}`}
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

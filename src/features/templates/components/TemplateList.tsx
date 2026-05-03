import { useState } from "react";
import { useTemplates } from "../hooks/useTemplates";
import { useAppStore } from "../../../store";
import { useCanDo } from "../../../shared/components/RoleGuard";
import type { Template } from "../../../shared/types";
import { Plus, FileText, Lock, Unlock, Trash2, ChevronRight, FileCode, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NewTemplateModal } from "./NewTemplateModal";

export function TemplateList() {
  const { currentUser } = useAppStore();
  const { templates, loading, create, toggleLock, remove, duplicate } = useTemplates();
  const [showNew, setShowNew] = useState(false);
  const navigate = useNavigate();

  const canEdit = useCanDo("editor");
  const canAdmin = useCanDo("admin");

  if (!currentUser) return null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Templates</h1>
          <p className="text-gray-400 text-sm mt-1">
            {templates.length} template{templates.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Template
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 bg-gray-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState onAdd={() => setShowNew(true)} />
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              canEdit={canEdit}
              canAdmin={canAdmin}
              onOpen={() => navigate(`/templates/${t.id}`)}
              onToggleLock={() => toggleLock(t.id, !t.locked)}
              onDuplicate={() => duplicate(t)}
              onDelete={() => confirm(`Delete "${t.name}"? This cannot be undone.`) && remove(t.id)}
            />
          ))}
        </div>
      )}

      {showNew && (
        <NewTemplateModal
          organisationId={currentUser.organisationId}
          createdBy={currentUser.uid}
          onCreate={create}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function TemplateRow({
  template,
  canEdit,
  canAdmin,
  onOpen,
  onToggleLock,
  onDuplicate,
  onDelete,
}: {
  template: Template;
  canEdit: boolean;
  canAdmin: boolean;
  onOpen: () => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const kindBadge = template.templateKind === "deed"
    ? { label: "DEED", cls: "bg-blue-900/30 text-blue-400" }
    : template.templateKind === "loan_agreement"
      ? { label: "LOAN", cls: "bg-green-900/30 text-green-400" }
      : null;

  return (
    <div className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 hover:border-gray-700 transition-colors group">
      <div className="p-2 bg-gray-800 rounded-lg">
        {template.type === "pdf" ? (
          <FileCode className="w-5 h-5 text-orange-400" />
        ) : template.type === "docx" ? (
          <FileText className="w-5 h-5 text-green-400" />
        ) : (
          <FileText className="w-5 h-5 text-blue-400" />
        )}
      </div>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium text-white truncate">{template.name}</h3>
          {template.locked && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
              template.type === "pdf"
                ? "bg-orange-900/30 text-orange-400"
                : template.type === "docx"
                  ? "bg-green-900/30 text-green-400"
                  : "bg-blue-900/30 text-blue-400"
            }`}
          >
            {template.type.toUpperCase()}
          </span>
          {kindBadge && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${kindBadge.cls}`}>
              {kindBadge.label}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5 truncate">
          v{template.currentVersion} · {template.updatedAt.toLocaleDateString()}
          {template.description && ` · ${template.description}`}
        </p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canEdit && (
          <button
            onClick={onDuplicate}
            title="Duplicate"
            className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}

        {canAdmin && (
          <button
            onClick={onToggleLock}
            title={template.locked ? "Unlock" : "Lock"}
            className="p-2 text-gray-400 hover:text-amber-400 hover:bg-gray-800 rounded-lg transition-colors"
          >
            {template.locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>
        )}

        {canAdmin && (
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onOpen}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-20 text-gray-500">
      <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
      <p className="text-lg font-medium text-gray-400">No templates yet</p>
      <p className="text-sm mt-1">Create your first template to start generating documents</p>
      <button
        onClick={onAdd}
        className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm"
      >
        Create Template
      </button>
    </div>
  );
}

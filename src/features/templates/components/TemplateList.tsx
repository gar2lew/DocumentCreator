import { useState, useCallback, useMemo } from "react";
import { useTemplates } from "../hooks/useTemplates";
import { useAppStore } from "../../../store";
import { useCanDo } from "../../../shared/components/RoleGuard";
import type { Template } from "../../../shared/types";
import { Plus, FileText, Lock, Unlock, Trash2, ChevronRight, FileCode, Copy, Wand2, CheckSquare, Square, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NewTemplateModal } from "./NewTemplateModal";

const EXAMPLE_TEMPLATE_CONTENT = `DEED OF SETTLEMENT

Date: <<agreement_date>>

Lender: <<lender_name>>

Borrower: <<project_name>>

ACN <<project_acn>>

Amount: <<total_full>>
`;

export function TemplateList() {
  const { currentUser } = useAppStore();
  const { templates, loading, create, toggleLock, remove, duplicate } = useTemplates();
  const [showNew, setShowNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "text" | "docx" | "pdf">("all");
  const [kindFilter, setKindFilter] = useState<"all" | "deed" | "loan_agreement">("all");
  const [lifecycleFilter, setLifecycleFilter] = useState<"all" | "draft" | "review" | "approved" | "deprecated" | "archived">("all");
  const [canonicalityFilter, setCanonicalityFilter] = useState<"all" | "legacy" | "hybrid" | "semantic-canonical">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "name_asc" | "name_desc">("newest");
  const navigate = useNavigate();

  const canEdit = useCanDo("editor");
  const canAdmin = useCanDo("admin");

  const filteredTemplates = useMemo(() => {
    let result = templates;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }

    if (typeFilter !== "all") {
      result = result.filter((t) => t.type === typeFilter);
    }

    if (kindFilter !== "all") {
      result = result.filter((t) => t.templateKind === kindFilter);
    }

    if (lifecycleFilter !== "all") {
      result = result.filter((t) => (t.lifecycleState ?? 'draft') === lifecycleFilter);
    }

    if (canonicalityFilter !== "all") {
      result = result.filter((t) => (t.canonicalityState ?? 'legacy') === canonicalityFilter);
    }

    result = [...result].sort((a, b) => {
      switch (sort) {
        case "oldest": return a.createdAt.getTime() - b.createdAt.getTime();
        case "name_asc": return a.name.localeCompare(b.name);
        case "name_desc": return b.name.localeCompare(a.name);
        default: return b.updatedAt.getTime() - a.updatedAt.getTime();
      }
    });

    return result;
  }, [templates, search, typeFilter, kindFilter, lifecycleFilter, canonicalityFilter, sort]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} template${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`)) {
      selectedIds.forEach((id) => remove(id));
      setSelectedIds(new Set());
      setBulkMode(false);
    }
  }, [selectedIds, remove]);

  if (!currentUser) return null;
  const organisationId = currentUser.organisationId;
  const createdBy = currentUser.uid;

  async function handleLoadExampleTemplate() {
    await create({
      organisationId,
      createdBy,
      name: "Deed of Settlement",
      description: "Example text template for settlement documents",
      type: "text",
      templateKind: "deed",
      content: EXAMPLE_TEMPLATE_CONTENT,
      fields: [],
      placeholders: [
        "agreement_date",
        "lender_name",
        "project_name",
        "project_acn",
        "total_full",
      ],
    });
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Templates</h1>
          <p className="text-text-tertiary text-sm mt-1">
            {filteredTemplates.length} of {templates.length} template{templates.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAdmin && (
            <button
              onClick={() => { setBulkMode(!bulkMode); if (bulkMode) setSelectedIds(new Set()); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                bulkMode ? 'bg-indigo-600 text-white' : 'text-text-tertiary hover:text-text hover:bg-bg-tertiary'
              }`}
            >
              {bulkMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {bulkMode ? 'Done' : 'Select'}
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Template
            </button>
          )}
        </div>
      </div>

      {bulkMode && selectedIds.size > 0 && (
        <div className="flex items-center justify-between mb-4 bg-bg-secondary border border-border rounded-xl px-4 py-3">
          <span className="text-sm text-text-secondary">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" /> Delete Selected
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg-input border border-border-secondary rounded-lg pl-9 pr-8 py-2 text-sm text-text placeholder:text-text-tertiary focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Types</option>
          <option value="text">Text</option>
          <option value="docx">DOCX</option>
          <option value="pdf">PDF</option>
        </select>

        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
          className="bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Kinds</option>
          <option value="deed">Deed</option>
          <option value="loan_agreement">Loan Agreement</option>
        </select>

        <select
          value={lifecycleFilter}
          onChange={(e) => setLifecycleFilter(e.target.value as typeof lifecycleFilter)}
          className="bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All States</option>
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="approved">Approved</option>
          <option value="deprecated">Deprecated</option>
          <option value="archived">Archived</option>
        </select>

        <select
          value={canonicalityFilter}
          onChange={(e) => setCanonicalityFilter(e.target.value as typeof canonicalityFilter)}
          className="bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Canonicality</option>
          <option value="legacy">Legacy</option>
          <option value="hybrid">Hybrid</option>
          <option value="semantic-canonical">Semantic</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-indigo-500"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name_asc">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 bg-bg-secondary rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          canEdit={canEdit}
          onAdd={() => setShowNew(true)}
          onLoadExample={handleLoadExampleTemplate}
          onGenerate={() => navigate("/documents/generate")}
          hasFilters={!!search || typeFilter !== "all" || kindFilter !== "all" || lifecycleFilter !== "all" || canonicalityFilter !== "all"}
          onClearFilters={() => { setSearch(""); setTypeFilter("all"); setKindFilter("all"); setLifecycleFilter("all"); setCanonicalityFilter("all"); }}
        />
      ) : (
        <div className="space-y-2">
          {filteredTemplates.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              canEdit={canEdit}
              canAdmin={canAdmin}
              bulkMode={bulkMode}
              selected={selectedIds.has(t.id)}
              onToggleSelect={() => toggleSelect(t.id)}
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
          organisationId={organisationId}
          createdBy={createdBy}
          onCreate={create}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function lifecycleBadgeCls(state: string): string {
  switch (state) {
    case 'review': return 'bg-amber-900/30 text-amber-400';
    case 'approved': return 'bg-green-900/30 text-green-400';
    case 'deprecated': return 'bg-red-900/30 text-red-400';
    case 'archived': return 'bg-gray-700/50 text-text-tertiary';
    default: return 'bg-indigo-900/30 text-indigo-400';
  }
}

function TemplateRow({
  template,
  canEdit,
  canAdmin,
  bulkMode,
  selected,
  onToggleSelect,
  onOpen,
  onToggleLock,
  onDuplicate,
  onDelete,
}: {
  template: Template;
  canEdit: boolean;
  canAdmin: boolean;
  bulkMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
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

  const lifecycleBadge = template.lifecycleState && template.lifecycleState !== 'draft'
    ? { label: template.lifecycleState.toUpperCase(), cls: lifecycleBadgeCls(template.lifecycleState) }
    : null;

  const canonicalityBadge = template.canonicalityState === 'hybrid'
    ? { label: 'HYBRID', cls: 'bg-indigo-900/30 text-indigo-400' }
    : template.canonicalityState === 'semantic-canonical'
      ? { label: 'SEMANTIC', cls: 'bg-green-900/30 text-green-400' }
      : null;

  return (
    <div className={`flex items-center gap-4 bg-bg-secondary border border-border rounded-xl px-5 py-4 hover:border-border-secondary transition-colors group ${selected ? 'border-indigo-500 bg-indigo-900/10' : ''}`}>
      {bulkMode && canAdmin && (
        <button
          onClick={onToggleSelect}
          className="p-1 text-text-tertiary hover:text-indigo-400 transition-colors"
        >
          {selected ? <CheckSquare className="w-5 h-5 text-indigo-400" /> : <Square className="w-5 h-5" />}
        </button>
      )}

      <div className="p-2 bg-bg-tertiary rounded-lg">
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
          <h3 className="font-medium text-text truncate">{template.name}</h3>
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
          {lifecycleBadge && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${lifecycleBadge.cls}`}>
              {lifecycleBadge.label}
            </span>
          )}
          {canonicalityBadge && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${canonicalityBadge.cls}`}>
              {canonicalityBadge.label}
            </span>
          )}
        </div>
        <p className="text-sm text-text-tertiary mt-0.5 truncate">
          v{template.currentVersion} · {template.updatedAt.toLocaleDateString()}
          {template.description && ` · ${template.description}`}
        </p>
      </div>

      {!bulkMode && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canEdit && (
            <button
              onClick={onDuplicate}
              title="Duplicate"
              className="p-2 text-text-tertiary hover:text-indigo-400 hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}

          {canAdmin && (
            <button
              onClick={onToggleLock}
              title={template.locked ? "Unlock" : "Lock"}
              className="p-2 text-text-tertiary hover:text-amber-400 hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              {template.locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </button>
          )}

          {canAdmin && (
            <button
              onClick={onDelete}
              className="p-2 text-text-tertiary hover:text-red-400 hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onOpen}
            className="p-2 text-text-tertiary hover:text-text hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  canEdit,
  onAdd,
  onLoadExample,
  onGenerate,
  hasFilters,
  onClearFilters,
}: {
  canEdit: boolean;
  onAdd: () => void;
  onLoadExample: () => void;
  onGenerate: () => void;
  hasFilters?: boolean;
  onClearFilters?: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="text-center py-20 text-text-tertiary bg-bg-secondary border border-border rounded-xl">
        <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium text-text-secondary">No templates match your filters</p>
        <p className="text-sm mt-1 text-text-tertiary">Try adjusting your search or filter criteria</p>
        <button
          onClick={onClearFilters}
          className="mt-4 inline-flex items-center gap-2 text-indigo-300 hover:text-indigo-200 text-sm"
        >
          Clear all filters
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-20 text-text-tertiary bg-bg-secondary border border-border rounded-xl">
      <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
      <p className="text-lg font-medium text-text-secondary">Create your first template</p>
      <p className="text-sm mt-1 text-text-tertiary">Upload a DOCX template or create a text template</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onAdd}
          disabled={!canEdit}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Create Template
        </button>
        <button
          onClick={onLoadExample}
          disabled={!canEdit}
          className="inline-flex items-center gap-2 border border-border-secondary hover:border-border-secondary disabled:opacity-50 text-text-secondary px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Wand2 className="w-4 h-4" />
          Load Example Template
        </button>
      </div>
      <button
        type="button"
        onClick={onGenerate}
        className="mt-4 text-sm text-indigo-300 hover:text-indigo-200"
      >
        Go to Generate Document
      </button>
    </div>
  );
}

import { useParams } from "react-router-dom";
import { useTemplates } from "../features/templates/hooks/useTemplates";
import { useEffect, useState } from "react";
import type { Template } from "../shared/types";
import TemplateEditor from "../features/templates/components/TemplateEditor";
import { PdfEditor } from "../features/pdf-editor/components/PdfEditor";
import { FileText, FileCode } from "lucide-react";

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { templates } = useTemplates();
  const [template, setTemplate] = useState<Template | null>(null);
  const [view, setView] = useState<"text" | "pdf">("text");

  useEffect(() => {
    const t = templates.find((t) => t.id === id);
    if (t) {
      setTemplate(t);
      setView(t.type === "pdf" ? "pdf" : "text");
    }
  }, [id, templates]);

  if (!template) return <div className="p-6 text-gray-400">Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      {template.type === "pdf" && (
        <div className="flex items-center gap-1 px-6 pt-4 pb-0 shrink-0">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            <TabBtn
              active={view === "text"}
              onClick={() => setView("text")}
              icon={<FileText className="w-3.5 h-3.5" />}
              label="Text Editor"
            />
            <TabBtn
              active={view === "pdf"}
              onClick={() => setView("pdf")}
              icon={<FileCode className="w-3.5 h-3.5" />}
              label="PDF Fields"
            />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {view === "pdf" ? <PdfEditor template={template} /> : <TemplateEditor />}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"}`}
    >
      {icon}
      {label}
    </button>
  );
}

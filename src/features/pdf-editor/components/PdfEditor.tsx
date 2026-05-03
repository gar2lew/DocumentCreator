import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { DraggableField } from './DraggableField';
import { FieldPropertiesPanel } from './FieldPropertiesPanel';
import { FieldPresetsPanel } from './FieldPresetsPanel';
import { usePdfEditor } from '../hooks/usePdfEditor';
import type { Template, PdfFieldDefinition } from '../../../shared/types';
import { Grid, Magnet, Upload, Save, ArrowLeft, Layers, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTemplates } from '../../templates/hooks/useTemplates';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '../../../shared/firebase/config';
import { updateTemplatePdfPath } from '../../templates/services/templateService';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface Props {
  template: Template;
}

const SCALE = 1.5;
const GUIDE_COLOR = 'rgba(99,102,241,0.5)';

export function PdfEditor({ template }: Props) {
  const navigate = useNavigate();
  const { save } = useTemplates();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guideCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sidePanel, setSidePanel] = useState<'presets' | 'properties'>('presets');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { fields, selectedId, selectedField, showGuides, snapEnabled,
    setSelectedId, setShowGuides, setSnapEnabled,
    addField, updateField, removeField } = usePdfEditor(template.fields, () => {});

  // Switch to properties when a field is selected
  useEffect(() => {
    if (selectedField) setSidePanel('properties');
  }, [selectedField]);

  const pageFields = fields.filter((f) => f.page === currentPage);

  const renderPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: SCALE });
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    setCanvasSize({ w: viewport.width, h: viewport.height });
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  }, []);

  useEffect(() => {
    if (pdfDoc) renderPage(pdfDoc, currentPage);
  }, [pdfDoc, currentPage, renderPage]);

  // Alignment guides
  useEffect(() => {
    const gc = guideCanvasRef.current;
    if (!gc) return;
    gc.width = canvasSize.w;
    gc.height = canvasSize.h;
    const ctx = gc.getContext('2d')!;
    ctx.clearRect(0, 0, gc.width, gc.height);
    if (!showGuides || !selectedField) return;
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const cx = (selectedField.x + selectedField.width / 2) * SCALE;
    const cy = (selectedField.y + selectedField.height / 2) * SCALE;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, gc.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(gc.width, cy); ctx.stroke();
  }, [selectedField, showGuides, canvasSize]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
      const path = `templates/${template.organisationId}/${template.id}/source.pdf`;
      await uploadBytes(storageRef(storage, path), file, { contentType: 'application/pdf' });
      await updateTemplatePdfPath(template.id, path);
    } finally {
      setUploading(false);
    }
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== containerRef.current && (e.target as HTMLElement).tagName !== 'CANVAS') return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    addField(currentPage, (e.clientX - rect.left) / SCALE, (e.clientY - rect.top) / SCALE);
  }

  function handlePresetAdd(defaults: Partial<PdfFieldDefinition>) {
    // Place preset near center of visible canvas
    const x = defaults.width ? Math.max(0, (canvasSize.w / SCALE / 2) - (defaults.width / 2)) : 100;
    const y = 100;
    const field = addField(currentPage, x, y);
    updateField(field.id, defaults);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await save(template.id, { name: template.name, description: template.description, content: template.content, fields });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0 flex-wrap gap-y-2">
        <button onClick={() => navigate('/templates')} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="font-semibold text-white truncate max-w-[200px]">{template.name}</span>
        <span className="text-xs text-gray-600">PDF Fields</span>
        <div className="flex-1" />

        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-lg text-xs transition-colors">
          <Upload className="w-3.5 h-3.5" /> {uploading ? 'Uploading…' : 'Load PDF'}
        </button>
        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />

        <button onClick={() => setSnapEnabled((s) => !s)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border ${snapEnabled ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
          <Magnet className="w-3.5 h-3.5" /> Snap
        </button>
        <button onClick={() => setShowGuides((g) => !g)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border ${showGuides ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
          <Grid className="w-3.5 h-3.5" /> Guides
        </button>

        {totalPages > 1 && (
          <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800 rounded-lg px-2">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="py-1 px-1 hover:text-white">‹</button>
            <span>{currentPage}/{totalPages}</span>
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="py-1 px-1 hover:text-white">›</button>
          </div>
        )}

        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save Fields'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-gray-800 flex items-start justify-center p-8">
          {!pdfDoc ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4 w-full">
              <div className="p-8 border-2 border-dashed border-gray-700 rounded-2xl text-center max-w-sm">
                <Upload className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium text-gray-400">Load a PDF to start placing fields</p>
                <p className="text-xs mt-1 text-gray-600">Click the PDF to add a field, or use the Presets panel →</p>
                <button onClick={() => fileInputRef.current?.click()} className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">
                  Upload PDF
                </button>
              </div>
            </div>
          ) : (
            <div
              className="relative shadow-2xl cursor-crosshair"
              ref={containerRef}
              style={{ width: canvasSize.w, height: canvasSize.h }}
              onClick={handleCanvasClick}
            >
              <canvas ref={canvasRef} className="block" />
              <canvas ref={guideCanvasRef} className="absolute inset-0 pointer-events-none" style={{ width: canvasSize.w, height: canvasSize.h }} />
              {pageFields.map((f) => (
                <DraggableField
                  key={f.id}
                  field={f}
                  scale={SCALE}
                  selected={selectedId === f.id}
                  onSelect={() => setSelectedId(f.id)}
                  onUpdate={(patch) => updateField(f.id, patch)}
                  onRemove={() => removeField(f.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel with tab switcher */}
        <div className="w-64 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
          <div className="flex border-b border-gray-800 shrink-0">
            <PanelTab active={sidePanel === 'presets'} onClick={() => setSidePanel('presets')} icon={<Layers className="w-3.5 h-3.5" />} label="Presets" />
            <PanelTab active={sidePanel === 'properties'} onClick={() => setSidePanel('properties')} icon={<Settings2 className="w-3.5 h-3.5" />} label="Properties" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {sidePanel === 'presets' ? (
              <FieldPresetsPanel onAdd={handlePresetAdd} />
            ) : selectedField ? (
              <FieldPropertiesPanel
                field={selectedField}
                onUpdate={(patch) => updateField(selectedField.id, patch)}
                onRemove={() => removeField(selectedField.id)}
              />
            ) : (
              <div className="p-4 text-xs text-gray-500">
                <p className="font-medium text-gray-400 mb-2">{pageFields.length} field(s) on page {currentPage}</p>
                <p>Click a field on the PDF to edit its properties.</p>
                {pageFields.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {pageFields.map((f) => (
                      <button key={f.id} onClick={() => setSelectedId(f.id)} className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-800 text-gray-300 truncate text-xs">
                        {f.name}
                        {f.placeholder && <span className="ml-1 text-gray-600 font-mono">{f.placeholder}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${active ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}>
      {icon}{label}
    </button>
  );
}

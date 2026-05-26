import { useState, useMemo, useRef } from 'react';
import {
  FileText, Sparkles, UploadCloud, Trash2, Download, Search, FileSpreadsheet,
  CheckCircle2, FileArchive, ArrowRight, Check, AlertCircle, RefreshCw
} from 'lucide-react';
import { extractPlaceholdersFromDocx } from '../features/documents/utils/docxPlaceholderExtractor';
import { generateDocxFromBuffer } from '../features/export/services/docxExporter';

// Simple native CSV / TSV parser that handles commas, tabs, and quotes correctly
function parseSpreadsheetText(text: string, isTSV: boolean): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];

  const delimiter = isTSV ? '\t' : ',';

  // Parse a CSV/TSV line respecting double-quotes
  const parseLine = (line: string) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const firstLine = lines[0];
  if (!firstLine) return [];

  const headers = parseLine(firstLine).map(h => 
    h.replace(/^["']|["']$/g, '').trim().toLowerCase()
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) {
        let val = values[index] ?? '';
        // Strip outer quotes
        val = val.replace(/^["']|["']$/g, '').trim();
        row[header] = val;
      }
    });
    rows.push(row);
  }
  return rows;
}

export function UniversalGeneratorPage() {
  // Template states
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateBuffer, setTemplateBuffer] = useState<ArrayBuffer | null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [delimiters, setDelimiters] = useState<{ start: string; end: string }>({ start: '<<', end: '>>' });
  const [isTemplateDragging, setIsTemplateDragging] = useState(false);

  // Data states
  const [inputMode, setInputMode] = useState<'manual' | 'spreadsheet'>('manual');
  const [manualData, setManualData] = useState<Record<string, string>>({});
  const [spreadsheetRows, setSpreadsheetRows] = useState<Record<string, string>[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tsvPasteText, setTsvPasteText] = useState('');
  const [isSpreadsheetDragging, setIsSpreadsheetDragging] = useState(false);

  // Status & Progress states
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const templateInputRef = useRef<HTMLInputElement>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);

  // Clean template uploads
  const handleTemplateFile = async (file: File) => {
    if (!file.name.endsWith('.docx')) {
      setStatus({ type: 'error', message: 'Please upload a valid Word document (.docx)' });
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const extracted = extractPlaceholdersFromDocx(buffer);
      
      setTemplateFile(file);
      setTemplateBuffer(buffer);
      setPlaceholders(extracted.placeholders);
      setDelimiters(extracted.detectedDelimiters);
      
      // Initialize manual fields
      const initData: Record<string, string> = {};
      extracted.placeholders.forEach(p => {
        initData[p] = '';
      });
      setManualData(initData);
      
      setStatus({ 
        type: 'success', 
        message: `Template "${file.name}" loaded! Detected ${extracted.placeholders.length} placeholders.` 
      });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to read DOCX file. The file may be corrupt.' });
    }
  };

  const handleTemplateDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsTemplateDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleTemplateFile(e.dataTransfer.files[0]);
    }
  };

  // Clean spreadsheet uploads
  const handleSpreadsheetFile = async (file: File) => {
    const isCSV = file.name.endsWith('.csv');
    const isTSV = file.name.endsWith('.tsv') || file.name.endsWith('.txt');
    
    if (!isCSV && !isTSV) {
      setStatus({ type: 'error', message: 'Please upload a CSV (.csv) or Tab-Separated file (.tsv, .txt)' });
      return;
    }

    try {
      const text = await file.text();
      const rows = parseSpreadsheetText(text, isTSV);
      if (rows.length === 0) {
        setStatus({ type: 'error', message: 'Spreadsheet contains no headers or records.' });
        return;
      }
      setSpreadsheetRows(rows);
      setSelectedRowIndex(0);
      populateManualFieldsFromRow(rows[0]);
      setStatus({ type: 'success', message: `Imported ${rows.length} records successfully!` });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to parse spreadsheet file.' });
    }
  };

  const handleSpreadsheetDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsSpreadsheetDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSpreadsheetFile(e.dataTransfer.files[0]);
    }
  };

  // Copy-paste Excel data (TSV)
  const handleTsvPaste = () => {
    if (!tsvPasteText.trim()) return;
    try {
      const rows = parseSpreadsheetText(tsvPasteText, true);
      if (rows.length === 0) {
        setStatus({ type: 'error', message: 'Pasted content could not be parsed. Verify headers and rows.' });
        return;
      }
      setSpreadsheetRows(rows);
      setSelectedRowIndex(0);
      populateManualFieldsFromRow(rows[0]);
      setTsvPasteText('');
      setStatus({ type: 'success', message: `Pasted & parsed ${rows.length} rows from clipboard!` });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to parse pasted clipboard content.' });
    }
  };

  // Row selection acts like a VLookup
  const populateManualFieldsFromRow = (row: Record<string, string>) => {
    const nextData: Record<string, string> = {};
    placeholders.forEach(placeholder => {
      // Look up column matching placeholder (case-insensitive)
      const normKey = placeholder.toLowerCase();
      nextData[placeholder] = row[normKey] ?? row[placeholder] ?? '';
    });
    setManualData(nextData);
  };

  const handleSelectRow = (index: number, row: Record<string, string>) => {
    setSelectedRowIndex(index);
    populateManualFieldsFromRow(row);
  };

  // Filter spreadsheet rows
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return spreadsheetRows;
    const query = searchQuery.toLowerCase();
    return spreadsheetRows.filter(row => 
      Object.values(row).some(val => val.toLowerCase().includes(query))
    );
  }, [spreadsheetRows, searchQuery]);

  // Single generation
  const triggerSingleDownload = async () => {
    if (!templateBuffer || !templateFile) return;
    setGenerating(true);
    setStatus(null);
    try {
      const blob = await generateDocxFromBuffer(templateBuffer, manualData, delimiters);
      
      // Determine dynamic file name
      let baseName = 'populated_document';
      const nameKey = Object.keys(manualData).find(key => 
        ['name', 'client', 'company', 'client_name', 'project_name'].includes(key.toLowerCase())
      );
      if (nameKey && manualData[nameKey].trim()) {
        baseName = manualData[nameKey].trim().replace(/[^\w\s-]/g, '_');
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Document generated and downloaded successfully!' });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to generate document.' });
    } finally {
      setGenerating(false);
    }
  };

  // Bulk ZIP generator
  const triggerBulkZip = async () => {
    if (!templateBuffer || !templateFile || spreadsheetRows.length === 0) return;
    
    // Dynamically import pizzip in chunks
    const [{ default: PizZip }] = await Promise.all([
      import('pizzip'),
    ]);

    setGenerating(true);
    setStatus(null);
    setBulkProgress({ current: 0, total: spreadsheetRows.length });

    try {
      const zip = new PizZip();
      
      // Find clean title column for file naming
      const nameHeader = Object.keys(spreadsheetRows[0]).find(h => 
        ['name', 'client', 'company', 'client_name', 'project_name', 'id'].includes(h.toLowerCase())
      ) ?? Object.keys(spreadsheetRows[0])[0];

      for (let i = 0; i < spreadsheetRows.length; i++) {
        setBulkProgress({ current: i + 1, total: spreadsheetRows.length });
        const row = spreadsheetRows[i];
        
        // Map placeholders for this row
        const rowPlaceholderValues: Record<string, string> = {};
        placeholders.forEach(p => {
          const normKey = p.toLowerCase();
          rowPlaceholderValues[p] = row[normKey] ?? row[p] ?? '';
        });

        const docBlob = await generateDocxFromBuffer(templateBuffer, rowPlaceholderValues, delimiters);
        
        const labelVal = row[nameHeader] ? row[nameHeader].replace(/[^\w\s-]/g, '_').trim() : `row_${i + 1}`;
        const fileName = `${labelVal}_document.docx`;
        
        // Add to zip (convert blob to arrayBuffer)
        const arrayBuffer = await docBlob.arrayBuffer();
        zip.file(fileName, arrayBuffer, { binary: true });
      }

      const zipBlob = zip.generate({
        type: 'blob',
        mimeType: 'application/zip'
      });

      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = zipUrl;
      const baseName = templateFile.name.replace(/\.docx$/, '');
      a.download = `${baseName}_bulk_export.zip`;
      a.click();
      URL.revokeObjectURL(zipUrl);

      setStatus({ 
        type: 'success', 
        message: `Success! Bulk generated ${spreadsheetRows.length} documents into a single ZIP file.` 
      });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Bulk generation failed.' });
    } finally {
      setGenerating(false);
      setBulkProgress(null);
    }
  };

  const handleReset = () => {
    setTemplateFile(null);
    setTemplateBuffer(null);
    setPlaceholders([]);
    setSpreadsheetRows([]);
    setSelectedRowIndex(null);
    setManualData({});
    setStatus(null);
  };

  // Completion count for manual fields
  const filledFieldsCount = Object.values(manualData).filter(v => v.trim() !== '').length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Universal Document Populator</h1>
          </div>
          <p className="text-text-tertiary text-sm mt-1">
            Dynamic document populating made simple. Upload any Word document, extract placeholders, and perform a live mail merge or VLookup.
          </p>
        </div>

        {templateFile && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-red-900/60 bg-red-950/20 text-xs font-semibold text-red-400 hover:bg-red-900/20 transition-all shrink-0 hover:border-red-500"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reset Workbench
          </button>
        )}
      </div>

      {/* Global Status Notifications */}
      {status && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 animate-fade-in ${
          status.type === 'success' 
            ? 'bg-green-950/30 border-green-800/80 text-green-300' 
            : 'bg-red-950/30 border-red-800/80 text-red-300'
        }`}>
          {status.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-green-400" />
          ) : (
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-400" />
          )}
          <p className="text-sm font-medium leading-relaxed">{status.message}</p>
        </div>
      )}

      {/* STEP 1: DOCX Upload / Drag & Drop */}
      {!templateFile ? (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsTemplateDragging(true); }}
          onDragLeave={() => setIsTemplateDragging(false)}
          onDrop={handleTemplateDrop}
          onClick={() => templateInputRef.current?.click()}
          className={`group flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer ${
            isTemplateDragging 
              ? 'border-indigo-500 bg-indigo-950/30 scale-[0.99] shadow-indigo-500/10' 
              : 'border-border bg-bg-secondary/40 hover:border-indigo-600 hover:bg-bg-secondary/70 hover:shadow-lg'
          }`}
        >
          <input 
            type="file" 
            ref={templateInputRef} 
            onChange={(e) => e.target.files?.[0] && handleTemplateFile(e.target.files[0])}
            accept=".docx"
            className="hidden" 
          />
          <div className="p-4 bg-bg/60 rounded-full border border-border group-hover:scale-110 transition-transform shadow-inner group-hover:border-indigo-500/40 group-hover:bg-indigo-950/40">
            <UploadCloud className="w-8 h-8 text-indigo-400 group-hover:text-indigo-300" />
          </div>
          <h2 className="text-lg font-semibold text-white mt-5">Upload your Word Template</h2>
          <p className="text-text-tertiary text-xs text-center mt-2 max-w-sm">
            Drag & drop your populated <code className="text-indigo-300 px-1 bg-indigo-950/40 border border-indigo-900/60 rounded">.docx</code> file here, or click to browse.
          </p>
          <div className="flex gap-4 mt-6 text-[10px] text-text-tertiary">
            <span>Supports standard tags: <code className="text-text-tertiary">{"{name}"}</code>, <code className="text-text-tertiary">{"{{name}}"}</code>, or <code className="text-text-tertiary">{"<<name>>"}</code></span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Sidebar Panel: Template Info & Extracted Placeholders */}
          <div className="bg-bg-secondary border border-border rounded-2xl p-5 shadow-xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-900/50 border border-indigo-800 rounded-lg">
                <FileText className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{templateFile.name}</h3>
                <p className="text-text-tertiary text-xs mt-0.5">{(templateFile.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-3.5">
              <div className="flex items-center justify-between text-xs text-text-tertiary">
                <span>Delimiter Syntax:</span>
                <span className="font-semibold px-2 py-0.5 bg-bg rounded border border-border text-indigo-300">
                  {delimiters.start}placeholder{delimiters.end}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-text-tertiary">Extracted Placeholders ({placeholders.length})</span>
                  <span className="text-[10px] text-text-tertiary font-mono">Normalized</span>
                </div>
                {placeholders.length === 0 ? (
                  <p className="text-xs text-amber-400 italic">No placeholders found. Add placeholders to your document first.</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto border border-border/80 bg-bg/40 rounded-xl p-2.5 space-y-1.5">
                    {placeholders.map((p) => {
                      const isFilled = manualData[p]?.trim() !== '';
                      return (
                        <div key={p} className="flex items-center justify-between text-[11px] px-2 py-1 bg-bg-secondary rounded border border-border">
                          <span className="text-text-secondary font-mono truncate mr-2" title={p}>{p}</span>
                          {isFilled ? (
                            <span className="flex items-center gap-0.5 text-emerald-400 text-[10px] font-semibold shrink-0">
                              <Check className="w-3 h-3" /> Filled
                            </span>
                          ) : (
                            <span className="text-gray-600 text-[10px] shrink-0 font-medium">Empty</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Panel: Data Source & Form Fields */}
          <div className="lg:col-span-2 space-y-6">
            {/* Input Mode Selector */}
            <div className="bg-bg-secondary border border-border rounded-2xl p-1.5 flex gap-1 shadow-md">
              <button
                type="button"
                onClick={() => setInputMode('manual')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  inputMode === 'manual' 
                    ? 'bg-indigo-600 text-text shadow-md' 
                    : 'text-text-tertiary hover:text-text hover:bg-bg-tertiary'
                }`}
              >
                <FileText className="w-4 h-4" />
                Manual Entry Form
              </button>
              <button
                type="button"
                onClick={() => setInputMode('spreadsheet')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  inputMode === 'spreadsheet' 
                    ? 'bg-indigo-600 text-text shadow-md' 
                    : 'text-text-tertiary hover:text-text hover:bg-bg-tertiary'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Spreadsheet Mail Merge
              </button>
            </div>

            {/* TAB 1: MANUAL ENTRY */}
            {inputMode === 'manual' && (
              <div className="bg-bg-secondary border border-border rounded-2xl p-6 shadow-xl space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-text">Manual Placement Form</h3>
                    <span className="text-xs text-text-tertiary font-medium">
                      Completed: <strong className="text-indigo-400">{filledFieldsCount}</strong> / {placeholders.length}
                    </span>
                  </div>
                  <p className="text-xs text-text-tertiary mt-1">Enter replacement text for each placeholder below to compile a single document.</p>
                </div>

                {placeholders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 bg-bg/40 rounded-xl border border-border/80">
                    <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
                    <p className="text-sm font-semibold text-text-tertiary">Empty Placeholder Registry</p>
                    <p className="text-xs text-text-tertiary text-center max-w-xs mt-1">Add placeholders like `{"{{placeholder}}"}` to your Word doc before uploading.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {placeholders.map((p) => (
                      <div key={p} className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-tertiary flex items-center justify-between">
                          <span className="font-mono">{p}</span>
                          {manualData[p]?.trim() && <span className="text-[10px] text-indigo-400 font-normal">Active</span>}
                        </label>
                        <input
                          type="text"
                          value={manualData[p] ?? ''}
                          onChange={(e) => setManualData(prev => ({ ...prev, [p]: e.target.value }))}
                          placeholder={`Value for ${p}...`}
                          className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder-text-tertiary"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-border pt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={triggerSingleDownload}
                    disabled={generating || placeholders.length === 0}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    {generating ? 'Generating Document...' : 'Generate & Download'}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: SPREADSHEET MAIL MERGE */}
            {inputMode === 'spreadsheet' && (
              <div className="space-y-6">
                {/* Loader Dashboard */}
                {spreadsheetRows.length === 0 ? (
                  <div className="bg-bg-secondary border border-border rounded-2xl p-6 shadow-xl space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-text">Import Spreadsheet Data</h3>
                      <p className="text-xs text-text-tertiary mt-1">Upload a CSV table or paste direct rows from Google Sheets / MS Excel.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Sub-uploader */}
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsSpreadsheetDragging(true); }}
                        onDragLeave={() => setIsSpreadsheetDragging(false)}
                        onDrop={handleSpreadsheetDrop}
                        onClick={() => sheetInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center border border-dashed rounded-xl p-6 transition-all cursor-pointer bg-bg/20 ${
                          isSpreadsheetDragging 
                            ? 'border-indigo-500 bg-indigo-950/20' 
                            : 'border-border hover:border-indigo-600/80 hover:bg-bg/40'
                        }`}
                      >
                        <input 
                          type="file" 
                          ref={sheetInputRef}
                          onChange={(e) => e.target.files?.[0] && handleSpreadsheetFile(e.target.files[0])}
                          accept=".csv,.tsv,.txt"
                          className="hidden" 
                        />
                        <FileSpreadsheet className="w-6 h-6 text-indigo-400 mb-2" />
                        <span className="text-xs font-semibold text-white">Upload CSV File</span>
                        <span className="text-[10px] text-text-tertiary mt-1">Drag & drop CSV or click to browse</span>
                      </div>

                      {/* TSV clipboard box */}
                      <div className="border border-border rounded-xl p-4 bg-bg/20 flex flex-col justify-between gap-3">
                        <textarea
                          value={tsvPasteText}
                          onChange={(e) => setTsvPasteText(e.target.value)}
                          placeholder="Or click here and paste (Ctrl+V) cell ranges copied directly from Microsoft Excel or Google Sheets..."
                          className="w-full flex-1 min-h-[80px] bg-bg border border-border rounded-lg p-2 text-xs text-text placeholder-text-tertiary focus:outline-none focus:border-indigo-500 transition-colors resize-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleTsvPaste}
                          disabled={!tsvPasteText.trim()}
                          className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs py-2 rounded-lg transition-all"
                        >
                          <ArrowRight className="w-3.5 h-3.5" /> Parse Clipboard Data
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-bg-secondary border border-border rounded-2xl p-6 shadow-xl space-y-6">
                    {/* Toolbar */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
                      <div>
                        <h3 className="text-base font-bold text-text">Spreadsheet Data Source</h3>
                        <p className="text-xs text-text-tertiary mt-1">
                          Loaded <strong className="text-indigo-400">{spreadsheetRows.length}</strong> records. Select a row to preview/VLookup manual entries.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSpreadsheetRows([])}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-tertiary hover:text-text hover:bg-bg-tertiary transition-colors"
                        >
                          Clear Spreadsheet
                        </button>
                      </div>
                    </div>

                    {/* VLookup Table Search */}
                    <div className="flex items-center gap-2 bg-bg border border-border rounded-xl px-3 py-2 max-w-sm">
                      <Search className="w-4 h-4 text-text-tertiary" />
                      <input
                        type="text"
                        placeholder="Search/VLookup records..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-transparent border-none text-xs text-white focus:outline-none placeholder-gray-600 w-full"
                      />
                    </div>

                    {/* Interactive Table */}
                    <div className="border border-border rounded-xl overflow-hidden bg-bg/30">
                      <div className="overflow-x-auto max-h-[300px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-bg border-b border-border text-text-tertiary font-semibold uppercase tracking-wider sticky top-0">
                              <th className="px-4 py-2.5 w-12 text-center">Sel</th>
                              {Object.keys(spreadsheetRows[0]).map((header) => (
                                <th key={header} className="px-4 py-2.5 font-semibold text-[10px]">{header}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRows.length === 0 ? (
                              <tr>
                                <td colSpan={Object.keys(spreadsheetRows[0]).length + 1} className="text-center py-8 text-text-tertiary italic">
                                  No records match search query.
                                </td>
                              </tr>
                            ) : (
                              filteredRows.map((row: Record<string, string>, idx: number) => {
                                const originalIdx = spreadsheetRows.indexOf(row);
                                const isSelected = selectedRowIndex === originalIdx;
                                return (
                                  <tr
                                    key={idx}
                                    onClick={() => handleSelectRow(originalIdx, row)}
                                    className={`border-b border-border-secondary hover:bg-bg-secondary/60 cursor-pointer transition-colors ${
                                      isSelected ? 'bg-indigo-950/40 text-indigo-300' : 'text-text-secondary'
                                    }`}
                                  >
                                    <td className="px-4 py-2 text-center shrink-0">
                                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center mx-auto transition-colors ${
                                        isSelected ? 'border-indigo-400 bg-indigo-500/20' : 'border-border'
                                      }`}>
                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                                      </div>
                                    </td>
                                    {Object.keys(spreadsheetRows[0]).map((header) => (
                                      <td key={header} className="px-4 py-2 font-mono text-[11px] max-w-[200px] truncate" title={row[header]}>
                                        {row[header] || '-'}
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* VLookup Sync Indicator */}
                    {selectedRowIndex !== null && spreadsheetRows[selectedRowIndex] && (
                      <div className="p-3.5 bg-indigo-950/15 border border-indigo-900/40 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-indigo-300">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-400 animate-pulse" />
                          <span>
                            VLookup Sync Active: Form populated with record #{selectedRowIndex + 1} (Row {selectedRowIndex + 2} in sheet).
                          </span>
                        </div>
                        <span className="text-[10px] text-text-tertiary font-mono">Click manual fields above to refine details.</span>
                      </div>
                    )}

                    {/* Bulk Generative Progress */}
                    {generating && bulkProgress && (
                      <div className="bg-bg border border-border rounded-xl p-4 space-y-2 animate-pulse">
                        <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                            Processing Bulk Render Pipeline
                          </span>
                          <span>{bulkProgress.current} / {bulkProgress.total} Documents</span>
                        </div>
                        <div className="w-full bg-bg-secondary rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-indigo-500 h-1.5 rounded-full transition-all duration-150"
                            style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-text-tertiary">Compiling templates and packing files into ZIP client-side...</p>
                      </div>
                    )}

                    {/* Bulk Render Tools */}
                    <div className="border-t border-border pt-5 flex flex-wrap gap-3 justify-between">
                      {/* VLookup individual generation */}
                      <button
                        type="button"
                        onClick={triggerSingleDownload}
                        disabled={generating || selectedRowIndex === null}
                        className="flex items-center gap-2 bg-bg-tertiary hover:bg-bg-tertiary disabled:opacity-50 text-text font-semibold text-xs px-4 py-2.5 rounded-xl transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Selected Record
                      </button>

                      {/* Bulk mail merge download */}
                      <button
                        type="button"
                        onClick={triggerBulkZip}
                        disabled={generating || spreadsheetRows.length === 0}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95"
                      >
                        <FileArchive className="w-4 h-4" />
                        Bulk Generate All ({spreadsheetRows.length} DOCX in ZIP)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import type { Template } from '../../../shared/types';
import { getFieldCatalogForKind, getFieldCategories, type FieldCatalogEntry } from './semanticFieldCatalog';
import { Search, Plus, Layers, WrapText, Info, CaseSensitive } from 'lucide-react';

interface SemanticAuthoringPanelProps {
  editor: Editor | null;
  templateKind: Template['templateKind'];
  existingPlaceholders: string[];
  existingConditionals: string[];
  existingLoops: string[];
}

type SubTab = 'insert' | 'blocks' | 'inspector';

export function SemanticAuthoringPanel({
  editor,
  templateKind,
  existingPlaceholders,
  existingConditionals,
  existingLoops,
}: SemanticAuthoringPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>('insert');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const catalog = useMemo(() => getFieldCatalogForKind(templateKind), [templateKind]);
  const categories = useMemo(() => getFieldCategories(catalog), [catalog]);

  const filteredCatalog = useMemo(() => {
    let result = catalog;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) => e.key.toLowerCase().includes(q) || e.label.toLowerCase().includes(q));
    }
    if (selectedCategory) {
      result = result.filter((e) => e.category === selectedCategory);
    }
    return result;
  }, [catalog, search, selectedCategory]);

  function insertField(key: string) {
    if (!editor) return;
    editor.chain().focus().insertContent(`<<${key}>>`).run();
  }

  function wrapConditional(key: string) {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);
    const replacement = selectedText
      ? `<<if ${key}>>${selectedText}<<endif>>`
      : `<<if ${key}>> content <<endif>>`;
    editor.chain().focus().deleteSelection().insertContent(replacement).run();
  }

  function wrapRepeat(key: string) {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);
    const replacement = selectedText
      ? `<<for ${key}>>${selectedText}<<endfor>>`
      : `<<for ${key}>> item <<endfor>>`;
    editor.chain().focus().deleteSelection().insertContent(replacement).run();
  }

  const typeIcon = (type: FieldCatalogEntry['type']) => {
    const cls = 'w-3 h-3';
    switch (type) {
      case 'text': return <CaseSensitive className={cls} />;
      case 'currency': return <span className="text-xs">$</span>;
      case 'number': return <span className="text-xs font-mono">#</span>;
      case 'date': return <span className="text-xs text-text-tertiary font-mono">d</span>;
      case 'percentage': return <span className="text-xs">%</span>;
      case 'words': return <span className="text-xs font-serif">W</span>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setSubTab('insert')}
          className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${subTab === 'insert' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-text-tertiary hover:text-text'}`}
        >
          <Plus className="w-3 h-3" /> Insert
        </button>
        <button
          onClick={() => setSubTab('blocks')}
          className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${subTab === 'blocks' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-text-tertiary hover:text-text'}`}
        >
          <Layers className="w-3 h-3" /> Blocks
        </button>
        <button
          onClick={() => setSubTab('inspector')}
          className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${subTab === 'inspector' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-text-tertiary hover:text-text'}`}
        >
          <Info className="w-3 h-3" /> Inspector
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {subTab === 'insert' && (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fields..."
                className="w-full bg-bg-input border border-border-secondary rounded-md pl-7 pr-2 py-1.5 text-xs text-text focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-2 py-0.5 rounded-full text-xs transition-colors ${!selectedCategory ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-700/50' : 'bg-bg-tertiary text-text-tertiary border border-border-secondary hover:text-text'}`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                  className={`px-2 py-0.5 rounded-full text-xs transition-colors ${selectedCategory === cat ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-700/50' : 'bg-bg-tertiary text-text-tertiary border border-border-secondary hover:text-text'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Field list */}
            <div className="space-y-1">
              {filteredCatalog.length === 0 && (
                <p className="text-xs text-text-tertiary text-center py-4">No fields found.</p>
              )}
              {filteredCatalog.map((entry) => {
                const alreadyUsed = existingPlaceholders.includes(entry.key);
                return (
                  <button
                    key={entry.key}
                    onClick={() => insertField(entry.key)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-left group"
                    title={entry.description ?? entry.label}
                  >
                    <span className="w-5 h-5 flex items-center justify-center text-text-tertiary shrink-0">
                      {typeIcon(entry.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-text block truncate">{entry.label}</span>
                      <span className="text-[10px] text-text-tertiary font-mono block truncate">{`<<${entry.key}>>`}</span>
                    </div>
                    {alreadyUsed && (
                      <span className="text-[10px] text-green-500 shrink-0">Used</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {subTab === 'blocks' && (
          <div className="space-y-4">
            {/* Conditional block */}
            <div>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <WrapText className="w-3 h-3" /> Conditional Block
              </p>
              <p className="text-xs text-text-tertiary mb-2">
                Wraps selected text in <code className="text-amber-400/80 font-mono">{'<<if key>>...<<endif>>'}</code>
              </p>
              {existingConditionals.length > 0 ? (
                <div className="space-y-1">
                  {existingConditionals.map((key) => (
                    <button
                      key={key}
                      onClick={() => wrapConditional(key)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-900/20 text-amber-400 hover:bg-amber-900/40 transition-colors text-left text-xs font-mono"
                    >
                      <Plus className="w-3 h-3 shrink-0" />
                      {'<<if '}{key}{'>>'}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-1">
                  {existingPlaceholders.slice(0, 5).map((key) => (
                    <button
                      key={key}
                      onClick={() => wrapConditional(key)}
                      className="px-2 py-1 rounded-md bg-amber-900/20 text-amber-400 hover:bg-amber-900/40 transition-colors text-xs font-mono"
                    >
                      {key}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Repeat block */}
            <div>
              <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Layers className="w-3 h-3" /> Repeat Block
              </p>
              <p className="text-xs text-text-tertiary mb-2">
                Wraps selected text in <code className="text-cyan-400/80 font-mono">{'<<for key>>...<<endfor>>'}</code>
              </p>
              {existingLoops.length > 0 ? (
                <div className="space-y-1">
                  {existingLoops.map((key) => (
                    <button
                      key={key}
                      onClick={() => wrapRepeat(key)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-cyan-900/20 text-cyan-400 hover:bg-cyan-900/40 transition-colors text-left text-xs font-mono"
                    >
                      <Plus className="w-3 h-3 shrink-0" />
                      {'<<for '}{key}{'>>'}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-tertiary italic">
                  Add a <code className="font-mono">{'<<for list_name>>'}</code> token in the editor first, then wrap content with it here.
                </p>
              )}
            </div>
          </div>
        )}

        {subTab === 'inspector' && (
          <SemanticInspector
            editor={editor}
            catalog={catalog}
          />
        )}
      </div>
    </div>
  );
}

function SemanticInspector({
  editor,
  catalog,
}: {
  editor: Editor | null;
  catalog: FieldCatalogEntry[];
}) {
  const selection = editor?.state.selection;
  const doc = editor?.state.doc;

  if (!editor || !selection || !doc) {
    return <p className="text-xs text-text-tertiary text-center py-4">Select content in the editor to inspect.</p>;
  }

  const { from, to } = selection;
  const selectedText = doc.textBetween(from, to);

  if (!selectedText) {
    return <p className="text-xs text-text-tertiary text-center py-4">Select content in the editor to inspect.</p>;
  }

  const placeholderMatch = selectedText.match(/<<(\w+)>>/);
  const ifMatch = selectedText.match(/<<if\s+(\w+)>>/);
  const forMatch = selectedText.match(/<<for\s+(\w+)>>/);

  const detectedKey = placeholderMatch?.[1] ?? ifMatch?.[1] ?? forMatch?.[1] ?? null;
  const detectedType = placeholderMatch ? 'field' : ifMatch ? 'conditional' : forMatch ? 'repeat' : 'text';
  const catalogEntry = detectedKey ? catalog.find((e) => e.key === detectedKey) : null;

  const selectionLen = to - from;
  const wordCount = selectedText.split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Selection</p>

      {/* Selection info */}
      <div className="bg-bg-tertiary rounded-md p-2 space-y-1.5">
        <InfoRow label="Characters" value={`${selectionLen}`} />
        <InfoRow label="Words" value={`${wordCount}`} />
        <InfoRow label="Type" value={detectedType === 'field' ? 'Field' : detectedType === 'conditional' ? 'Conditional' : detectedType === 'repeat' ? 'Repeat' : 'Plain text'} />
      </div>

      {/* If a placeholder or directive was detected */}
      {detectedKey && (
        <>
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Detected Field</p>
          <div className="bg-bg-tertiary rounded-md p-2 space-y-1.5">
            <InfoRow label="Key" value={`<<${detectedKey}>>`} mono />
            {catalogEntry && (
              <>
                <InfoRow label="Label" value={catalogEntry.label} />
                <InfoRow label="Category" value={catalogEntry.category} />
                <InfoRow label="Type" value={catalogEntry.type} />
              </>
            )}
            {!catalogEntry && (
              <p className="text-[10px] text-amber-400/80">Custom field — not in catalog</p>
            )}
          </div>

          {/* Render preview */}
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Resolver Preview</p>
          <div className="bg-bg-tertiary rounded-md p-2">
            <p className="text-xs text-text-tertiary font-mono break-all">
              resolveField("{detectedKey}", context)
            </p>
            <p className="text-[10px] text-text-tertiary mt-1">
              Field resolves at render time from context data.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-text-tertiary uppercase tracking-wider">{label}</span>
      <span className={`text-xs text-text ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

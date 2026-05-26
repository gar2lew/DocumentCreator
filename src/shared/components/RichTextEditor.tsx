import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
  Heading1, Heading2, Heading3, Quote, Code, Link as LinkIcon, Image as ImageIcon,
  Table as TableIcon, AlignLeft, AlignCenter, AlignRight, Undo, Redo,
} from 'lucide-react';
import { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  additionalExtensions?: import('@tiptap/core').AnyExtension[];
  onEditorReady?: (editor: Editor) => void;
}

export function RichTextEditor({ content, onChange, disabled, additionalExtensions, onEditorReady }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start writing your template...\n\nUse <<placeholder>> for dynamic values.' }),
      ...(additionalExtensions ?? []),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editable: !disabled,
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  if (!editor) return null;

  const btnBase = 'p-1.5 rounded-md transition-colors text-text-tertiary hover:text-text hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed';
  const btnActive = 'bg-indigo-900/40 text-indigo-300';

  function isActive(name: string, attrs?: Record<string, unknown>) {
    return editor.isActive(name, attrs);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-bg-secondary border-b border-border flex-wrap shrink-0">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} disabled={disabled} className={`${btnBase} ${isActive('bold') ? btnActive : ''}`} title="Bold">
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={disabled} className={`${btnBase} ${isActive('italic') ? btnActive : ''}`} title="Italic">
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={disabled} className={`${btnBase} ${isActive('underline') ? btnActive : ''}`} title="Underline">
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={disabled} className={`${btnBase} ${isActive('strike') ? btnActive : ''}`} title="Strikethrough">
          <Strikethrough className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} disabled={disabled} className={`${btnBase} ${isActive('heading', { level: 1 }) ? btnActive : ''}`} title="Heading 1">
          <Heading1 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} disabled={disabled} className={`${btnBase} ${isActive('heading', { level: 2 }) ? btnActive : ''}`} title="Heading 2">
          <Heading2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} disabled={disabled} className={`${btnBase} ${isActive('heading', { level: 3 }) ? btnActive : ''}`} title="Heading 3">
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} disabled={disabled} className={`${btnBase} ${isActive('bulletList') ? btnActive : ''}`} title="Bullet List">
          <List className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} disabled={disabled} className={`${btnBase} ${isActive('orderedList') ? btnActive : ''}`} title="Numbered List">
          <ListOrdered className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} disabled={disabled} className={`${btnBase} ${isActive('blockquote') ? btnActive : ''}`} title="Quote">
          <Quote className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} disabled={disabled} className={`${btnBase} ${isActive('codeBlock') ? btnActive : ''}`} title="Code Block">
          <Code className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        <button type="button" onClick={() => {
          const url = prompt('Enter URL:');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }} disabled={disabled} className={`${btnBase} ${isActive('link') ? btnActive : ''}`} title="Link">
          <LinkIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => {
          const url = prompt('Enter image URL:');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }} disabled={disabled} className={btnBase} title="Image">
          <ImageIcon className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} disabled={disabled} className={btnBase} title="Insert Table">
          <TableIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} disabled={disabled || !isActive('table')} className={btnBase} title="Add Row">
          <span className="text-xs font-medium">+R</span>
        </button>
        <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={disabled || !isActive('table')} className={btnBase} title="Add Column">
          <span className="text-xs font-medium">+C</span>
        </button>
        <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} disabled={disabled || !isActive('table')} className={btnBase} title="Delete Table">
          <span className="text-xs font-medium">×T</span>
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} disabled={disabled} className={`${btnBase} ${isActive('textAlign', { textAlign: 'left' }) ? btnActive : ''}`} title="Align Left">
          <AlignLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} disabled={disabled} className={`${btnBase} ${isActive('textAlign', { textAlign: 'center' }) ? btnActive : ''}`} title="Align Center">
          <AlignCenter className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} disabled={disabled} className={`${btnBase} ${isActive('textAlign', { textAlign: 'right' }) ? btnActive : ''}`} title="Align Right">
          <AlignRight className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={disabled || !editor.can().undo()} className={btnBase} title="Undo">
          <Undo className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={disabled || !editor.can().redo()} className={btnBase} title="Redo">
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <EditorContent
          editor={editor}
          className="h-full p-6 text-text-secondary prose prose-sm max-w-none focus:outline-none leading-relaxed [&_.ProseMirror]:min-h-full [&_.ProseMirror]:focus:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-text-tertiary [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:my-4 [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-2 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-bg-tertiary [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-indigo-500 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_code]:bg-bg-tertiary [&_.ProseMirror_code]:px-1.5 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:font-mono [&_.ProseMirror_pre]:bg-bg-tertiary [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:rounded-lg [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_a]:text-indigo-400 [&_.ProseMirror_a]:underline [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:h-auto [&_.ProseMirror_img]:rounded-lg"
        />
      </div>
    </div>
  );
}

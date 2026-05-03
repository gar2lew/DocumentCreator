import { useRef, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import type { PdfFieldDefinition } from '../../../shared/types';
import { Trash2, Move } from 'lucide-react';

interface Props {
  field: PdfFieldDefinition;
  scale: number;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<PdfFieldDefinition>) => void;
  onRemove: () => void;
}

export function DraggableField({ field, scale, selected, onSelect, onUpdate, onRemove }: Props) {
  const dragStart = useRef<{ mx: number; my: number; fx: number; fy: number } | null>(null);
  const resizeStart = useRef<{ mx: number; my: number; fw: number; fh: number } | null>(null);

  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    dragStart.current = { mx: e.clientX, my: e.clientY, fx: field.x, fy: field.y };

    function onMove(me: MouseEvent) {
      if (!dragStart.current) return;
      const dx = (me.clientX - dragStart.current.mx) / scale;
      const dy = (me.clientY - dragStart.current.my) / scale;
      onUpdate({ x: Math.max(0, dragStart.current.fx + dx), y: Math.max(0, dragStart.current.fy + dy) });
    }
    function onUp() {
      dragStart.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [field.x, field.y, scale, onSelect, onUpdate]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizeStart.current = { mx: e.clientX, my: e.clientY, fw: field.width, fh: field.height };

    function onMove(me: MouseEvent) {
      if (!resizeStart.current) return;
      const dw = (me.clientX - resizeStart.current.mx) / scale;
      const dh = (me.clientY - resizeStart.current.my) / scale;
      onUpdate({
        width: Math.max(40, resizeStart.current.fw + dw),
        height: Math.max(16, resizeStart.current.fh + dh),
      });
    }
    function onUp() {
      resizeStart.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [field.width, field.height, scale, onUpdate]);

  function handleKeyDown(e: KeyboardEvent) {
    const step = e.shiftKey ? 8 : 1;
    switch (e.key) {
      case 'ArrowLeft': onUpdate({ x: Math.max(0, field.x - step) }); e.preventDefault(); break;
      case 'ArrowRight': onUpdate({ x: field.x + step }); e.preventDefault(); break;
      case 'ArrowUp': onUpdate({ y: Math.max(0, field.y - step) }); e.preventDefault(); break;
      case 'ArrowDown': onUpdate({ y: field.y + step }); e.preventDefault(); break;
      case 'Delete':
      case 'Backspace': onRemove(); break;
    }
  }

  return (
    <div
      tabIndex={0}
      onMouseDown={handleDragMouseDown}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        left: field.x * scale,
        top: field.y * scale,
        width: field.width * scale,
        height: field.height * scale,
        cursor: 'move',
        userSelect: 'none',
        outline: 'none',
      }}
      className={`group ${selected ? 'ring-2 ring-indigo-500' : 'ring-1 ring-blue-400/50 hover:ring-blue-400'}`}
    >
      {/* Field label */}
      <div
        className="absolute inset-0 flex items-center px-1 overflow-hidden"
        style={{ fontSize: Math.max(8, field.fontSize * scale * 0.7) }}
      >
        <span className="text-blue-300 truncate opacity-80" style={{ textAlign: field.alignment }}>
          {field.placeholder || field.name}
        </span>
      </div>

      {/* Name badge */}
      {selected && (
        <div className="absolute -top-5 left-0 bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap z-10">
          {field.name}
        </div>
      )}

      {/* Delete button */}
      {selected && (
        <button
          onMouseDown={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-5 -right-5 bg-red-600 hover:bg-red-500 text-white rounded-full p-0.5 z-10"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-0 right-0 w-3 h-3 bg-indigo-500 cursor-se-resize rounded-tl"
        style={{ opacity: selected ? 1 : 0 }}
      />

      {/* Move indicator */}
      <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-50">
        <Move className="w-2.5 h-2.5 text-white" />
      </div>
    </div>
  );
}

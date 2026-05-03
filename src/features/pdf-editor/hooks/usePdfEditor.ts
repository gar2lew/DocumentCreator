import { useState, useCallback, useRef } from 'react';
import type { PdfFieldDefinition } from '../../../shared/types';

const GRID_SIZE = 8;

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function usePdfEditor(
  initialFields: PdfFieldDefinition[],
  onChange: (fields: PdfFieldDefinition[]) => void
) {
  const [fields, setFields] = useState<PdfFieldDefinition[]>(initialFields);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const nextId = useRef(fields.length + 1);

  const update = useCallback((updated: PdfFieldDefinition[]) => {
    setFields(updated);
    onChange(updated);
  }, [onChange]);

  function addField(page: number, x: number, y: number): PdfFieldDefinition {
    const field: PdfFieldDefinition = {
      id: `field_${Date.now()}_${nextId.current++}`,
      name: `Field ${nextId.current}`,
      type: 'text',
      x: snapEnabled ? snapToGrid(x) : x,
      y: snapEnabled ? snapToGrid(y) : y,
      width: 160,
      height: 24,
      page,
      fontSize: 11,
      fontFamily: 'Helvetica',
      alignment: 'left',
      placeholder: '',
    };
    const next = [...fields, field];
    update(next);
    setSelectedId(field.id);
    return field;
  }

  function updateField(id: string, patch: Partial<PdfFieldDefinition>) {
    const patched = patch;
    if (snapEnabled) {
      if (patched.x !== undefined) patched.x = snapToGrid(patched.x);
      if (patched.y !== undefined) patched.y = snapToGrid(patched.y);
    }
    update(fields.map((f) => (f.id === id ? { ...f, ...patched } : f)));
  }

  function removeField(id: string) {
    update(fields.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function moveField(id: string, dx: number, dy: number) {
    const field = fields.find((f) => f.id === id);
    if (!field) return;
    updateField(id, {
      x: Math.max(0, field.x + dx),
      y: Math.max(0, field.y + dy),
    });
  }

  const selectedField = fields.find((f) => f.id === selectedId) ?? null;

  return {
    fields,
    selectedId,
    selectedField,
    showGuides,
    snapEnabled,
    setSelectedId,
    setShowGuides,
    setSnapEnabled,
    addField,
    updateField,
    removeField,
    moveField,
  };
}

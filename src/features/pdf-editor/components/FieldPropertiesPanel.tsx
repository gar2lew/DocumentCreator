import type { PdfFieldDefinition } from '../../../shared/types';

interface Props {
  field: PdfFieldDefinition;
  onUpdate: (patch: Partial<PdfFieldDefinition>) => void;
  onRemove: () => void;
}

export function FieldPropertiesPanel({ field, onUpdate, onRemove }: Props) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Field Properties</p>

      <Row label="Name">
        <input className={cls} value={field.name} onChange={(e) => onUpdate({ name: e.target.value })} />
      </Row>
      <Row label="Placeholder">
        <input className={cls} value={field.placeholder} onChange={(e) => onUpdate({ placeholder: e.target.value })} placeholder="<<key>>" />
      </Row>
      <Row label="Type">
        <select className={cls} value={field.type} onChange={(e) => onUpdate({ type: e.target.value as PdfFieldDefinition['type'] })}>
          <option value="text">Text</option>
          <option value="date">Date</option>
          <option value="number">Number</option>
          <option value="signature">Signature</option>
        </select>
      </Row>

      <div className="grid grid-cols-2 gap-2">
        <Row label="X">
          <input type="number" className={cls} value={Math.round(field.x)} onChange={(e) => onUpdate({ x: parseFloat(e.target.value) || 0 })} />
        </Row>
        <Row label="Y">
          <input type="number" className={cls} value={Math.round(field.y)} onChange={(e) => onUpdate({ y: parseFloat(e.target.value) || 0 })} />
        </Row>
        <Row label="W">
          <input type="number" className={cls} value={Math.round(field.width)} onChange={(e) => onUpdate({ width: parseFloat(e.target.value) || 40 })} />
        </Row>
        <Row label="H">
          <input type="number" className={cls} value={Math.round(field.height)} onChange={(e) => onUpdate({ height: parseFloat(e.target.value) || 16 })} />
        </Row>
      </div>

      <Row label="Font Size">
        <input type="number" className={cls} value={field.fontSize} onChange={(e) => onUpdate({ fontSize: parseFloat(e.target.value) || 11 })} />
      </Row>
      <Row label="Align">
        <select className={cls} value={field.alignment} onChange={(e) => onUpdate({ alignment: e.target.value as PdfFieldDefinition['alignment'] })}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Row>

      <button
        onClick={onRemove}
        className="w-full mt-4 py-1.5 text-xs rounded-lg border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors"
      >
        Remove Field
      </button>
    </div>
  );
}

const cls = 'w-full bg-bg-input border border-border-secondary rounded-md px-2 py-1 text-xs text-text focus:outline-none focus:border-indigo-500';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-text-tertiary mb-0.5">{label}</label>
      {children}
    </div>
  );
}

import type { PdfFieldDefinition } from '../../../shared/types';

interface Preset {
  label: string;
  emoji: string;
  description: string;
  defaults: Partial<PdfFieldDefinition>;
}

const PRESETS: Preset[] = [
  {
    label: 'Client Name',
    emoji: '👤',
    description: 'Full client / entity name',
    defaults: { name: 'Client Name', type: 'text', placeholder: '<<client_name>>', width: 200, height: 24, fontSize: 11, alignment: 'left' },
  },
  {
    label: 'Date',
    emoji: '📅',
    description: 'Document date',
    defaults: { name: 'Date', type: 'date', placeholder: '<<date>>', width: 120, height: 24, fontSize: 11, alignment: 'left' },
  },
  {
    label: 'Currency Amount',
    emoji: '💰',
    description: 'Dollar amount (e.g. $15,000.00)',
    defaults: { name: 'Amount', type: 'number', placeholder: '<<amount_currency>>', width: 120, height: 24, fontSize: 11, alignment: 'right' },
  },
  {
    label: 'Amount in Words',
    emoji: '📝',
    description: 'Amount written out (e.g. Fifteen Thousand Dollars)',
    defaults: { name: 'Amount Words', type: 'text', placeholder: '<<amount_words>>', width: 260, height: 24, fontSize: 11, alignment: 'left' },
  },
  {
    label: 'ACN',
    emoji: '🏢',
    description: 'Australian Company Number',
    defaults: { name: 'ACN', type: 'text', placeholder: '<<acn>>', width: 110, height: 24, fontSize: 11, alignment: 'left' },
  },
  {
    label: 'BSB / Account',
    emoji: '🏦',
    description: 'Bank account details',
    defaults: { name: 'Bank Details', type: 'text', placeholder: '<<bsb>> / <<account_number>>', width: 160, height: 24, fontSize: 11, alignment: 'left' },
  },
  {
    label: 'Signature',
    emoji: '✍️',
    description: 'Signature block',
    defaults: { name: 'Signature', type: 'signature', placeholder: '', width: 180, height: 48, fontSize: 11, alignment: 'left' },
  },
  {
    label: 'Custom Text',
    emoji: '🔤',
    description: 'Free-form text field',
    defaults: { name: 'Custom Field', type: 'text', placeholder: '', width: 200, height: 24, fontSize: 11, alignment: 'left' },
  },
];

interface Props {
  onAdd: (defaults: Partial<PdfFieldDefinition>) => void;
}

export function FieldPresetsPanel({ onAdd }: Props) {
  return (
    <div className="p-4">
      <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Field Presets</p>
      <p className="text-xs text-text-tertiary mb-3">Click a preset to add it to the page, then drag it into position.</p>
      <div className="space-y-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => onAdd(preset.defaults)}
            className="w-full flex items-center gap-3 px-3 py-2.5 bg-bg-tertiary hover:bg-bg-tertiary border border-border-secondary hover:border-indigo-600 rounded-lg text-left transition-colors group"
          >
            <span className="text-base">{preset.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text group-hover:text-indigo-300 transition-colors">{preset.label}</p>
              <p className="text-xs text-text-tertiary truncate">{preset.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

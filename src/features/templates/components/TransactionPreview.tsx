import { useState, useEffect } from "react";
import type { Template } from "../../../shared/types";
import type { Deal } from "../../documentEngine/transaction/types";
import { getTransactionDefinitions, getTransactionDefinition } from "../../documentEngine/transaction/examples";
import { getDeal, getDeals, createDeal } from "../../documentEngine/transaction/registry";
import { validateDealAgainstTransaction, summariseDealValidation } from "../../documentEngine/transaction/validation";
import { useAppStore } from "../../../store";

interface TransactionPreviewProps {
  template: Template;
  onDealIdChange: (dealId: string | undefined) => void;
  onTransactionTypeChange: (t: Template['transactionType']) => void;
}

export function TransactionPreview({ template, onDealIdChange, onTransactionTypeChange }: TransactionPreviewProps) {
  const { currentUser } = useAppStore();
  const definitions = getTransactionDefinitions();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [transactionType, setTransactionType] = useState<Template['transactionType']>(template.transactionType);

  useEffect(() => {
    if (!currentUser) return;
    getDeals(currentUser.organisationId).then(setDeals);
  }, [currentUser]);

  const selectedDeal = template.dealId
    ? deals.find((d) => d.id === template.dealId) ?? null
    : null;

  const transactionDef = transactionType
    ? getTransactionDefinition(transactionType)
    : undefined;

  function handleTransactionTypeChange(val: string) {
    const next = (val || undefined) as Template['transactionType'];
    setTransactionType(next);
    onTransactionTypeChange(next);
    if (next && template.dealId && selectedDeal && selectedDeal.transactionType !== next) {
      onDealIdChange(undefined);
      setSelectedDeal(null);
    }
  }

  async function handleDealSelect(dealId: string) {
    if (!dealId) {
      onDealIdChange(undefined);
      setSelectedDeal(null);
      return;
    }
    onDealIdChange(dealId);
    const deal = deals.find((d) => d.id === dealId) ?? await getDeal(dealId);
    if (deal) {
      setSelectedDeal(deal);
      if (!transactionType) {
        setTransactionType(deal.transactionType);
        onTransactionTypeChange(deal.transactionType);
      }
    }
  }

  async function handleCreateDeal() {
    if (!currentUser || !transactionType) return;
    const ref = await createDeal({
      organisationId: currentUser.organisationId,
      transactionType,
      projectId: '',
      name: `${transactionType} - ${new Date().toLocaleDateString()}`,
      participants: [],
      financials: {},
      dates: {},
      variants: {},
      overrides: [],
      createdBy: currentUser.uid,
    });
    const updated = await getDeals(currentUser.organisationId);
    setDeals(updated);
    handleDealSelect(ref.id);
  }

  const dealValidation = selectedDeal && transactionDef
    ? validateDealAgainstTransaction(selectedDeal, transactionDef)
    : null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Transaction</p>

      <div>
        <label className="text-[10px] text-text-tertiary block mb-1">Transaction Type</label>
        <select
          value={transactionType ?? ''}
          onChange={(e) => handleTransactionTypeChange(e.target.value)}
          className="w-full bg-bg-input border border-border-secondary rounded-lg px-2 py-1.5 text-xs text-text focus:outline-none focus:border-indigo-500"
        >
          <option value="">None (template-driven)</option>
          {definitions.map((def) => (
            <option key={def.type} value={def.type}>{def.label}</option>
          ))}
        </select>
      </div>

      {transactionDef && (
        <div className="border border-border-secondary rounded-lg p-2 space-y-1.5">
          <p className="text-xs text-text font-medium">{transactionDef.label}</p>
          <p className="text-[10px] text-text-tertiary">{transactionDef.description}</p>

          <div className="flex flex-wrap gap-1 pt-1">
            {transactionDef.requiredSections.map((s) => (
              <span key={s.type} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/30 text-indigo-400">
                {s.label}
              </span>
            ))}
            {transactionDef.optionalSections.map((s) => (
              <span key={s.type} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-input text-text-tertiary">
                {s.label} (opt)
              </span>
            ))}
          </div>

          <details className="text-[10px]">
            <summary className="text-text-tertiary cursor-pointer hover:text-text">Required fields ({transactionDef.requiredFields.length})</summary>
            <div className="mt-1 space-y-0.5 pl-2">
              {transactionDef.requiredFields.map((f) => (
                <p key={f.key} className="text-text-tertiary">{f.label} (<span className="font-mono">{f.key}</span>)</p>
              ))}
            </div>
          </details>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-text-tertiary">Associated Deal</label>
          <button
            onClick={handleCreateDeal}
            disabled={!transactionType}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 disabled:text-text-tertiary disabled:cursor-not-allowed"
          >
            + New Deal
          </button>
        </div>
        <select
          value={template.dealId ?? ''}
          onChange={(e) => handleDealSelect(e.target.value)}
          className="w-full bg-bg-input border border-border-secondary rounded-lg px-2 py-1.5 text-xs text-text focus:outline-none focus:border-indigo-500"
        >
          <option value="">No deal associated</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.transactionType})</option>
          ))}
        </select>
      </div>

      {selectedDeal && (
        <div className="border border-border-secondary rounded-lg p-2 space-y-1">
          <p className="text-xs text-text font-medium">{selectedDeal.name}</p>
          {selectedDeal.participants.length > 0 && (
            <p className="text-[10px] text-text-tertiary">{selectedDeal.participants.length} participant(s)</p>
          )}
          {selectedDeal.variants.rateType && (
            <p className="text-[10px] text-text-tertiary">Rate: {selectedDeal.variants.rateType}</p>
          )}
        </div>
      )}

      {dealValidation && dealValidation.warnings.length > 0 && (
        <details className="text-xs" open>
          <summary className="text-amber-400 cursor-pointer font-medium">
            {summariseDealValidation(dealValidation)}
          </summary>
          <div className="mt-1 space-y-1 pl-2">
            {dealValidation.warnings.map((w, i) => (
              <p key={i} className="text-[10px] text-amber-400/80">{w.message}</p>
            ))}
          </div>
        </details>
      )}

      {dealValidation && dealValidation.valid && (
        <p className="text-[10px] text-green-400">All transaction requirements met</p>
      )}
    </div>
  );
}

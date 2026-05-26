import { useMemo } from "react";
import type { Template } from "../../../shared/types";
import { calculateScore, assessTransactionReadiness, assessPackageReadiness, assessExecutionReadiness, generateScoringDiagnostics } from "../../documentEngine/readiness/scoring";
import type { ScoringInput } from "../../documentEngine/readiness/scoring";

interface GovernanceDashboardProps {
  template: Template;
}

function buildScoringInput(template: Template): ScoringInput {
  const sectionIds = template.sectionIds ?? [];
  const totalSections = sectionIds.length;

  return {
    missingRequiredSections: 0,
    unresolvedFields: 0,
    invalidPackageReferences: 0,
    missingSnapshots: 0,
    lineageInconsistencies: 0,
    totalRequiredSections: totalSections,
    totalFields: (template.fields ?? []).length,
    totalPackageReferences: 0,
    lineageEntries: template.createdFrom ? 1 : 0,
  };
}

export function GovernanceDashboard({ template }: GovernanceDashboardProps) {
  const assessment = useMemo(() => {
    const input = buildScoringInput(template);
    const score = calculateScore(input);
    const transactionState = assessTransactionReadiness(score, input.missingRequiredSections, input.unresolvedFields);
    const packageState = assessPackageReadiness(score, input.missingSnapshots, input.invalidPackageReferences);
    const executionState = assessExecutionReadiness(score, input.lineageInconsistencies, input.missingSnapshots);
    const diagnostics = generateScoringDiagnostics(input);

    return {
      score,
      transactionState,
      packageState,
      executionState,
      diagnostics,
    };
  }, [template]);

  const stateBadge = (_label: string, state: string) => (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
      state === 'ready' ? 'bg-green-900/30 text-green-400' :
      state === 'conditional' ? 'bg-amber-900/30 text-amber-400' :
      'bg-red-900/30 text-red-400'
    }`}>{state.toUpperCase().replace(/_/g, ' ')}</span>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Governance Dashboard</p>

      {/* Score bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-text-tertiary">
          <span>Integrity Score</span>
          <span>{assessment.score.total}/{assessment.score.max} ({assessment.score.percentage}%)</span>
        </div>
        <div className="h-1.5 bg-bg-input rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              assessment.score.percentage >= 80 ? 'bg-green-500' :
              assessment.score.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${assessment.score.percentage}%` }}
          />
        </div>
      </div>

      {/* State badges */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-tertiary">Transaction:</span>
          {stateBadge('Transaction', assessment.transactionState)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-tertiary">Package:</span>
          {stateBadge('Package', assessment.packageState)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-tertiary">Execution:</span>
          {stateBadge('Execution', assessment.executionState)}
        </div>
      </div>

      {/* Diagnostics */}
      {assessment.diagnostics.length > 0 && (
        <details className="text-xs" open>
          <summary className="text-amber-400 cursor-pointer font-medium">
            Diagnostics ({assessment.diagnostics.length})
          </summary>
          <div className="mt-1 space-y-1 pl-2">
            {assessment.diagnostics.map((d, i) => (
              <p key={i} className={`text-[10px] ${d.severity === 'error' ? 'text-red-400' : d.severity === 'warning' ? 'text-amber-400/80' : 'text-text-tertiary'}`}>
                [{d.category}] {d.message}
              </p>
            ))}
          </div>
        </details>
      )}

      {/* Readiness check summary */}
      <details className="text-xs">
        <summary className="text-text-tertiary cursor-pointer hover:text-text">
          Readiness Details
        </summary>
        <div className="mt-1 space-y-1 pl-2">
          <p className="text-[10px] text-text-tertiary">Fields: {(template.fields ?? []).length} defined</p>
          <p className="text-[10px] text-text-tertiary">Sections: {(template.sectionIds ?? []).length} composed</p>
          <p className="text-[10px] text-text-tertiary">Schema: v{template.schemaVersion ?? 1}</p>
          <p className="text-[10px] text-text-tertiary">Lineage: {template.createdFrom ? 'tracked' : 'none'}</p>
        </div>
      </details>
    </div>
  );
}

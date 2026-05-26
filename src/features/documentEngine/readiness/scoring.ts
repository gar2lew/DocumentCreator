import type { DiagnosticDetail, ReadinessScore } from './types';

export interface ScoringInput {
  missingRequiredSections: number;
  unresolvedFields: number;
  invalidPackageReferences: number;
  missingSnapshots: number;
  lineageInconsistencies: number;
  totalRequiredSections: number;
  totalFields: number;
  totalPackageReferences: number;
  lineageEntries: number;
}

const WEIGHTS = {
  missingRequiredSection: 30,
  unresolvedField: 10,
  invalidPackageRef: 25,
  missingSnapshot: 20,
  lineageInconsistency: 15,
} as const;

export function calculateScore(input: ScoringInput): ReadinessScore {
  const deductions =
    input.missingRequiredSections * WEIGHTS.missingRequiredSection +
    input.unresolvedFields * WEIGHTS.unresolvedField +
    input.invalidPackageReferences * WEIGHTS.invalidPackageRef +
    input.missingSnapshots * WEIGHTS.missingSnapshot +
    input.lineageInconsistencies * WEIGHTS.lineageInconsistency;

  const baseScore = Math.max(0, 100 - deductions);
  const max = 100;

  return {
    total: baseScore,
    max,
    percentage: Math.round((baseScore / max) * 100),
  };
}

export function assessTransactionReadiness(
  score: ReadinessScore,
  missingRequiredSections: number,
  unresolvedFields: number
): 'ready' | 'conditional' | 'not_ready' {
  if (missingRequiredSections > 0 || unresolvedFields > 3) {
    return 'not_ready';
  }
  if (score.percentage < 80 || unresolvedFields > 0) {
    return 'conditional';
  }
  return 'ready';
}

export function assessPackageReadiness(
  score: ReadinessScore,
  missingSnapshots: number,
  invalidPackageReferences: number
): 'ready' | 'conditional' | 'not_ready' {
  if (invalidPackageReferences > 0) {
    return 'not_ready';
  }
  if (score.percentage < 70 || missingSnapshots > 0) {
    return 'conditional';
  }
  return 'ready';
}

export function assessExecutionReadiness(
  score: ReadinessScore,
  lineageInconsistencies: number,
  missingSnapshots: number
): 'ready' | 'conditional' | 'not_ready' {
  if (lineageInconsistencies > 1) {
    return 'not_ready';
  }
  if (score.percentage < 60 || lineageInconsistencies > 0 || missingSnapshots > 0) {
    return 'conditional';
  }
  return 'ready';
}

export function generateScoringDiagnostics(input: ScoringInput): DiagnosticDetail[] {
  const diagnostics: DiagnosticDetail[] = [];

  if (input.missingRequiredSections > 0) {
    diagnostics.push({
      category: 'transaction',
      message: `${input.missingRequiredSections} required section(s) missing`,
      severity: 'error',
      source: 'readiness/scoring',
    });
  }
  if (input.unresolvedFields > 0) {
    diagnostics.push({
      category: 'fields',
      message: `${input.unresolvedFields} field(s) unresolved`,
      severity: input.unresolvedFields > 3 ? 'error' : 'warning',
      source: 'readiness/scoring',
    });
  }
  if (input.invalidPackageReferences > 0) {
    diagnostics.push({
      category: 'package',
      message: `${input.invalidPackageReferences} package reference(s) invalid`,
      severity: 'error',
      source: 'readiness/scoring',
    });
  }
  if (input.missingSnapshots > 0) {
    diagnostics.push({
      category: 'snapshot',
      message: `${input.missingSnapshots} snapshot(s) missing`,
      severity: 'warning',
      source: 'readiness/scoring',
    });
  }
  if (input.lineageInconsistencies > 0) {
    diagnostics.push({
      category: 'lineage',
      message: `${input.lineageInconsistencies} lineage inconsistency(ies)`,
      severity: 'warning',
      source: 'readiness/scoring',
    });
  }

  return diagnostics;
}

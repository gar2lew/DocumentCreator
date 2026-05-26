import type { DiagnosticDetail, ReadinessState } from './types';

export interface PackageReadinessInput {
  requiredExecutionSets: number;
  presentExecutionSets: number;
  missingOutputs: number;
  unresolvedDependencies: number;
  supersededDocumentCount: number;
  hasManifest: boolean;
  totalDocuments: number;
  totalSnapshots: number;
}

export function assessPackageReadiness(input: PackageReadinessInput): {
  state: ReadinessState;
  diagnostics: DiagnosticDetail[];
} {
  const diagnostics: DiagnosticDetail[] = [];

  if (input.missingOutputs > 0) {
    diagnostics.push({
      category: 'outputs',
      message: `${input.missingOutputs} required output(s) missing`,
      severity: 'error',
      source: 'readiness/package',
    });
  }

  if (input.unresolvedDependencies > 0) {
    diagnostics.push({
      category: 'dependencies',
      message: `${input.unresolvedDependencies} dependency(ies) unresolved`,
      severity: 'error',
      source: 'readiness/package',
    });
  }

  if (!input.hasManifest) {
    diagnostics.push({
      category: 'manifest',
      message: 'No manifest recorded for package',
      severity: 'warning',
      source: 'readiness/package',
    });
  }

  if (input.requiredExecutionSets > input.presentExecutionSets) {
    diagnostics.push({
      category: 'execution_sets',
      message: `${input.requiredExecutionSets - input.presentExecutionSets} execution set(s) missing`,
      severity: 'warning',
      source: 'readiness/package',
    });
  }

  if (input.supersededDocumentCount > 0) {
    diagnostics.push({
      category: 'superseded',
      message: `${input.supersededDocumentCount} superseded document(s) in package`,
      severity: 'warning',
      source: 'readiness/package',
    });
  }

  if (input.totalDocuments > 0 && input.totalSnapshots < input.totalDocuments) {
    diagnostics.push({
      category: 'snapshots',
      message: `Snapshot coverage: ${input.totalSnapshots}/${input.totalDocuments}`,
      severity: 'warning',
      source: 'readiness/package',
    });
  }

  const errors = diagnostics.filter((d) => d.severity === 'error');
  const state: ReadinessState = errors.length > 0 ? 'not_ready' : diagnostics.length > 0 ? 'conditional' : 'ready';

  return { state, diagnostics };
}

import type { ReadinessAssessment, DiagnosticDetail, ReadinessScore } from './types';

export interface ReadinessReport {
  title: string;
  summary: string;
  sections: ReportSection[];
}

export interface ReportSection {
  heading: string;
  body: string;
}

function formatReadinessState(state: string): string {
  return state.toUpperCase().replace(/_/g, ' ');
}

export function generateTransactionSummary(
  transactionId: string,
  score: ReadinessScore,
  unresolvedIssues: DiagnosticDetail[],
  state: string
): ReadinessReport {
  const sections: ReportSection[] = [];

  sections.push({
    heading: 'Transaction Overview',
    body: `Transaction: ${transactionId}\nState: ${formatReadinessState(state)}\nIntegrity Score: ${score.total}/${score.max} (${score.percentage}%)`,
  });

  if (unresolvedIssues.length > 0) {
    sections.push({
      heading: 'Unresolved Issues',
      body: unresolvedIssues.map((i) => `  - [${i.severity.toUpperCase()}] ${i.category}: ${i.message}`).join('\n'),
    });
  }

  sections.push({
    heading: 'Summary',
    body: unresolvedIssues.length === 0
      ? 'All checks passed. Transaction is ready.'
      : `${unresolvedIssues.length} unresolved issue(s) remain.`,
  });

  return {
    title: `Transaction Readiness Report — ${transactionId}`,
    summary: `Score ${score.percentage}% — ${unresolvedIssues.length} issue(s)`,
    sections,
  };
}

export function generateGovernanceSummary(
  assessment: ReadinessAssessment
): ReadinessReport {
  const sections: ReportSection[] = [];

  sections.push({
    heading: 'Governance Overview',
    body: [
      `Transaction: ${assessment.transactionId}`,
      `Transaction Ready: ${formatReadinessState(assessment.transactionReady)}`,
      `Package Ready: ${formatReadinessState(assessment.packageReady)}`,
      `Execution Ready: ${formatReadinessState(assessment.executionReady)}`,
      `Integrity Score: ${assessment.score.total}/${assessment.score.max} (${assessment.score.percentage}%)`,
    ].join('\n'),
  });

  if (assessment.unresolvedIssues.length > 0) {
    sections.push({
      heading: 'Unresolved Issues',
      body: assessment.unresolvedIssues.map((i) => `  - [${i.severity.toUpperCase()}] ${i.message}`).join('\n'),
    });
  }

  if (assessment.warnings.length > 0) {
    sections.push({
      heading: 'Warnings',
      body: assessment.warnings.map((w) => `  - ${w.message}`).join('\n'),
    });
  }

  const allReady = assessment.transactionReady === 'ready' && assessment.packageReady === 'ready' && assessment.executionReady === 'ready';

  sections.push({
    heading: 'Recommendation',
    body: allReady
      ? 'All readiness checks pass. Proceed with execution.'
      : 'Resolve outstanding issues before proceeding.',
  });

  return {
    title: `Governance Readiness Report — ${assessment.transactionId}`,
    summary: `Score ${assessment.score.percentage}% — ${assessment.unresolvedIssues.length + assessment.warnings.length} item(s)`,
    sections,
  };
}

export function generateExecutionReadiness(
  executionType: string,
  documentCount: number,
  snapshotCount: number,
  dependenciesResolved: boolean,
  issues: DiagnosticDetail[]
): ReadinessReport {
  const sections: ReportSection[] = [];

  sections.push({
    heading: 'Execution Overview',
    body: [
      `Execution Type: ${formatReadinessState(executionType)}`,
      `Documents: ${documentCount}`,
      `Snapshots: ${snapshotCount}`,
      `Dependencies Resolved: ${dependenciesResolved ? 'Yes' : 'No'}`,
    ].join('\n'),
  });

  if (issues.length > 0) {
    sections.push({
      heading: 'Issues',
      body: issues.map((i) => `  - [${i.severity.toUpperCase()}] ${i.message}`).join('\n'),
    });
  }

  sections.push({
    heading: 'Readiness',
    body: issues.length === 0 ? 'Ready for execution.' : `${issues.length} issue(s) must be resolved.`,
  });

  return {
    title: `Execution Readiness Report — ${formatReadinessState(executionType)}`,
    summary: `${documentCount} document(s), ${snapshotCount} snapshot(s)`,
    sections,
  };
}

export function generatePackageCompleteness(
  packageId: string,
  documentCount: number,
  snapshotCount: number,
  hasManifest: boolean,
  executionSetCount: number,
  issues: DiagnosticDetail[]
): ReadinessReport {
  const sections: ReportSection[] = [];

  sections.push({
    heading: 'Package Overview',
    body: [
      `Package: ${packageId}`,
      `Documents: ${documentCount}`,
      `Snapshots: ${snapshotCount}`,
      `Has Manifest: ${hasManifest ? 'Yes' : 'No'}`,
      `Execution Sets: ${executionSetCount}`,
    ].join('\n'),
  });

  if (issues.length > 0) {
    sections.push({
      heading: 'Issues',
      body: issues.map((i) => `  - [${i.severity.toUpperCase()}] ${i.message}`).join('\n'),
    });
  }

  sections.push({
    heading: 'Completeness',
    body: issues.length === 0 ? 'Package is complete.' : `${issues.length} issue(s) to resolve.`,
  });

  return {
    title: `Package Completeness Report — ${packageId}`,
    summary: `${documentCount} document(s), ${hasManifest ? 'manifest present' : 'no manifest'}`,
    sections,
  };
}

export function generateAuditReconstructionStatus(
  snapshotRecoveryRate: string,
  manifestAvailable: boolean,
  lineageDepth: number,
  issues: DiagnosticDetail[]
): ReadinessReport {
  const sections: ReportSection[] = [];

  sections.push({
    heading: 'Audit Reconstruction Overview',
    body: [
      `Snapshot Recovery Rate: ${snapshotRecoveryRate}`,
      `Manifest Available: ${manifestAvailable ? 'Yes' : 'No'}`,
      `Lineage Depth: ${lineageDepth}`,
    ].join('\n'),
  });

  if (issues.length > 0) {
    sections.push({
      heading: 'Issues',
      body: issues.map((i) => `  - [${i.severity.toUpperCase()}] ${i.message}`).join('\n'),
    });
  }

  sections.push({
    heading: 'Reconstruction Status',
    body: issues.length === 0 ? 'Full reconstruction possible.' : 'Partial reconstruction only.',
  });

  return {
    title: 'Audit Reconstruction Status Report',
    summary: `${snapshotRecoveryRate} snapshot recovery, ${manifestAvailable ? 'manifest available' : 'manifest unavailable'}`,
    sections,
  };
}

export function formatReport(report: ReadinessReport): string {
  const lines: string[] = [
    `=== ${report.title} ===`,
    `Summary: ${report.summary}`,
    '',
  ];

  for (const section of report.sections) {
    lines.push(`--- ${section.heading} ---`);
    lines.push(section.body);
    lines.push('');
  }

  return lines.join('\n');
}

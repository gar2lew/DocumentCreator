export type ReadinessState = 'ready' | 'conditional' | 'not_ready';

export interface DiagnosticDetail {
  category: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  source: string;
}

export interface ReadinessScore {
  total: number;
  max: number;
  percentage: number;
}

export interface ReadinessAssessment {
  transactionId: string;
  transactionReady: ReadinessState;
  packageReady: ReadinessState;
  executionReady: ReadinessState;
  score: ReadinessScore;
  unresolvedIssues: DiagnosticDetail[];
  warnings: DiagnosticDetail[];
}

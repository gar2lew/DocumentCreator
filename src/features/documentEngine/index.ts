/**
 * DOCUMENT ENGINE
 *
 * Public API surface for the Document Transaction Platform's
 * structured document rendering engine.
 *
 * Subsystem boundaries:
 *   - schema/       — pure data types, deterministic serialization, persistence
 *   - migrations/   — schema version migration system
 *   - validation/   — structural validation and parity tooling
 *   - compat/       — legacy-to-node bridging
 *   - editor/       — TipTap node registration (groundwork)
 *
 * Exports:
 *   All functions are re-exported from their canonical modules.
 *   Consumers should import from this index file, not from
 *   individual implementation files.
 */

// ── Node type definitions ──
export type {
  DocumentNode,
  DocumentRoot,
  TextNode,
  FieldNode,
  ConditionalNode,
  RepeatNode,
} from './schema/nodeTypes';

// ── Serialization ──
export {
  parseToNodes,
  serializeNodes,
  normalizeContent,
  extractFieldKeys,
  transformNodes,
} from './schema/serialization';
export type { NodeTransformer } from './schema/serialization';

// ── Template Document Envelope ──
export {
  packTemplateDocument,
  unpackTemplateDocument,
  extractContent,
  isSchemaCompatible,
  fromLegacyContent,
  CURRENT_SCHEMA_VERSION,
  MINIMUM_SUPPORTED_VERSION,
} from './schema/templateDocument';
export type {
  TemplateDocument,
  TemplateDocumentMetadata,
  MigrationState,
} from './schema/templateDocument';

// ── Render semantics ──
export {
  resolveField,
  evaluateCondition,
  expandRepeat,
  renderNodesToText,
  renderWithStyles,
} from './schema/renderSemantics';
export type { PlaceholderData } from './schema/renderSemantics';

// ── Migration System ──
export {
  registerMigration,
  getMigrations,
  getMigration,
  hasMigration,
  getMigrationsInRange,
  clearRegistry,
} from './migrations/registry';
export type { Migration } from './migrations/registry';

export {
  upgradeDocument,
  needsMigration,
  getDocumentVersion,
} from './migrations/pipeline';
export type { MigrationResult } from './migrations/pipeline';
export { MigrationError } from './migrations/pipeline';

// ── Structural Node Validation ──
export {
  validateNodeTree,
  isTreeValid,
  getSignificantIssues,
} from './validation/nodeValidation';
export type {
  ValidationIssue,
  ValidationResult,
  ValidationOptions,
  ValidationSeverity,
} from './validation/nodeValidation';

// ── Parity Validation ──
export {
  validateContentParity,
} from './validation/parityValidation';
export type {
  ParityResult,
  ParityDifference,
  ParityStats,
} from './validation/parityValidation';

// ── Render Parity Tooling ──
export {
  compareRenderOutput,
} from './validation/renderParity';
export type {
  RenderParityResult,
  RenderParityReport,
} from './validation/renderParity';

// ── Legacy Compatibility Bridge ──
export {
  renderLegacySafe,
  renderWithDiagnostics,
  bridgeToNodes,
  needsLegacyFallback,
  normalizeLegacyContent,
  extractKeysBridged,
  isEquivalentToLegacy,
  tryBridgeHighConfidence,
} from './compat/legacyPlaceholderBridge';
export type { RenderResult } from './compat/legacyPlaceholderBridge';

// ── Configuration ──
export {
  ENABLE_SEMANTIC_NODES,
  getSemanticNodeExtensions,
} from './config';

// ── TipTap Groundwork ──
export {
  FieldNodeExtension,
  ConditionalNodeExtension,
  RepeatNodeExtension,
  DocumentRootExtension,
  documentEngineExtensions,
} from './editor/tiptapNodes';

// ── Content↔Node Synchronization ──
export {
  detectSyncState,
  computeSyncDiagnostics,
  synchronizeContentToNodes,
  synchronizeNodesToContent,
  verifyRoundtrip,
} from './sync/synchronization';
export type {
  SyncState,
  SyncResult,
  SyncDiagnostics,
} from './sync/synchronization';

export {
  detectSemanticDrift,
} from './sync/driftDetection';
export type {
  DriftReport,
  DriftCheck,
  DriftSeverity,
} from './sync/driftDetection';

export {
  regenerateNodesFromContent,
  regenerateContentFromNodes,
  repairSynchronization,
  restoreParityFromContent,
} from './sync/recovery';
export type {
  RecoveryResult,
  RecoveryAction,
  RecoveryDiagnostics,
} from './sync/recovery';

// ── Reusable Sections ──
export type {
  SectionDefinition,
  SectionType,
  SectionLifecycleState,
  SectionMetadata,
} from './section/types';
export {
  getSections,
  getSection,
  createSection,
  updateSection,
  deleteSection,
  getSectionsByType,
  getActiveSections,
  getSectionLineage,
  getExampleSections,
  getExampleSectionByType,
} from './section/index';

// ── Deterministic Composition ──
export type {
  CompositionContext,
  CompositionRule,
  CompositionResult,
  CompositionDiagnostics,
  SectionResolution,
  DependencyWarning,
  RuleOutcome,
} from './composition/types';
export {
  COMPOSITION_RULES,
  getRuleForSectionType,
  evaluateRule,
  composeTemplateSections,
  composeToContent,
  buildDiagnostics,
  hasCompositionWarnings,
  getCriticalWarnings,
} from './composition/index';

// ── Transaction Definitions & Deal Infrastructure ──
export type {
  TransactionType,
  TransactionVariants,
  TransactionFieldRequirement,
  TransactionSectionRequirement,
  TransactionDefinition,
  Deal,
  DealParticipant,
  DealFinancials,
  DealDates,
  DealOverride,
} from './transaction/types';
export {
  getTransactionDefinitions,
  getTransactionDefinition,
  getTransactionDefinitionById,
  getDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  getDealsByTransactionType,
  validateDealAgainstTransaction,
  summariseDealValidation,
} from './transaction/index';
export type { DealValidationResult, TransactionValidationWarning } from './transaction/index';

// ── Governed Semantic Resolution ──
export type {
  FieldDefinition,
  FieldDataType,
  FieldSource,
  FormatterId,
  ResolverProvenance,
  FieldResolution,
  ComputedFieldRegistration,
  ResolverDependencyWarning,
  ResolverValidationResult,
  GovernedResolution,
} from './resolver/index';
export {
  getFieldDefinitions,
  getFieldDefinition,
  getFieldDefinitionsByCategory,
  getComputedFieldDefinitions,
  getFormatter,
  formatField,
  getRegisteredFormatterIds,
  getComputedFieldRegistration,
  isComputedField,
  resolveComputedField,
  resolveFieldWithProvenance,
  resolveFieldsWithProvenance,
  getUnresolvedFields,
  getComputedResolutions,
  buildProvenanceSummary,
  validateFieldDependencies,
  validateFieldKeys,
  resolveGovernedField,
  isFieldGoverned,
  getFieldDataType,
} from './resolver/index';

// ── Governed Document Lifecycle ──
export type {
  DocumentLifecycleState,
  RenderSnapshot,
  LifecycleMetadata,
  DocumentLineage,
  DocumentLineageEntry,
} from './lifecycle/index';
export {
  createSnapshot,
  getSnapshot,
  getSnapshotsForDocument,
  getLatestSnapshot,
  verifySnapshotIntegrity,
  resolveLineage,
  getSupersessionChain,
  diagnoseLifecycle,
  summariseLifecycleDiagnostics,
} from './lifecycle/index';
export type { LifecycleDiagnosticsResult, LifecycleDiagnosticWarning } from './lifecycle/index';

// ── Governed Transaction Package ──
export type {
  TransactionPackage,
  PackageManifest,
  PackageLifecycleState,
  ExecutionSetType,
  ExecutionSet,
  PackageLineageEntry,
  PackageLineage,
} from './package/index';
export {
  createManifest,
  getManifest,
  getManifestsForPackage,
  getLatestManifest,
  verifyManifestIntegrity,
  validatePackageIntegrity,
  summarisePackageValidation,
  getExecutionSet,
  getAllExecutionSets,
  getExecutionSetsForTransactionType,
  rebuildPackageFromManifest,
  recoverSnapshots,
  restoreLineage,
  verifyReconstruction,
} from './package/index';
export type { PackageValidationWarning, PackageValidationResult, ReconstructionResult } from './package/index';

// ── Governed Operational Readiness ──
export type {
  ReadinessState,
  DiagnosticDetail,
  ReadinessScore,
  ReadinessAssessment,
} from './readiness/index';
export {
  calculateScore,
  assessTransactionReadiness,
  assessPackageReadinessFromScoring,
  assessExecutionReadiness,
  generateScoringDiagnostics,
  assessPackageReadiness,
  generateTransactionSummary,
  generateGovernanceSummary,
  generateExecutionReadiness,
  generatePackageCompleteness,
  generateAuditReconstructionStatus,
  formatReport,
} from './readiness/index';
export type { ScoringInput, PackageReadinessInput, ReadinessReport, ReportSection } from './readiness/index';

// ── Governed Externalization & Issuance ──
export type {
  IssuanceState,
  IssuanceRecord,
  IssuanceManifest,
  Recipient,
  RecipientRole,
  IssuanceLineageEntry,
  RecipientResolutionStrategy,
} from './issuance/index';
export {
  createIssuanceManifest,
  getIssuanceManifest,
  getManifestsForIssuance,
  getLatestIssuanceManifest,
  verifyIssuanceManifestIntegrity,
  resolveRecipientByRole,
  resolveRecipientById,
  resolveRecipientsByPackage,
  buildRecipientMappings,
  getIssuanceLineageForRecipient,
  validateExternalization,
  summariseIssuanceValidation,
  rebuildIssuanceFromManifest,
  recoverIssuanceSnapshots,
  recoverRecipientLineage,
  verifyIssuanceReconstruction,
} from './issuance/index';
export type { IssuanceValidationWarning, IssuanceValidationResult, IssuanceReconstructionResult } from './issuance/index';

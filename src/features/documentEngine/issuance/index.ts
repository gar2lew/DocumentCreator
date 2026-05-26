export type {
  IssuanceState,
  IssuanceRecord,
  IssuanceManifest,
  Recipient,
  RecipientRole,
  IssuanceLineageEntry,
  RecipientResolutionStrategy,
} from './types';

export {
  createIssuanceManifest,
  getIssuanceManifest,
  getManifestsForIssuance,
  getLatestIssuanceManifest,
  verifyIssuanceManifestIntegrity,
} from './manifest';

export {
  resolveRecipientByRole,
  resolveRecipientById,
  resolveRecipientsByPackage,
  buildRecipientMappings,
  getIssuanceLineageForRecipient,
} from './recipients';

export {
  validateExternalization,
  summariseIssuanceValidation,
} from './validation';
export type { IssuanceValidationWarning, IssuanceValidationResult } from './validation';

export {
  rebuildIssuanceFromManifest,
  recoverIssuanceSnapshots,
  recoverRecipientLineage,
  verifyIssuanceReconstruction,
} from './reconstruction';
export type { IssuanceReconstructionResult } from './reconstruction';

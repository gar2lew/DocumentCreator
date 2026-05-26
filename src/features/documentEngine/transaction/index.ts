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
  RateVariant,
  RepaymentVariant,
  SecurityVariant,
} from './types';

export {
  getTransactionDefinitions,
  getTransactionDefinition,
  getTransactionDefinitionById,
} from './examples';

export {
  getDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  getDealsByTransactionType,
} from './registry';

export {
  validateDealAgainstTransaction,
  summariseDealValidation,
} from './validation';
export type { DealValidationResult, TransactionValidationWarning } from './validation';

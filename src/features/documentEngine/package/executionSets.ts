import type { ExecutionSet, ExecutionSetType } from './types';

const EXECUTION_SETS: Record<ExecutionSetType, ExecutionSet> = {
  signing_pack: {
    type: 'signing_pack',
    label: 'Signing Pack',
    description: 'Documents required for execution by all parties',
    requiredDocumentTypes: ['execution_page', 'signature_block'],
    optionalDocumentTypes: ['witness_statement', 'certificate_of_execution'],
  },
  settlement_pack: {
    type: 'settlement_pack',
    label: 'Settlement Pack',
    description: 'Documents required for financial settlement and disbursement',
    requiredDocumentTypes: ['settlement_statement', 'payment_direction'],
    optionalDocumentTypes: ['trust_deed', 'certificate_of_title'],
  },
  guarantor_execution: {
    type: 'guarantor_execution',
    label: 'Guarantor Execution Set',
    description: 'Guarantee documents requiring separate execution by guarantors',
    requiredDocumentTypes: ['guarantee_deed', 'guarantor_execution_page'],
    optionalDocumentTypes: ['guarantor_acknowledgement', 'independent_legal_advice'],
  },
  disclosure_bundle: {
    type: 'disclosure_bundle',
    label: 'Disclosure Bundle',
    description: 'Disclosure and information documents for regulatory or counterparty distribution',
    requiredDocumentTypes: ['key_facts_sheet', 'disclosure_statement'],
    optionalDocumentTypes: ['product_disclosure', 'privacy_notice', 'fee_schedule'],
  },
};

export function getExecutionSet(type: ExecutionSetType): ExecutionSet {
  return EXECUTION_SETS[type];
}

export function getAllExecutionSets(): ExecutionSet[] {
  return Object.values(EXECUTION_SETS);
}

export function getExecutionSetsForTransactionType(
  transactionType: string
): { required: ExecutionSet[]; optional: ExecutionSet[] } {
  const required: ExecutionSet[] = [];
  const optional: ExecutionSet[] = [];

  for (const set of Object.values(EXECUTION_SETS)) {
    if (set.type === 'signing_pack' || set.type === 'disclosure_bundle') {
      required.push(set);
    } else if (set.type === 'settlement_pack') {
      if (transactionType === 'settlement_deed' || transactionType === 'secured_loan') {
        required.push(set);
      } else {
        optional.push(set);
      }
    } else if (set.type === 'guarantor_execution') {
      if (transactionType === 'guarantor_loan') {
        required.push(set);
      } else {
        optional.push(set);
      }
    }
  }

  return { required, optional };
}

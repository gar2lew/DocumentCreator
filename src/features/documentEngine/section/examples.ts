import type { SectionDefinition } from './types';

const EXAMPLE_SECTIONS: Omit<SectionDefinition, 'id' | 'organisationId' | 'createdBy' | 'createdAt' | 'updatedAt'>[] = [
  {
    type: 'guarantor',
    schemaVersion: 1,
    nodes: JSON.stringify({
      type: 'document',
      children: [
        { type: 'text', text: '\n\nGUARANTEE\n\n' },
        { type: 'text', text: 'In consideration of the Lender agreeing to make the Loan, the Guarantor irrevocably and unconditionally guarantees to the Lender the due and punctual payment by the Borrower of all money payable under the Loan Agreement.\n\n' },
        { type: 'field', fieldKey: 'guarantor_name' },
        { type: 'text', text: ' (' },
        { type: 'field', fieldKey: 'guarantor_acn' },
        { type: 'text', text: ') of ' },
        { type: 'field', fieldKey: 'guarantor_address' },
        { type: 'text', text: ' guarantees the obligations of ' },
        { type: 'field', fieldKey: 'borrower_name' },
        { type: 'text', text: '.\n\n' },
        { type: 'text', text: 'This guarantee is a continuing obligation and survives the death or incapacity of the Guarantor.\n\n' },
      ],
    }),
    metadata: {
      label: 'Guarantor Clause',
      description: 'Standard personal/corporate guarantee clause for secured loans',
      category: 'Security',
      templateKinds: ['loan_agreement', 'deed'],
      lifecycleState: 'active',
      tags: ['guarantee', 'security', 'borrower'],
      compatibleSchemaVersions: [1],
    },
  },
  {
    type: 'repayment',
    schemaVersion: 1,
    nodes: JSON.stringify({
      type: 'document',
      children: [
        { type: 'text', text: '\n\nREPAYMENT\n\n' },
        { type: 'text', text: 'The Borrower must repay the Loan in full together with accrued interest on the Maturity Date.\n\n' },
        { type: 'text', text: 'Repayment Amount: ' },
        { type: 'field', fieldKey: 'repayment_amount' },
        { type: 'text', text: '\n' },
        { type: 'text', text: 'Repayment Frequency: ' },
        { type: 'field', fieldKey: 'repayment_frequency' },
        { type: 'text', text: '\n' },
        { type: 'text', text: 'Maturity Date: ' },
        { type: 'field', fieldKey: 'maturity_date' },
        { type: 'text', text: '\n\n' },
        {
          type: 'conditional',
          condition: 'default_interest_rate',
          children: [
            { type: 'text', text: 'Default Interest: ' },
            { type: 'field', fieldKey: 'default_interest_rate' },
            { type: 'text', text: '% per annum applies to overdue amounts.\n\n' },
          ],
        },
      ],
    }),
    metadata: {
      label: 'Repayment Schedule',
      description: 'Standard repayment terms including amount, frequency, maturity date, and default interest',
      category: 'Financial',
      templateKinds: ['loan_agreement'],
      lifecycleState: 'active',
      tags: ['repayment', 'interest', 'maturity'],
      compatibleSchemaVersions: [1],
    },
  },
  {
    type: 'settlement',
    schemaVersion: 1,
    nodes: JSON.stringify({
      type: 'document',
      children: [
        { type: 'text', text: '\n\nSETTLEMENT\n\n' },
        { type: 'text', text: 'Settlement of this transaction will take place on ' },
        { type: 'field', fieldKey: 'settlement_date' },
        { type: 'text', text: '.\n\n' },
        { type: 'text', text: 'At settlement, the Lender will pay the Consideration Amount to the Borrower and the Borrower will execute all documents necessary to perfect the security.\n\n' },
        {
          type: 'conditional',
          condition: 'consideration_amount',
          children: [
            { type: 'text', text: 'Consideration: ' },
            { type: 'field', fieldKey: 'consideration_amount' },
            { type: 'text', text: ' (' },
            { type: 'field', fieldKey: 'consideration_amount_words' },
            { type: 'text', text: ')\n\n' },
          ],
        },
      ],
    }),
    metadata: {
      label: 'Settlement Schedule',
      description: 'Standard settlement timeline and payment terms',
      category: 'Timeline',
      templateKinds: ['deed'],
      lifecycleState: 'active',
      tags: ['settlement', 'timeline', 'payment'],
      compatibleSchemaVersions: [1],
    },
  },
  {
    type: 'execution',
    schemaVersion: 1,
    nodes: JSON.stringify({
      type: 'document',
      children: [
        { type: 'text', text: '\n\nEXECUTION\n\n' },
        { type: 'text', text: 'EXECUTED as a deed.\n\n' },
        { type: 'text', text: 'SIGNED by ' },
        { type: 'field', fieldKey: 'borrower_name' },
        { type: 'text', text: '\n' },
        { type: 'text', text: 'in the presence of:\n\n' },
        { type: 'text', text: 'Signature: _______________________\n' },
        { type: 'text', text: 'Name: ___________________________\n' },
        { type: 'text', text: 'Date: ___________________________\n\n' },
        { type: 'text', text: 'SIGNED by ' },
        { type: 'field', fieldKey: 'lender_name' },
        { type: 'text', text: '\n' },
        { type: 'text', text: 'in the presence of:\n\n' },
        { type: 'text', text: 'Signature: _______________________\n' },
        { type: 'text', text: 'Name: ___________________________\n' },
        { type: 'text', text: 'Date: ___________________________\n' },
      ],
    }),
    metadata: {
      label: 'Execution Block',
      description: 'Standard deed execution block with signature lines',
      category: 'Execution',
      templateKinds: ['deed', 'loan_agreement'],
      lifecycleState: 'active',
      tags: ['execution', 'signature', 'deed'],
      compatibleSchemaVersions: [1],
    },
  },
  {
    type: 'jurisdiction',
    schemaVersion: 1,
    nodes: JSON.stringify({
      type: 'document',
      children: [
        { type: 'text', text: '\n\nGOVERNING LAW AND JURISDICTION\n\n' },
        { type: 'text', text: 'This Deed is governed by the laws of ' },
        { type: 'field', fieldKey: 'jurisdiction' },
        { type: 'text', text: '.\n\n' },
        { type: 'text', text: 'Each party submits to the exclusive jurisdiction of the courts of ' },
        { type: 'field', fieldKey: 'jurisdiction' },
        { type: 'text', text: '.\n\n' },
      ],
    }),
    metadata: {
      label: 'Jurisdiction Clause',
      description: 'Standard governing law and jurisdiction clause',
      category: 'Legal',
      templateKinds: ['deed', 'loan_agreement'],
      lifecycleState: 'active',
      tags: ['jurisdiction', 'governing-law', 'legal'],
      compatibleSchemaVersions: [1],
    },
  },
];

export function getExampleSections() {
  return EXAMPLE_SECTIONS;
}

export function getExampleSectionByType(type: string) {
  return EXAMPLE_SECTIONS.find((s) => s.type === type) ?? null;
}

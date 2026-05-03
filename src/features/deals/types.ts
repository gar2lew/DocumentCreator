import type { Project } from '../../shared/types';

export type DealType = 'deed_settlement' | 'loan_agreement';

export interface DealParty {
  name: string;
  acn?: string;
  address?: string;
}

export interface DealFinancials {
  principal: number;
  interest: number;
  total: number;
}

export interface DealDates {
  agreementDate: string;
  settlementDate?: string;
  repaymentDate?: string;
}

export interface DealProjectSnapshot {
  id: string;
  name: string;
  acn: string;
  bankDetails: Project['bankDetails'];
}

export interface Deal {
  id: string;
  organisationId: string;
  type: DealType;
  clientName: string;
  projectId: string;
  projectSnapshot: DealProjectSnapshot;
  lender: DealParty;
  borrower: DealParty;
  guarantor: DealParty;
  financials: DealFinancials;
  bankDetails: Project['bankDetails'];
  dates: DealDates;
  overrides: Record<string, string>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDealInput {
  type: DealType;
  clientName: string;
  lender: DealParty;
  borrower?: Partial<DealParty>;
  guarantor?: Partial<DealParty>;
  financials: Omit<DealFinancials, 'total'> & { total?: number };
  dates: DealDates;
  overrides?: Record<string, string>;
}

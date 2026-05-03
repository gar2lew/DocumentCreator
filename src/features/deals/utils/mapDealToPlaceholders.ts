import type { Project } from '../../../shared/types';
import { formatCurrency } from '../../../shared/utils/currency';
import { numberToWords } from '../../../shared/utils/numberToWords';
import type { Deal } from '../types';

function formatAcn(acn: string): string {
  const digits = acn.replace(/\D/g, '');
  if (digits.length !== 9) return acn;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function formatDate(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function amountValue(value: number): string {
  return Number.isFinite(value) ? String(value) : '';
}

export function mapDealToPlaceholders(deal: Deal, project?: Project | null): Record<string, string> {
  const projectName = project?.name ?? deal.projectSnapshot.name;
  const projectAcn = project?.acn ?? deal.projectSnapshot.acn;
  const bankDetails = project?.bankDetails ?? deal.bankDetails;
  const principal = deal.financials.principal;
  const interest = deal.financials.interest;
  const total = deal.financials.total;

  return {
    principal_amount: amountValue(principal),
    interest_amount: amountValue(interest),
    total_amount: amountValue(total),
    principal_currency: formatCurrency(principal),
    interest_currency: formatCurrency(interest),
    total_currency: formatCurrency(total),
    principal_words: numberToWords(principal),
    interest_words: numberToWords(interest),
    total_words: numberToWords(total),
    amount_words: numberToWords(total),
    amount_currency: formatCurrency(total),

    project_name: projectName,
    project_acn: formatAcn(projectAcn),
    bank_name: bankDetails.bankName,
    account_name: bankDetails.accountName,
    bsb: bankDetails.bsb,
    account_number: bankDetails.accountNumber,

    client_name: deal.clientName,
    lender_name: deal.lender.name,

    settlement_date: formatDate(deal.dates.settlementDate),
    agreement_date: formatDate(deal.dates.agreementDate),
  };
}

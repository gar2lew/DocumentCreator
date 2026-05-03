import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  db,
} from '../../../shared/firebase/collections';
import type { Project, User } from '../../../shared/types';
import type { CreateDealInput, Deal } from '../types';

const DEALS_COLLECTION = 'deals';

function mapDeal(id: string, data: Record<string, unknown>): Deal {
  const borrower = data.borrower as Deal['borrower'] | undefined;

  return {
    id,
    organisationId: data.organisationId as string,
    type: data.type as Deal['type'],
    clientName: (data.clientName as string) ?? borrower?.name ?? '',
    projectId: data.projectId as string,
    projectSnapshot: data.projectSnapshot as Deal['projectSnapshot'],
    lender: data.lender as Deal['lender'],
    borrower: data.borrower as Deal['borrower'],
    guarantor: data.guarantor as Deal['guarantor'],
    financials: data.financials as Deal['financials'],
    bankDetails: data.bankDetails as Deal['bankDetails'],
    dates: data.dates as Deal['dates'],
    overrides: (data.overrides as Record<string, string>) ?? {},
    createdBy: data.createdBy as string,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

export async function getDeals(organisationId: string, projectId?: string): Promise<Deal[]> {
  if (!organisationId) return [];

  const q = query(collection(db, DEALS_COLLECTION), where('organisationId', '==', organisationId));
  const snap = await getDocs(q);
  return snap.docs
    .map((docSnap) => mapDeal(docSnap.id, docSnap.data()))
    .filter((deal) => !projectId || deal.projectId === projectId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createDeal(
  currentUser: User,
  project: Project,
  input: CreateDealInput
): Promise<Deal> {
  if (!currentUser.organisationId) {
    throw new Error('Cannot create deal without an organisation.');
  }

  const projectSnapshot = {
    id: project.id,
    name: project.name,
    acn: project.acn,
    bankDetails: project.bankDetails,
  };
  const clientName = input.clientName.trim();
  const principal = Number(input.financials.principal);
  const interest = Number(input.financials.interest);

  if (!clientName) {
    throw new Error('Client name is required');
  }

  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error('Principal must be greater than 0');
  }

  if (!Number.isFinite(interest) || interest < 0) {
    throw new Error('Interest must be a valid number');
  }

  if (!input.dates.settlementDate) {
    throw new Error('Settlement date is required');
  }

  const total = input.financials.total ?? principal + interest;

  const data = {
    organisationId: currentUser.organisationId,
    type: input.type,
    clientName,
    projectId: project.id,
    projectSnapshot,
    lender: {
      name: clientName,
    },
    borrower: {
      name: input.borrower?.name ?? project.name,
      acn: input.borrower?.acn ?? project.acn,
      address: input.borrower?.address ?? '',
    },
    guarantor: {
      name: input.guarantor?.name ?? '',
      acn: input.guarantor?.acn ?? '',
      address: input.guarantor?.address ?? '',
    },
    financials: {
      principal,
      interest,
      total,
    },
    bankDetails: project.bankDetails,
    dates: input.dates,
    overrides: input.overrides ?? {},
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, DEALS_COLLECTION), data);
  return {
    ...data,
    id: ref.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

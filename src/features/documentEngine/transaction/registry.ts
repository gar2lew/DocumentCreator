import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  db,
} from '../../../shared/firebase/collections';
import { COLLECTIONS } from '../../../shared/firebase/collections';
import type { Deal, TransactionType, TransactionVariants, DealParticipant, DealFinancials, DealDates, DealOverride } from './types';

function mapDeal(id: string, data: Record<string, unknown>): Deal {
  return {
    id,
    organisationId: data.organisationId as string,
    transactionType: data.transactionType as TransactionType,
    projectId: (data.projectId as string) ?? '',
    name: (data.name as string) ?? '',
    participants: (data.participants as DealParticipant[]) ?? [],
    financials: (data.financials as DealFinancials) ?? {},
    dates: (data.dates as DealDates) ?? {},
    variants: (data.variants as TransactionVariants) ?? {},
    overrides: (data.overrides as DealOverride[]) ?? [],
    createdBy: data.createdBy as string,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

export async function getDeals(organisationId: string): Promise<Deal[]> {
  const q = query(
    collection(db, COLLECTIONS.DEALS),
    where('organisationId', '==', organisationId),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDeal(d.id, d.data()));
}

export async function getDeal(id: string): Promise<Deal | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.DEALS, id));
  if (!snap.exists()) return null;
  return mapDeal(snap.id, snap.data());
}

export async function createDeal(
  data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Deal> {
  const ref = await addDoc(collection(db, COLLECTIONS.DEALS), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return {
    ...data,
    id: ref.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function updateDeal(
  id: string,
  data: Partial<Pick<Deal, 'financials' | 'dates' | 'variants' | 'participants' | 'overrides' | 'name'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.DEALS, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDeal(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.DEALS, id));
}

export function getDealsByTransactionType(deals: Deal[], transactionType: TransactionType): Deal[] {
  return deals.filter((d) => d.transactionType === transactionType);
}

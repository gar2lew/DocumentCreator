import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { useAppStore } from '../../../store';
import {
  collection,
  db,
  query,
  orderBy,
  where,
  COLLECTIONS,
} from '../../../shared/firebase/collections';
import type { PersistedDocumentPack } from '../services/documentPackPersistenceService';

function mapDocumentPack(id: string, data: Record<string, unknown>): PersistedDocumentPack {
  return {
    id,
    dealId: data.dealId as string,
    organisationId: data.organisationId as string,
    files: (data.files as PersistedDocumentPack['files']) ?? [],
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    createdBy: data.createdBy as string,
  };
}

export function useDocumentPacks(dealId: string) {
  const organisationId = useAppStore((state) => state.currentUser?.organisationId ?? '');
  const [packs, setPacks] = useState<PersistedDocumentPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!dealId || !organisationId) {
      setPacks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, COLLECTIONS.DOCUMENTS_GENERATED),
      where('organisationId', '==', organisationId),
      where('dealId', '==', dealId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,
      (snap) => {
        setPacks(snap.docs.map((doc) => mapDocumentPack(doc.id, doc.data())));
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError);
        setLoading(false);
      }
    );
  }, [dealId, organisationId]);

  return { packs, loading, error };
}

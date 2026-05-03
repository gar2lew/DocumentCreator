import { useCallback, useEffect, useState } from 'react';
import type { Project } from '../../../shared/types';
import { useAppStore } from '../../../store';
import type { CreateDealInput, Deal } from '../types';
import { createDeal, getDeals } from '../services/dealService';

export function useDeals(projectId?: string) {
  const { currentUser } = useAppStore();
  const organisationId = currentUser?.organisationId ?? '';
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!organisationId) {
      setDeals([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    getDeals(organisationId, projectId)
      .then((items) => {
        if (active) setDeals(items);
      })
      .catch((err) => {
        console.error('Deal query error:', err);
        if (active) setError(err instanceof Error ? err.message : 'Could not load deals');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [organisationId, projectId]);

  const create = useCallback(async (project: Project, input: CreateDealInput) => {
    if (!currentUser) throw new Error('Not authenticated');
    const deal = await createDeal(currentUser, project, input);
    setDeals((current) => [deal, ...current]);
    return deal;
  }, [currentUser]);

  return { deals, loading, error, create };
}

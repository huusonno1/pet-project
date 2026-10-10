import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, apiFetch } from '@/lib/api/client';
import type { Couple, Distance, Invite } from '@/lib/api/types';
import { keys } from '@/lib/query';

export function useCouple(refetchInterval?: number) {
  return useQuery({
    queryKey: keys.couple,
    queryFn: async (): Promise<Couple | null> => {
      try {
        return await apiFetch<Couple>('/api/couples/me');
      } catch (e) {
        if (e instanceof ApiError && e.code === 'COUPLE_REQUIRED') return null;
        throw e;
      }
    },
    refetchInterval,
  });
}

export function useCreateInvite() {
  return useMutation({ mutationFn: () => apiFetch<Invite>('/api/couples/invites', { method: 'POST' }) });
}

export function useJoinCouple() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { code: string; startedDatingOn?: string }) =>
      apiFetch<Couple>('/api/couples/join', { method: 'POST', body }),
    onSuccess: (couple) => {
      qc.setQueryData(keys.couple, couple);
      qc.invalidateQueries({ queryKey: keys.moments });
    },
  });
}

export function useEndCouple() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/api/couples/me/end', { method: 'POST' }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: keys.moments });
      qc.removeQueries({ queryKey: keys.distance });
      qc.removeQueries({ queryKey: ['traits'] });
      qc.setQueryData(keys.couple, null);
    },
  });
}

export function useDistance() {
  return useQuery({ queryKey: keys.distance, queryFn: () => apiFetch<Distance>('/api/couples/distance') });
}

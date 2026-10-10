import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { Me, Settings } from '@/lib/api/types';
import { keys } from '@/lib/query';

export type UpdateMeInput = { displayName?: string; birthday?: string; timezone?: string; avatarMediaId?: string };

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => apiFetch<Me>('/api/me') });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMeInput) => apiFetch<Me>('/api/me', { method: 'PATCH', body }),
    onSuccess: (me) => qc.setQueryData(keys.me, me),
  });
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: () => apiFetch<Settings>('/api/me/settings') });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Settings>) => apiFetch<Settings>('/api/me/settings', { method: 'PUT', body }),
    onSuccess: (settings) => {
      qc.setQueryData(keys.settings, settings);
      qc.invalidateQueries({ queryKey: keys.distance });
      qc.invalidateQueries({ queryKey: keys.moments });
      qc.invalidateQueries({ queryKey: ['cycle'] });
    },
  });
}

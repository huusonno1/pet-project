import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { Gender, Me, Settings } from '@/lib/api/types';
import { keys } from '@/lib/query';

export type UpdateMeInput = { displayName?: string; birthday?: string; timezone?: string; avatarMediaId?: string; gender?: Gender };

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => apiFetch<Me>('/api/me') });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMeInput) => apiFetch<Me>('/api/me', { method: 'PATCH', body }),
    onSuccess: (me, body) => {
      qc.setQueryData(keys.me, me);
      if (body.gender) {
        // Đổi sang Nam → backend tự tắt theo dõi chu kỳ.
        qc.invalidateQueries({ queryKey: keys.settings });
        qc.invalidateQueries({ queryKey: ['cycle'] });
        qc.invalidateQueries({ queryKey: keys.moments });
      }
    },
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

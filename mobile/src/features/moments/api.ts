import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { Moment, MomentInput, ReminderConfig, ReminderItem } from '@/lib/api/types';
import { keys } from '@/lib/query';

export function useMoments() {
  return useQuery({ queryKey: keys.moments, queryFn: () => apiFetch<Moment[]>('/api/moments') });
}

export function useMoment(id: string) {
  return useQuery({ queryKey: keys.moment(id), queryFn: () => apiFetch<Moment>(`/api/moments/${id}`), enabled: !!id });
}

export function useMomentReminders(id: string) {
  return useQuery({
    queryKey: keys.reminders(id),
    queryFn: () => apiFetch<ReminderItem[]>(`/api/moments/${id}/reminders`),
    enabled: !!id,
  });
}

export function useCreateMoment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MomentInput) => apiFetch<Moment>('/api/moments', { method: 'POST', body: input }),
    onSuccess: (m) => {
      qc.setQueryData(keys.moment(m.id), m);
      qc.invalidateQueries({ queryKey: keys.moments, exact: true });
    },
  });
}

export function useUpdateMoment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MomentInput) => apiFetch<Moment>(`/api/moments/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (m) => {
      qc.setQueryData(keys.moment(id), m);
      qc.invalidateQueries({ queryKey: keys.moments, exact: true });
      qc.invalidateQueries({ queryKey: keys.reminders(id) });
    },
  });
}

export function useDeleteMoment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/moments/${id}`, { method: 'DELETE' }),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: keys.moment(id) });
      qc.invalidateQueries({ queryKey: keys.moments, exact: true });
    },
  });
}

/** `null` = khôi phục cấu hình nhắc mặc định. */
export function useSetReminderConfig(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: ReminderConfig | null) =>
      apiFetch<Moment>(`/api/moments/${id}/reminder-config`, { method: 'PUT', body: config }),
    onSuccess: (m) => {
      qc.setQueryData(keys.moment(id), m);
      qc.invalidateQueries({ queryKey: keys.reminders(id) });
    },
  });
}

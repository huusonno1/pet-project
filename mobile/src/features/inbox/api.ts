import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { InboxItem } from '@/lib/api/types';
import { keys } from '@/lib/query';

export function useInbox() {
  return useQuery({ queryKey: keys.inbox, queryFn: () => apiFetch<InboxItem[]>('/api/notifications?limit=50') });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: keys.unread,
    queryFn: async () => (await apiFetch<{ count: number }>('/api/notifications/unread-count')).count,
    refetchInterval: 60_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.inbox }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/api/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.inbox }),
  });
}

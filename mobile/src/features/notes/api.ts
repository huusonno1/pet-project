import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { LoveNote } from '@/lib/api/types';
import { keys } from '@/lib/query';

export function useLoveNotes() {
  return useQuery({ queryKey: keys.notes, queryFn: () => apiFetch<LoveNote[]>('/api/love-notes?limit=50') });
}

/** Lời nhắn mới nhất người ấy gửi; backend trả 204 khi chưa có. */
export function useLatestNote(enabled = true) {
  return useQuery({
    queryKey: keys.latestNote,
    queryFn: async () => (await apiFetch<LoveNote | undefined>('/api/love-notes/latest')) ?? null,
    enabled,
  });
}

export type SendNote = { kind: 'TEXT'; text: string } | { kind: 'DRAWING'; drawingMediaId: string; text?: string };

export function useSendNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SendNote) => apiFetch<LoveNote>('/api/love-notes', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notes }),
  });
}

export function useMarkNoteSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/love-notes/${id}/seen`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notes }),
  });
}

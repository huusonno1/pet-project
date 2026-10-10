import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { Catalog, Traits } from '@/lib/api/types';
import { keys } from '@/lib/query';

export function useCatalog() {
  return useQuery({ queryKey: keys.catalog, queryFn: () => apiFetch<Catalog>('/api/traits/catalog'), staleTime: Infinity });
}

export function useTraits(userId: string | undefined) {
  return useQuery({
    queryKey: keys.traits(userId ?? ''),
    queryFn: () => apiFetch<Traits>(`/api/traits/${userId}`),
    enabled: !!userId,
  });
}

function useSave(path: 'sizes' | 'preferences', subjectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Record<string, unknown> }) =>
      id
        ? apiFetch(`/api/traits/${path}/${id}`, { method: 'PATCH', body })
        : apiFetch(`/api/traits/${path}`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.traits(subjectId) }),
  });
}

function useDelete(path: 'sizes' | 'preferences', subjectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/traits/${path}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.traits(subjectId) }),
  });
}

export const useSaveSize = (subjectId: string) => useSave('sizes', subjectId);
export const useDeleteSize = (subjectId: string) => useDelete('sizes', subjectId);
export const useSavePreference = (subjectId: string) => useSave('preferences', subjectId);
export const useDeletePreference = (subjectId: string) => useDelete('preferences', subjectId);

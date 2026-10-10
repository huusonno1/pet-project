import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, apiFetch } from '@/lib/api/client';
import type { CycleLog, Prediction } from '@/lib/api/types';
import { keys } from '@/lib/query';

export function useCycleLogs() {
  return useQuery({ queryKey: keys.cycleLogs, queryFn: () => apiFetch<CycleLog[]>('/api/cycles/logs') });
}

/** Không truyền userId = dự đoán của mình. 404 (chưa có dữ liệu / không chia sẻ) → null. */
export function usePrediction(userId?: string, enabled = true) {
  return useQuery({
    queryKey: keys.prediction(userId ?? 'me'),
    queryFn: async (): Promise<Prediction | null> => {
      try {
        return await apiFetch<Prediction>(`/api/cycles/prediction${userId ? `?userId=${userId}` : ''}`);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    enabled,
  });
}

function useInvalidateCycle() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['cycle'] });
    qc.invalidateQueries({ queryKey: keys.moments });
  };
}

export function useAddCycleLog() {
  const invalidate = useInvalidateCycle();
  return useMutation({
    mutationFn: (body: { periodStart: string }) => apiFetch<CycleLog>('/api/cycles/logs', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteCycleLog() {
  const invalidate = useInvalidateCycle();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/cycles/logs/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useSetDefaultLength() {
  const qc = useQueryClient();
  const invalidate = useInvalidateCycle();
  return useMutation({
    mutationFn: (days: number) => apiFetch<void>('/api/cycles/default-length', { method: 'PUT', body: { days } }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: keys.settings });
    },
  });
}

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { Moment } from '@/lib/api/types';
import { keys } from '@/lib/query';

export function useMoments() {
  return useQuery({ queryKey: keys.moments, queryFn: () => apiFetch<Moment[]>('/api/moments') });
}

import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });
}

export const keys = {
  me: ['me'] as const,
  settings: ['settings'] as const,
  couple: ['couple'] as const,
  distance: ['distance'] as const,
  moments: ['moments'] as const,
  moment: (id: string) => ['moments', id] as const,
  reminders: (id: string) => ['moments', id, 'reminders'] as const,
  cycleLogs: ['cycle', 'logs'] as const,
  prediction: (userId: string) => ['cycle', 'prediction', userId] as const,
  traits: (userId: string) => ['traits', userId] as const,
  catalog: ['traits', 'catalog'] as const,
};

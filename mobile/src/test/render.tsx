import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';

import { SessionProvider } from '@/lib/auth/session';

export async function renderWithProviders(ui: React.ReactElement, { withSession = false } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const tree = (
    <QueryClientProvider client={client}>{withSession ? <SessionProvider>{ui}</SessionProvider> : ui}</QueryClientProvider>
  );
  const result = await render(tree);
  return { ...result, client };
}

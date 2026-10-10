import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState } from 'react';

import { apiFetch, setSessionExpiredHandler } from '@/lib/api/client';
import type { TokenResponse } from '@/lib/api/types';

import { tokenStore } from './token-store';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

type SessionValue = {
  status: SessionStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>('loading');

  useEffect(() => {
    let active = true;
    tokenStore.getRefresh().then((token) => {
      if (active) setStatus(token ? 'signedIn' : 'signedOut');
    });
    setSessionExpiredHandler(() => {
      queryClient.clear();
      setStatus('signedOut');
    });
    return () => {
      active = false;
      setSessionExpiredHandler(null);
    };
  }, [queryClient]);

  async function start(path: string, body: Record<string, string>) {
    const tokens = await apiFetch<TokenResponse>(path, { method: 'POST', body, auth: false });
    await tokenStore.save(tokens);
    queryClient.clear();
    setStatus('signedIn');
  }

  const value: SessionValue = {
    status,
    signIn: (email, password) => start('/api/auth/login', { email, password }),
    signUp: (email, password, displayName) => start('/api/auth/register', { email, password, displayName }),
    async signOut() {
      const refreshToken = await tokenStore.getRefresh();
      if (refreshToken) {
        await apiFetch('/api/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }).catch(() => undefined);
      }
      await tokenStore.clear();
      queryClient.clear();
      setStatus('signedOut');
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession phải được dùng bên trong <SessionProvider>');
  }
  return value;
}

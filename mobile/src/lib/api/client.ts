import { API_URL } from '@/lib/config';
import { tokenStore } from '@/lib/auth/token-store';

import type { TokenResponse } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Options = { method?: string; body?: unknown; auth?: boolean };
type RawResponse = { ok: boolean; status: number; text: () => Promise<string> };

let onSessionExpired: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

/** Thông điệp tiếng Việt để hiển thị cho người dùng từ một lỗi bất kỳ. */
export function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Có lỗi xảy ra, vui lòng thử lại';
}

/** Được gọi khi refresh token cũng hết hạn (SessionProvider chuyển về màn đăng nhập). */
export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn;
}

export async function apiFetch<T>(path: string, opts: Options = {}): Promise<T> {
  const res = await send(path, opts);
  if (res.status === 401 && opts.auth !== false) {
    if (await refreshTokens()) {
      return parse<T>(await send(path, opts));
    }
    await tokenStore.clear();
    onSessionExpired?.();
    throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
  }
  return parse<T>(res);
}

async function send(path: string, opts: Options): Promise<RawResponse> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.auth !== false) {
    const token = await tokenStore.getAccess();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  try {
    return await fetch(API_URL + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Không kết nối được máy chủ, kiểm tra mạng và thử lại');
  }
}

async function parse<T>(res: RawResponse): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.code ?? 'UNKNOWN',
      data?.detail ?? 'Có lỗi xảy ra, vui lòng thử lại',
      data?.fields,
    );
  }
  return data as T;
}

/** Chỉ một lần refresh chạy tại một thời điểm; các request 401 khác chờ chung. */
function refreshTokens(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await tokenStore.getRefresh();
      if (!refreshToken) return false;
      try {
        const res = await send('/api/auth/refresh', { method: 'POST', body: { refreshToken }, auth: false });
        if (!res.ok) return false;
        await tokenStore.save(await parse<TokenResponse>(res));
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

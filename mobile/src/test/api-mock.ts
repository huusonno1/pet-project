import { API_URL } from '@/lib/config';
import type { ApiError } from '@/lib/api/client';

export type MockRequest = { method: string; path: string; body: unknown; headers: Record<string, string> };
type MockResponse = { status?: number; body?: unknown };
type Route = MockResponse | ((req: MockRequest) => MockResponse);

function response(status: number, body: unknown) {
  const text = body === undefined ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

/** Thay global.fetch; route theo key "METHOD /path" (khớp cả có/không query string). */
export function mockApi(routes: Record<string, Route>) {
  const calls: MockRequest[] = [];
  global.fetch = jest.fn(async (input: unknown, init: { method?: string; body?: unknown; headers?: unknown } = {}) => {
    const url = String(input);
    const method = (init.method ?? 'GET').toUpperCase();
    const path = url.startsWith(API_URL) ? url.slice(API_URL.length) : url;
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const req: MockRequest = { method, path, body, headers: (init.headers ?? {}) as Record<string, string> };
    calls.push(req);
    const route = routes[`${method} ${path}`] ?? routes[`${method} ${path.split('?')[0]}`];
    if (!route) {
      return response(404, { code: 'NOT_FOUND', detail: `Không có mock cho ${method} ${path}` });
    }
    const r = typeof route === 'function' ? route(req) : route;
    return response(r.status ?? 200, r.body);
  }) as unknown as typeof fetch;
  return { calls };
}

/** Chờ promise bị reject và trả về lỗi (đúng kiểu ApiError) để assert. */
export async function rejectionOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('Mong đợi promise bị reject nhưng nó thành công');
}

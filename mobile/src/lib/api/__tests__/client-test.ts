import { ApiError, apiFetch, setSessionExpiredHandler } from '@/lib/api/client';
import { tokenStore } from '@/lib/auth/token-store';
import { mockApi, rejectionOf } from '@/test/api-mock';

const TOKENS = { accessToken: 'old-access', refreshToken: 'old-refresh' };

describe('apiFetch', () => {
  afterEach(() => setSessionExpiredHandler(null));

  test('attaches bearer token and parses JSON', async () => {
    await tokenStore.save(TOKENS);
    const api = mockApi({ 'GET /api/me': { body: { id: 'u1' } } });

    await expect(apiFetch('/api/me')).resolves.toEqual({ id: 'u1' });
    expect(api.calls[0].headers.Authorization).toBe('Bearer old-access');
  });

  test('throws ApiError with code, detail and fields', async () => {
    mockApi({
      'POST /api/auth/register': {
        status: 400,
        body: { code: 'VALIDATION_FAILED', detail: 'Dữ liệu không hợp lệ', fields: { email: 'sai' } },
      },
    });

    const error = await rejectionOf(apiFetch('/api/auth/register', { method: 'POST', body: {}, auth: false }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.message).toBe('Dữ liệu không hợp lệ');
    expect(error.fields).toEqual({ email: 'sai' });
  });

  test('refreshes once on 401 and retries with new token', async () => {
    await tokenStore.save(TOKENS);
    const api = mockApi({
      'GET /api/me': (req) =>
        req.headers.Authorization === 'Bearer new-access' ? { body: { id: 'u1' } } : { status: 401, body: {} },
      'POST /api/auth/refresh': { body: { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 } },
    });

    await expect(apiFetch('/api/me')).resolves.toEqual({ id: 'u1' });
    expect(api.calls.filter((c) => c.path === '/api/auth/refresh')).toHaveLength(1);
    expect(api.calls.find((c) => c.path === '/api/auth/refresh')?.body).toEqual({ refreshToken: 'old-refresh' });
    await expect(tokenStore.getRefresh()).resolves.toBe('new-refresh');
  });

  test('concurrent401sRefreshOnce', async () => {
    await tokenStore.save(TOKENS);
    const api = mockApi({
      'GET /api/me': (req) =>
        req.headers.Authorization === 'Bearer new-access' ? { body: { id: 'u1' } } : { status: 401, body: {} },
      'GET /api/couples/me': (req) =>
        req.headers.Authorization === 'Bearer new-access' ? { body: { id: 'c1' } } : { status: 401, body: {} },
      'POST /api/auth/refresh': { body: { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 } },
    });

    const [me, couple] = await Promise.all([apiFetch('/api/me'), apiFetch('/api/couples/me')]);

    expect(me).toEqual({ id: 'u1' });
    expect(couple).toEqual({ id: 'c1' });
    expect(api.calls.filter((c) => c.path === '/api/auth/refresh')).toHaveLength(1);
  });

  test('refreshFailureSignsOut', async () => {
    await tokenStore.save(TOKENS);
    const expired = jest.fn();
    setSessionExpiredHandler(expired);
    mockApi({
      'GET /api/me': { status: 401, body: {} },
      'POST /api/auth/refresh': { status: 401, body: { code: 'UNAUTHORIZED' } },
    });

    const error = await rejectionOf(apiFetch('/api/me'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(expired).toHaveBeenCalledTimes(1);
    await expect(tokenStore.getAccess()).resolves.toBeNull();
  });

  test('network failure becomes ApiError NETWORK', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    const error = await rejectionOf(apiFetch('/api/me'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('NETWORK');
  });

  test('explicit null body is sent as JSON null', async () => {
    await tokenStore.save(TOKENS);
    const api = mockApi({ 'PUT /api/moments/m1/reminder-config': { body: { id: 'm1' } } });

    await apiFetch('/api/moments/m1/reminder-config', { method: 'PUT', body: null });

    expect(api.calls[0].body).toBeNull();
    expect(api.calls[0].headers['Content-Type']).toBe('application/json');
  });
});

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import CycleScreen from '@/features/cycle/CycleScreen';
import { toIsoDate } from '@/lib/format';
import { mockApi } from '@/test/api-mock';
import { renderWithProviders } from '@/test/render';

function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

function routes(overrides: Record<string, unknown> = {}) {
  return {
    'GET /api/couples/me': {
      body: { id: 'c1', startedDatingOn: null, createdAt: '', partner: { id: 'u2', displayName: 'Minh' } },
    },
    'GET /api/me/settings': { body: { shareLocation: true, shareCycle: true, cycleLengthDefault: 28, notifyPrefs: {} } },
    'GET /api/cycles/logs': { body: [{ id: 'l1', periodStart: inDays(-18), periodEnd: null }] },
    'GET /api/cycles/prediction': { body: { nextStart: inDays(10), averageLength: 28, basedOnCycles: 0 } },
    'GET /api/cycles/prediction?userId=u2': { status: 404, body: { code: 'NOT_FOUND', detail: 'Không tìm thấy' } },
    'POST /api/cycles/logs': { status: 201, body: { id: 'l2', periodStart: inDays(0), periodEnd: null } },
    'PUT /api/me/settings': { body: { shareLocation: true, shareCycle: false, cycleLengthDefault: 28, notifyPrefs: {} } },
    'PUT /api/cycles/default-length': { status: 204 },
    ...overrides,
  };
}

describe('CycleScreen', () => {
  test('shows my prediction and a hint when partner has not shared', async () => {
    mockApi(routes());
    await renderWithProviders(<CycleScreen />);

    expect(await screen.findByText(/Kỳ tiếp theo dự kiến/)).toBeOnTheScreen();
    expect(screen.getByText('Còn 10 ngày')).toBeOnTheScreen();
    expect(await screen.findByText('Người ấy chưa chia sẻ hoặc chưa có dữ liệu.')).toBeOnTheScreen();
  });

  test('logging a period start posts today by default', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<CycleScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Ghi lại' }));

    await waitFor(() => expect(api.calls.some((c) => c.method === 'POST')).toBe(true));
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({ periodStart: inDays(0) });
  });

  test('turning off sharing updates settings', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<CycleScreen />);

    await fireEvent(await screen.findByRole('switch', { name: 'Chia sẻ với người ấy' }), 'valueChange', false);

    await waitFor(() => expect(api.calls.some((c) => c.method === 'PUT' && c.path === '/api/me/settings')).toBe(true));
    expect(api.calls.find((c) => c.path === '/api/me/settings' && c.method === 'PUT')?.body).toEqual({ shareCycle: false });
  });

  test('default length can be increased when there is not enough data', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<CycleScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Tăng độ dài chu kỳ' }));

    await waitFor(() =>
      expect(api.calls.find((c) => c.path === '/api/cycles/default-length')?.body).toEqual({ days: 29 }),
    );
  });
});

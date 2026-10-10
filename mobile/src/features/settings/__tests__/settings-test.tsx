import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import SettingsScreen from '@/features/settings/SettingsScreen';
import { mockApi } from '@/test/api-mock';
import { renderWithProviders } from '@/test/render';

const SETTINGS = { shareLocation: true, shareCycle: true, cycleLengthDefault: 28, notifyPrefs: {} };

function routes() {
  return {
    'GET /api/me': { body: { id: 'u1', email: 'lan@x.vn', displayName: 'Lan', birthday: null, timezone: 'Asia/Ho_Chi_Minh', avatarUrl: null } },
    'GET /api/me/settings': { body: SETTINGS },
    'GET /api/couples/me': {
      body: { id: 'c1', startedDatingOn: '2025-02-14', createdAt: '', partner: { id: 'u2', displayName: 'Minh' } },
    },
    'PUT /api/me/settings': (req: { body: unknown }) => ({ body: { ...SETTINGS, ...(req.body as object) } }),
    'PATCH /api/me': (req: { body: unknown }) => ({
      body: { id: 'u1', email: 'lan@x.vn', displayName: 'Lan Anh', birthday: null, timezone: 'Asia/Ho_Chi_Minh', avatarUrl: null, ...(req.body as object) },
    }),
    'POST /api/couples/me/end': { status: 204 },
  };
}

describe('SettingsScreen', () => {
  test('toggling location sharing updates settings', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<SettingsScreen />, { withSession: true });

    await fireEvent(await screen.findByRole('switch', { name: 'Chia sẻ vị trí' }), 'valueChange', false);

    await waitFor(() => expect(api.calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({ shareLocation: false });
  });

  test('turning off date plan notifications sends notifyPrefs', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<SettingsScreen />, { withSession: true });

    await fireEvent(await screen.findByRole('switch', { name: 'Nhắc lịch hẹn' }), 'valueChange', false);

    await waitFor(() => expect(api.calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({ notifyPrefs: { DATE_PLAN: false } });
  });

  test('saving profile patches name', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<SettingsScreen />, { withSession: true });

    await fireEvent.changeText(await screen.findByLabelText('Tên hiển thị'), 'Lan Anh');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu hồ sơ' }));

    await waitFor(() => expect(api.calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(api.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ displayName: 'Lan Anh' });
  });

  test('ending the couple asks for confirmation first', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const api = mockApi(routes());
    await renderWithProviders(<SettingsScreen />, { withSession: true });

    await fireEvent.press(await screen.findByRole('button', { name: 'Kết thúc cặp đôi' }));

    expect(Alert.alert).toHaveBeenCalled();
    await waitFor(() => expect(api.calls.some((c) => c.path === '/api/couples/me/end')).toBe(true));
  });
});

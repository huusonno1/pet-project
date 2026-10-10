import { screen } from '@testing-library/react-native';
import * as Location from 'expo-location';

import HomeScreen from '@/features/home/HomeScreen';
import { toIsoDate } from '@/lib/format';
import { mockApi } from '@/test/api-mock';
import { renderWithProviders } from '@/test/render';

function routes(overrides: Record<string, unknown> = {}) {
  const start = new Date();
  start.setDate(start.getDate() - 100);
  return {
    'GET /api/me': { body: { id: 'u1', email: 'lan@x.vn', displayName: 'Lan', birthday: null, timezone: 'Asia/Ho_Chi_Minh', avatarUrl: null } },
    'GET /api/couples/me': {
      body: { id: 'c1', startedDatingOn: toIsoDate(start), createdAt: '2026-01-01T00:00:00Z', partner: { id: 'u2', displayName: 'Minh' } },
    },
    'GET /api/me/settings': { body: { shareLocation: true, shareCycle: true, cycleLengthDefault: 28, notifyPrefs: {} } },
    'GET /api/couples/distance': {
      body: { distanceKm: 1137.4, me: { updatedAt: new Date().toISOString() }, partner: { updatedAt: new Date().toISOString() } },
    },
    'GET /api/moments': { body: [] },
    'PUT /api/me/location': { status: 204 },
    ...overrides,
  };
}

describe('HomeScreen', () => {
  test('shows names, days together and distance', async () => {
    mockApi(routes());
    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('Lan ❤ Minh')).toBeOnTheScreen();
    expect(await screen.findByText('100 ngày bên nhau')).toBeOnTheScreen();
    expect(await screen.findByText('1.137 km')).toBeOnTheScreen();
  });

  test('sends current location when permission is granted', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<HomeScreen />);

    await screen.findByText('1.137 km');
    await screen.findByText('Lan ❤ Minh');
    const put = api.calls.find((c) => c.method === 'PUT' && c.path === '/api/me/location');
    expect(put?.body).toEqual({ lat: 21.0285, lng: 105.8542, accuracy: 20 });
  });

  test('showsPermissionHintWhenDenied', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
      status: 'denied',
      canAskAgain: false,
      expires: 'never',
    });
    const api = mockApi(routes({ 'GET /api/couples/distance': { body: { distanceKm: null, me: null, partner: null } } }));
    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('Bạn chưa cho phép truy cập vị trí.')).toBeOnTheScreen();
    expect(api.calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  test('explains when partner has not shared location', async () => {
    mockApi(
      routes({
        'GET /api/couples/distance': { body: { distanceKm: null, me: { updatedAt: new Date().toISOString() }, partner: null } },
      }),
    );
    await renderWithProviders(<HomeScreen />);
    expect(await screen.findByText('Người ấy chưa bật chia sẻ vị trí')).toBeOnTheScreen();
  });
});

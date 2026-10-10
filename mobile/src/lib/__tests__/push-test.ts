import { getLastPushToken, registerForPushAsync, routeForDeepLink } from '@/lib/push';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'project-123' } } } },
}));

describe('push', () => {
  test('routeForDeepLink maps backend deep links to app routes', () => {
    expect(routeForDeepLink('coupleapp://moments/abc-123')).toBe('/moments/abc-123');
    expect(routeForDeepLink('coupleapp://traits/u2')).toBe('/traits');
    expect(routeForDeepLink('coupleapp://home')).toBe('/');
    expect(routeForDeepLink('https://evil.example/x')).toBeNull();
    expect(routeForDeepLink(undefined)).toBeNull();
  });

  test('registers and remembers the Expo push token', async () => {
    await expect(registerForPushAsync()).resolves.toBe('ExponentPushToken[test]');
    expect(getLastPushToken()).toBe('ExponentPushToken[test]');
  });

  test('returns null on simulators', async () => {
    const device = require('expo-device');
    device.isDevice = false;
    try {
      await expect(registerForPushAsync()).resolves.toBeNull();
    } finally {
      device.isDevice = true;
    }
  });

  test('returns null when permission is denied', async () => {
    const notifications = require('expo-notifications');
    notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    notifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    await expect(registerForPushAsync()).resolves.toBeNull();
  });
});

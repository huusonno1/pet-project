import { getLastPushToken, registerForPushAsync, routeForDeepLink } from '@/lib/push';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'project-123' } } } },
}));

describe('push', () => {
  test.each([
    ['coupleapp://home', '/'],
    ['coupleapp://', '/'],
    ['coupleapp://notes', '/notes'],
    ['coupleapp://pair/requests', '/pair/requests'],
    ['coupleapp://moments/abc-123', '/moments/abc-123'],
    ['coupleapp://traits/u2', '/partner'],
    ['https://evil.example', null],
    ['coupleapp://unknown', null],
    [42, null],
  ])('deep link %p -> %p', (url, route) => {
    expect(routeForDeepLink(url)).toBe(route);
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

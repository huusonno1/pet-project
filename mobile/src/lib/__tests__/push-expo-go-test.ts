import { isPushSupported } from '@/lib/push-support';

describe('push in Expo Go on Android', () => {
  test('does not load expo-notifications there and registration returns null', async () => {
    let push: typeof import('@/lib/push') | undefined;
    jest.isolateModules(() => {
      // Expo Go (SDK 53+) ném lỗi ngay khi import expo-notifications trên Android
      jest.doMock('expo-notifications', () => {
        throw new Error('expo-notifications: Android Push notifications ... removed from Expo Go');
      });
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: { executionEnvironment: 'storeClient', expoConfig: {} },
      }));
      const { Platform } = require('react-native');
      jest.replaceProperty(Platform, 'OS', 'android');
      expect(() => require('expo-notifications')).toThrow(/removed from Expo Go/);
      push = require('@/lib/push');
    });

    expect(push?.pushSupported).toBe(false);
    await expect(push!.registerForPushAsync()).resolves.toBeNull();
  });

  test('isPushSupported only rejects Expo Go on Android', () => {
    expect(isPushSupported('android', 'storeClient')).toBe(false);
    expect(isPushSupported('ios', 'storeClient')).toBe(true);
    expect(isPushSupported('android', 'bare')).toBe(true);
    expect(isPushSupported('android', undefined)).toBe(true);
  });
});

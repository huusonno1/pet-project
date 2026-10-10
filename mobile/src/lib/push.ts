import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let lastPushToken: string | null = null;

export function getLastPushToken(): string | null {
  return lastPushToken;
}

/**
 * Xin quyền + lấy Expo push token. Trả null khi chạy simulator, bị từ chối quyền,
 * chưa có EAS projectId (chưa chạy `eas init`) hoặc chạy Expo Go trên Android.
 */
export async function registerForPushAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Mặc định',
        importance: Notifications.AndroidImportance.MAX,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    lastPushToken = data;
    return data;
  } catch {
    return null;
  }
}

export function routeForDeepLink(url: unknown): string | null {
  if (typeof url !== 'string' || !url.startsWith('coupleapp://')) return null;
  const path = url.slice('coupleapp://'.length);
  if (path === '' || path === 'home') return '/';
  const moment = /^moments\/([\w-]+)$/.exec(path);
  if (moment) return `/moments/${moment[1]}`;
  if (/^traits\/[\w-]+$/.test(path)) return '/traits';
  return null;
}

import type { NotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { apiFetch } from '@/lib/api/client';

import { loadNotifications, registerForPushAsync, routeForDeepLink } from './push';

/** Đăng ký thiết bị nhận push với backend một lần sau khi vào khu vực đã đăng nhập. */
export function usePushRegistration() {
  useEffect(() => {
    let cancelled = false;
    registerForPushAsync().then((token) => {
      if (!token || cancelled) return;
      apiFetch('/api/me/devices', {
        method: 'POST',
        body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
      }).catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, []);
}

/** Bấm vào thông báo → mở đúng màn hình theo deep link backend gửi kèm (`data.url`). */
export function useNotificationRouting() {
  useEffect(() => {
    const Notifications = loadNotifications();
    if (!Notifications) return;
    let handled: string | null = null;
    const open = (response: NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (id === handled) return;
      handled = id;
      const route = routeForDeepLink(response.notification.request.content.data?.url);
      if (route) router.push(route);
    };
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) open(response);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, []);
}

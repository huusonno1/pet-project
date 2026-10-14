import { focusManager, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { loadNotifications } from './push';

/**
 * Giữ dữ liệu hai người luôn mới: app quay lại foreground → TanStack coi là "focus" và refetch
 * query đã cũ (đồng thời tạm dừng polling khi app ở nền); nhận push lúc đang mở app → làm mới ngay.
 */
export function useLiveSync() {
  const client = useQueryClient();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const Notifications = loadNotifications();
    if (!Notifications) return;
    const subscription = Notifications.addNotificationReceivedListener(() => client.invalidateQueries());
    return () => subscription.remove();
  }, [client]);
}

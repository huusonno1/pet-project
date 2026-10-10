import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useSettings } from '@/features/account/api';
import { apiFetch } from '@/lib/api/client';
import { keys } from '@/lib/query';

export type LocationStatus = 'checking' | 'denied' | 'disabled' | 'ok' | 'error';

/** Gửi vị trí hiện tại lên server khi mở màn hình và mỗi lần app trở lại foreground. */
export function useLocationSync(): LocationStatus {
  const settings = useSettings();
  const qc = useQueryClient();
  const [status, setStatus] = useState<LocationStatus>('checking');
  const shareLocation = settings.data?.shareLocation;

  useEffect(() => {
    if (shareLocation === undefined) return;
    if (!shareLocation) {
      setStatus('disabled');
      return;
    }
    let cancelled = false;
    const sync = async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (!permission.granted) {
        setStatus('denied');
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await apiFetch('/api/me/location', {
          method: 'PUT',
          body: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy ?? undefined,
          },
        });
        if (!cancelled) {
          setStatus('ok');
          qc.invalidateQueries({ queryKey: keys.distance });
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    };
    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [shareLocation, qc]);

  return status;
}

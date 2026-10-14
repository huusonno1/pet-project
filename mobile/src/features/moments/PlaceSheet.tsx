import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import type { PlaceInput } from '@/lib/api/types';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { ErrorText } from '@/ui/ErrorText';
import { Sheet } from '@/ui/Sheet';
import { TextField } from '@/ui/TextField';
import { colors } from '@/ui/theme';

type Props = { visible: boolean; value: PlaceInput | null; onChange: (p: PlaceInput | null) => void; onClose: () => void };

export function PlaceSheet({ visible, value, onChange, onClose }: Props) {
  const [name, setName] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(value?.name ?? '');
    setCoords(value ? { lat: value.lat, lng: value.lng } : null);
    setError(null);
  }, [visible, value]);

  async function locate() {
    setLocating(true);
    setError(null);
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (!p.granted) {
        setError('Cần cho phép truy cập vị trí');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setError('Không lấy được vị trí, thử lại nhé');
    } finally {
      setLocating(false);
    }
  }

  function save() {
    if (!name.trim()) return setError('Đặt tên cho địa điểm');
    if (!coords) return setError('Bấm "Dùng vị trí hiện tại" để lấy toạ độ');
    onChange({ name: name.trim(), lat: coords.lat, lng: coords.lng });
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Địa điểm" subtitle="Hiện trên bản đồ hẹn hò sau này">
      <TextField label="Tên địa điểm" value={name} onChangeText={setName} placeholder="VD: Cộng Cà Phê Hoàn Kiếm" />
      <Button title={coords ? 'Đã lấy vị trí hiện tại' : 'Dùng vị trí hiện tại'} icon="navigation" variant="secondary" onPress={locate} loading={locating} />
      {coords ? <AppText variant="caption" color={colors.textMuted}>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</AppText> : null}
      <ErrorText message={error} />
      <Button title="Xong" onPress={save} />
      {value ? <Button title="Bỏ địa điểm" variant="ghost" onPress={() => { onChange(null); onClose(); }} /> : null}
    </Sheet>
  );
}

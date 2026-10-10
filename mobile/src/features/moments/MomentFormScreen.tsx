import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { PhotoItem, PhotoStrip } from '@/features/media/PhotoStrip';
import { uploadImage } from '@/features/media/upload';
import { errorMessage } from '@/lib/api/client';
import type { Moment, MomentType } from '@/lib/api/types';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { DateField } from '@/ui/DateField';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { colors, spacing } from '@/ui/theme';

import { useCreateMoment, useUpdateMoment } from './api';
import { applyOccasion, emptyForm, formFromMoment, MomentForm, toMomentInput, validateForm } from './form';
import { CREATABLE_TYPES, OCCASIONS, TYPE_LABELS } from './labels';

type Props = { initial?: Moment; meId: string; partnerId: string };

export function MomentFormScreen({ initial, meId, partnerId }: Props) {
  const create = useCreateMoment();
  const update = useUpdateMoment(initial?.id ?? '');
  const [form, setForm] = useState<MomentForm>(() => (initial ? formFromMoment(initial, meId) : emptyForm(new Date())));
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    initial ? initial.media.map((m) => ({ key: m.id, kind: 'remote' as const, media: m })) : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const set = (patch: Partial<MomentForm>) => setForm((f) => ({ ...f, ...patch }));

  async function addCurrentLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Cần quyền vị trí để gắn địa điểm');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      set({ place: { name: '', lat: position.coords.latitude, lng: position.coords.longitude } });
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    const problem = validateForm(form);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const mediaIds: string[] = [];
      for (const p of photos) {
        if (p.kind === 'remote') {
          mediaIds.push(p.media.id);
        } else {
          const media = await uploadImage(p.uri, { filter: p.filter === 'ORIGINAL' ? null : p.filter });
          mediaIds.push(media.id);
        }
      }
      const input = toMomentInput(form, { me: meId, partner: partnerId }, mediaIds, initial ? 'edit' : 'create');
      if (initial) {
        await update.mutateAsync(input);
        router.back();
      } else {
        const created = await create.mutateAsync(input);
        router.replace(`/moments/${created.id}`);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const showSubject = form.type === 'GIFT_OCCASION' || form.type === 'CUSTOM';

  return (
    <Screen>
      {!initial && (
        <View style={styles.chips}>
          {CREATABLE_TYPES.map((t: MomentType) => (
            <Chip key={t} label={TYPE_LABELS[t]} selected={form.type === t} onPress={() => set({ type: t })} />
          ))}
        </View>
      )}

      {form.type === 'GIFT_OCCASION' && (
        <>
          <Text style={styles.label}>Dịp</Text>
          <View style={styles.chips}>
            {OCCASIONS.map((o) => (
              <Chip
                key={o.code}
                label={o.label}
                selected={form.occasion === o.code}
                onPress={() => setForm((f) => applyOccasion(f, o.code, new Date()))}
              />
            ))}
          </View>
        </>
      )}

      {showSubject && (
        <>
          <Text style={styles.label}>{form.type === 'GIFT_OCCASION' ? 'Người nhận quà' : 'Kỷ niệm của ai (không bắt buộc)'}</Text>
          <View style={styles.chips}>
            <Chip label="Tôi" selected={form.subject === 'me'} onPress={() => set({ subject: 'me' })} />
            <Chip label="Người ấy" selected={form.subject === 'partner'} onPress={() => set({ subject: 'partner' })} />
          </View>
        </>
      )}

      <TextField label="Tiêu đề" value={form.title} onChangeText={(title) => set({ title })} />
      <DateField label="Ngày" value={form.date} onChange={(date) => set({ date })} />
      {form.type === 'DATE_PLAN' && (
        <DateField label="Giờ hẹn" mode="time" value={form.time} onChange={(time) => set({ time })} />
      )}
      {form.type === 'CUSTOM' && (
        <View style={styles.switchRow}>
          <Text style={styles.label}>Lặp lại hằng năm</Text>
          <Switch
            accessibilityLabel="Lặp lại hằng năm"
            value={form.yearly}
            onValueChange={(yearly) => set({ yearly })}
            trackColor={{ true: colors.primary }}
          />
        </View>
      )}
      <TextField label="Lời nhắn" value={form.message} onChangeText={(message) => set({ message })} multiline />

      <Card>
        <Text style={styles.label}>Địa điểm</Text>
        {initial?.place && !form.place && <Text style={styles.muted}>📍 {initial.place.name}</Text>}
        {form.place ? (
          <>
            <TextField
              label="Tên địa điểm"
              value={form.place.name}
              onChangeText={(name) => setForm((f) => (f.place ? { ...f, place: { ...f.place, name } } : f))}
            />
            <Button title="Bỏ địa điểm" variant="secondary" onPress={() => set({ place: null })} />
          </>
        ) : (
          <Button title="Gắn vị trí hiện tại" variant="secondary" onPress={addCurrentLocation} loading={locating} />
        )}
      </Card>

      <Card>
        <Text style={styles.label}>Ảnh</Text>
        <PhotoStrip items={photos} onChange={setPhotos} />
      </Card>

      <ErrorText message={error} />
      <Button title="Lưu kỷ niệm" onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  label: { color: colors.text, fontWeight: '500', marginBottom: spacing.xs },
  muted: { color: colors.muted, marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
});

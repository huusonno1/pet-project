import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useCouple } from '@/features/couple/api';
import { useCreateMoment } from '@/features/moments/api';
import { MOODS, moodLabel } from '@/features/moments/labels';
import { PlaceSheet } from '@/features/moments/PlaceSheet';
import { errorMessage } from '@/lib/api/client';
import type { MomentInput, PlaceInput } from '@/lib/api/types';
import { combineDateTime, formatDate, pad, toIsoDate } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { DatePickerSheet } from '@/ui/DatePickerSheet';
import { ErrorText } from '@/ui/ErrorText';
import { Icon } from '@/ui/Icon';
import { ListRow } from '@/ui/ListRow';
import { PhotoTile } from '@/ui/PhotoTile';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { colors } from '@/ui/theme';
import { Toggle } from '@/ui/Toggle';
import { TopBar } from '@/ui/TopBar';

import { captureStore, useCapture } from './capture-store';
import { momentTitle } from './moment-input';
import { uploadCapture } from './upload-capture';

export default function MomentCaptureScreen() {
  const capture = useCapture();
  const couple = useCouple();
  const create = useCreateMoment();
  const partner = couple.data?.partner;
  const now = new Date();
  const [caption, setCaption] = useState(capture.caption);
  const [mood, setMood] = useState<string | null>(null);
  const [date, setDate] = useState(capture.date || toIsoDate(now));
  const [time, setTime] = useState(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
  const [place, setPlace] = useState<PlaceInput | null>(null);
  const [notify, setNotify] = useState(true);
  const [timeOpen, setTimeOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addPhotos() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.9 });
    if (!res.canceled && res.assets?.length) captureStore.set({ uris: [...capture.uris, ...res.assets.map((a) => a.uri)].slice(0, 30) });
  }

  async function save() {
    if (capture.uris.length === 0 && !caption.trim()) {
      setError('Thêm ảnh hoặc viết vài dòng nhé');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const mediaIds = await uploadCapture(capture);
      const input: MomentInput = {
        type: 'MOMENT',
        title: momentTitle(caption, mood),
        occursOn: date,
        occursAt: combineDateTime(date, time),
        message: caption.trim(),
        details: mood ? { mood } : {},
        mediaIds,
      };
      if (partner) {
        input.notifyPartner = notify;
        if (place) input.place = place;
      }
      await create.mutateAsync(input);
      captureStore.reset();
      router.replace(`/journal/${date}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const label = moodLabel(mood);
  const preview = `${partner?.displayName} nhận: “Bạn vừa lưu một khoảnh khắc ${label && mood !== 'OTHER' ? label.toLowerCase() : 'mới'}”`;

  return (
    <Screen bottomPad={40}>
      <TopBar title="Khoảnh khắc" right={<View style={styles.badge}><AppText variant="micro" color={colors.mintInk}>Không nhắc nhở</AppText></View>} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {capture.uris.map((uri, i) => (
          <PhotoTile key={uri} uri={uri} seed={uri} style={styles.thumb}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Bỏ ảnh ${i + 1}`} style={styles.remove}
              onPress={() => captureStore.set({ uris: capture.uris.filter((u) => u !== uri) })}>
              <Icon name="close" size={12} color={colors.white} />
            </Pressable>
          </PhotoTile>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="Thêm ảnh" onPress={addPhotos} style={styles.add}>
          <Icon name="plus" size={20} color={colors.roseStrong} />
          <AppText variant="captionStrong" color={colors.roseStrong}>Thêm</AppText>
        </Pressable>
      </ScrollView>
      <TextField label="Bạn đang nghĩ gì?" value={caption} onChangeText={setCaption} multiline placeholder="Viết vài dòng cho khoảnh khắc này…" />
      <AppText variant="micro" color={colors.textMuted}>CẢM XÚC</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {MOODS.map((m) => (
          <Chip key={m.code} label={m.code === 'OTHER' ? '+ Khác' : m.label} selected={mood === m.code} onPress={() => setMood(mood === m.code ? null : m.code)} />
        ))}
      </View>
      <Card style={{ paddingVertical: 4, gap: 0 }}>
        <ListRow icon="clock" iconBg={colors.surfaceMuted} iconColor={colors.textMuted} title="Thời gian"
          right={<AppText variant="bodyStrong">{date === toIsoDate(now) ? 'Hôm nay' : formatDate(date)}, {time}</AppText>}
          onPress={() => setTimeOpen(true)} />
        {partner ? (
          <ListRow icon="pin" iconBg={colors.surfaceMuted} iconColor={colors.textMuted} title="Địa điểm"
            right={<AppText variant="bodyStrong" numberOfLines={1} style={{ maxWidth: 160 }}>{place?.name ?? 'Thêm'}</AppText>}
            onPress={() => setPlaceOpen(true)} />
        ) : null}
      </Card>
      {partner ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Báo cho {partner.displayName} biết</AppText>
            <AppText variant="caption" color={colors.textMuted}>{notify ? preview : 'Chỉ lưu vào Nhật ký, không gửi thông báo'}</AppText>
          </View>
          <Toggle label={`Báo cho ${partner.displayName} biết`} value={notify} onValueChange={setNotify} />
        </Card>
      ) : (
        <AppText variant="caption" color={colors.textMuted}>Khoảnh khắc này chỉ mình bạn xem được.</AppText>
      )}
      <ErrorText message={error} />
      <Button title="Lưu vào Nhật ký" onPress={save} loading={saving} />

      <DatePickerSheet visible={timeOpen} mode="datetime" title="Thời gian" value={date} time={time} maxDate={toIsoDate(now)}
        onClose={() => setTimeOpen(false)} onConfirm={(d, t) => { setDate(d); if (t) setTime(t); setTimeOpen(false); }} />
      <PlaceSheet visible={placeOpen} value={place} onChange={setPlace} onClose={() => setPlaceOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.mint },
  thumb: { width: 76, height: 96, borderRadius: 18 },
  remove: { position: 'absolute', right: 6, top: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(43,26,46,0.6)', alignItems: 'center', justifyContent: 'center' },
  add: { width: 76, height: 96, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.rose, backgroundColor: colors.roseSoft, alignItems: 'center', justifyContent: 'center', gap: 4 },
});

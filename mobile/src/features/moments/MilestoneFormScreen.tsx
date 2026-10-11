import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useMe } from '@/features/account/api';
import { useCouple } from '@/features/couple/api';
import { captureStore, useCapture } from '@/features/create/capture-store';
import { uploadCapture } from '@/features/create/upload-capture';
import { uploadImage } from '@/features/media/upload';
import { errorMessage } from '@/lib/api/client';
import type { MomentType } from '@/lib/api/types';
import { formatDate, toIsoDate } from '@/lib/format';
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
import { TopBar } from '@/ui/TopBar';

import { useCreateMoment, useDeleteMoment, useMoment, useUpdateMoment } from './api';
import { applyOccasion, emptyForm, formFromMoment, MomentForm, repeatOptions, toMomentInput, validateForm } from './form';
import { OCCASIONS, TYPE_LABELS } from './labels';
import { recurrenceSummary } from './occurrence';
import { PlaceSheet } from './PlaceSheet';
import { RepeatSheet } from './RepeatSheet';

const TYPES: MomentType[] = ['ANNIVERSARY', 'DATE_PLAN', 'GIFT_OCCASION', 'CUSTOM'];
const NEW_TITLES: Partial<Record<MomentType, string>> = { ANNIVERSARY: 'Kỷ niệm mới', DATE_PLAN: 'Lịch hẹn mới', GIFT_OCCASION: 'Dịp tặng quà mới', CUSTOM: 'Mốc mới' };

export default function MilestoneFormScreen({ mode }: { mode: 'create' | 'edit' }) {
  const params = useLocalSearchParams<{ type?: MomentType; id?: string }>();
  const me = useMe();
  const couple = useCouple();
  const capture = useCapture();
  const existing = useMoment(mode === 'edit' ? params.id ?? '' : '');
  const create = useCreateMoment();
  const update = useUpdateMoment(params.id ?? '');
  const remove = useDeleteMoment();
  const partner = couple.data?.partner;
  const [form, setForm] = useState<MomentForm>(() => {
    const f = emptyForm(new Date(), params.type ?? 'ANNIVERSARY');
    return capture.date ? { ...f, date: capture.date } : f;
  });
  const [newPhotos, setNewPhotos] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(mode === 'create');
  const [sheet, setSheet] = useState<'date' | 'repeat' | 'place' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && existing.data && me.data && !loaded) {
      setForm(formFromMoment(existing.data, me.data.id));
      setLoaded(true);
    }
  }, [mode, existing.data, me.data, loaded]);

  const set = (patch: Partial<MomentForm>) => setForm((f) => ({ ...f, ...patch }));
  const photos = mode === 'create' ? capture.uris : [...(existing.data?.media.map((m) => m.url) ?? []), ...newPhotos];

  async function addPhotos() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.9 });
    if (res.canceled || !res.assets?.length) return;
    const uris = res.assets.map((a) => a.uri);
    if (mode === 'create') captureStore.set({ uris: [...capture.uris, ...uris] });
    else setNewPhotos([...newPhotos, ...uris]);
  }

  async function save() {
    const problem = validateForm(form);
    if (problem) return setError(problem);
    if (!me.data) return;
    setSaving(true);
    setError(null);
    try {
      const ids = { me: me.data.id, partner: partner?.id ?? me.data.id };
      if (mode === 'create') {
        const mediaIds = await uploadCapture(capture);
        const created = await create.mutateAsync(toMomentInput(form, ids, mediaIds, 'create'));
        captureStore.reset();
        router.replace(`/moments/${created.id}`);
      } else {
        const added: string[] = [];
        for (const uri of newPhotos) added.push((await uploadImage(uri, { purpose: 'SHARED' })).id);
        const mediaIds = [...(existing.data?.media.map((m) => m.id) ?? []), ...added];
        await update.mutateAsync(toMomentInput(form, ids, mediaIds, 'edit'));
        router.back();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Xoá kỷ niệm?', 'Ảnh và nhắc nhở của kỷ niệm này cũng bị xoá.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: async () => { await remove.mutateAsync(params.id!); router.replace('/journal'); } },
    ]);
  }

  if (!loaded) return <Screen><AppText color={colors.textMuted}>Đang tải…</AppText></Screen>;

  const options = repeatOptions(form.type);
  const repeatSubtitle = form.type === 'ANNIVERSARY' ? 'Theo mốc ngày yêu · 100, 200… và mỗi năm'
    : form.type === 'GIFT_OCCASION' ? recurrenceSummary('YEARLY', form.date) : recurrenceSummary(form.recurrence, form.date);
  const dateLabel = `${formatDate(form.date)}${form.time ? ` · ${form.time}` : ''}`;

  return (
    <Screen bottomPad={40}>
      <TopBar backIcon="close" title={mode === 'edit' ? 'Sửa kỷ niệm' : NEW_TITLES[form.type] ?? 'Kỷ niệm mới'}
        right={<Pressable accessibilityRole="button" accessibilityLabel="Lưu" onPress={save} disabled={saving} hitSlop={8}>
          <AppText variant="bodyStrong" color={colors.roseStrong}>{saving ? 'Đang lưu…' : 'Lưu'}</AppText>
        </Pressable>} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {photos.map((uri) => <PhotoTile key={uri} uri={uri} seed={uri} style={{ width: 110, height: 130 }} />)}
        <Pressable accessibilityRole="button" accessibilityLabel="Thêm ảnh" onPress={addPhotos} style={styles.add}>
          <Icon name="camera" size={22} color={colors.roseStrong} />
          <AppText variant="captionStrong" color={colors.roseStrong}>Thêm ảnh</AppText>
        </Pressable>
      </ScrollView>

      <TextField label="Tiêu đề" value={form.title} onChangeText={(title) => set({ title })} placeholder="VD: Valentine đầu tiên" />

      {mode === 'create' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TYPES.filter((t) => partner || t === 'CUSTOM').map((t) => (
            <Chip key={t} label={TYPE_LABELS[t]} selected={form.type === t}
              onPress={() => setForm((f) => ({ ...emptyForm(new Date(), t), title: f.title, date: f.date, message: f.message, place: f.place }))} />
          ))}
        </View>
      ) : null}

      {form.type === 'GIFT_OCCASION' ? (
        <>
          <AppText variant="micro" color={colors.textMuted}>DỊP</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {OCCASIONS.map((o) => <Chip key={o.code} label={o.label} selected={form.occasion === o.code} onPress={() => setForm((f) => applyOccasion(f, o.code, new Date()))} />)}
          </View>
          <AppText variant="micro" color={colors.textMuted}>QUÀ CHO AI?</AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Quà cho mình" selected={form.subject === 'me'} onPress={() => set({ subject: 'me' })} />
            <Chip label={`Quà cho ${partner?.displayName ?? 'người ấy'}`} selected={form.subject === 'partner'} onPress={() => set({ subject: 'partner' })} />
          </View>
        </>
      ) : null}

      <Card style={{ paddingVertical: 4, gap: 0 }}>
        <ListRow testID="row-date" icon="calendar" iconBg={colors.lavender} iconColor={colors.lavenderInk} title="Ngày" subtitle={dateLabel} onPress={() => setSheet('date')} />
        {partner ? (
          <ListRow icon="pin" iconBg={colors.mint} iconColor={colors.mintInk} title="Địa điểm"
            subtitle={form.place?.name ?? existing.data?.place?.name ?? 'Chưa có'} onPress={() => setSheet('place')} />
        ) : null}
        <ListRow icon="repeat" iconBg={colors.peachSoft} iconColor={colors.peachInk} title="Lặp lại" subtitle={repeatSubtitle}
          onPress={options.length ? () => setSheet('repeat') : undefined} />
        <ListRow icon="bell" iconBg={colors.roseSoft} iconColor={colors.rose} title="Nhắc nhở"
          subtitle={mode === 'edit' ? 'Chạm để tuỳ chỉnh' : 'Tuỳ chỉnh sau khi lưu'}
          onPress={mode === 'edit' ? () => router.push(`/moments/${params.id}/reminders`) : undefined} />
      </Card>

      <TextField label="Lời nhắn" value={form.message} onChangeText={(message) => set({ message })} multiline placeholder="Viết vài dòng cho ngày này…" />
      <ErrorText message={error} />
      {mode === 'edit' ? <Button title="Xoá kỷ niệm" variant="danger" icon="trash" onPress={confirmDelete} /> : null}

      <DatePickerSheet visible={sheet === 'date'} title={form.type === 'DATE_PLAN' ? 'Ngày & giờ hẹn' : 'Ngày diễn ra'}
        mode={form.type === 'DATE_PLAN' ? 'datetime' : 'date'} value={form.date} time={form.time}
        maxDate={form.type === 'ANNIVERSARY' ? toIsoDate(new Date()) : undefined}
        onClose={() => setSheet(null)} onConfirm={(date, time) => { set({ date, time: form.type === 'DATE_PLAN' ? time : form.time }); setSheet(null); }} />
      <RepeatSheet visible={sheet === 'repeat'} value={form.recurrence} date={form.date} options={options}
        onChange={(recurrence, date) => set({ recurrence, date })} onClose={() => setSheet(null)} />
      <PlaceSheet visible={sheet === 'place'} value={form.place} onChange={(place) => set({ place })} onClose={() => setSheet(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  add: { width: 96, height: 130, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.rose, backgroundColor: colors.roseSoft, alignItems: 'center', justifyContent: 'center', gap: 6 },
});

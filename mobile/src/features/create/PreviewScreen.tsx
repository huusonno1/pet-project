import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCouple } from '@/features/couple/api';
import { uploadImage } from '@/features/media/upload';
import { useSendNote } from '@/features/notes/api';
import { errorMessage } from '@/lib/api/client';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { ErrorText } from '@/ui/ErrorText';
import { Icon, IconName } from '@/ui/Icon';
import { colors, fonts } from '@/ui/theme';
import { TopBar } from '@/ui/TopBar';

import { captureStore, useCapture } from './capture-store';
import { ClassifySheet } from './ClassifySheet';
import { EffectPreview } from './EffectPreview';
import { EFFECTS } from './effects';
import { renderComposition } from './render-effects';

export default function PreviewScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const capture = useCapture();
  const couple = useCouple();
  const sendNote = useSendNote();
  const [captionOpen, setCaptionOpen] = useState(capture.caption.length > 0);
  const [effectsOpen, setEffectsOpen] = useState(false);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uri = capture.uris[0];
  const partner = couple.data?.partner;

  const tools: { label: string; icon: IconName; on: boolean; press: () => void }[] = [
    { label: 'Thêm chữ', icon: 'type', on: captionOpen, press: () => setCaptionOpen(!captionOpen) },
    { label: 'Tim bay', icon: 'heartFilled', on: capture.hearts, press: () => captureStore.set({ hearts: !capture.hearts }) },
    { label: 'Tem ngày', icon: 'stamp', on: capture.stamp, press: () => captureStore.set({ stamp: !capture.stamp }) },
    { label: 'Hiệu ứng', icon: 'sparkles', on: effectsOpen, press: () => setEffectsOpen(!effectsOpen) },
  ];

  async function quickSend() {
    if (!uri) return;
    setSending(true);
    setError(null);
    try {
      const rendered = await renderComposition(uri, capture);
      const media = await uploadImage(rendered, { purpose: 'SHARED', filter: capture.effect });
      await sendNote.mutateAsync({ kind: 'DRAWING', drawingMediaId: media.id, text: capture.caption.trim() || undefined });
      captureStore.reset();
      router.replace('/notes');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 8, paddingHorizontal: 16, gap: 14 }}>
      <TopBar backIcon="close" title={partner ? `Chia sẻ với ${partner.displayName}` : 'Xem trước'} />
      {uri ? <View style={{ alignSelf: 'center' }}><EffectPreview uri={uri} composition={capture} size={width - 32} /></View> : null}
      {capture.uris.length > 1 ? <AppText variant="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>+{capture.uris.length - 1} ảnh nữa · hiệu ứng áp cho tất cả</AppText> : null}

      <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8 }}>
        {tools.map((t) => (
          <Pressable key={t.label} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: t.on }} onPress={t.press}
            style={[styles.tool, t.on ? styles.toolOn : styles.toolOff]}>
            <Icon name={t.icon} size={15} color={t.on ? colors.white : colors.text} />
            <AppText variant="captionStrong" color={t.on ? colors.white : colors.text}>{t.label}</AppText>
          </Pressable>
        ))}
      </View>
      {captionOpen ? (
        <TextInput accessibilityLabel="Chữ trên ảnh" placeholder="Viết gì đó lên ảnh…" placeholderTextColor={colors.textMuted} maxLength={40}
          value={capture.caption} onChangeText={(t) => captureStore.set({ caption: t })} style={styles.caption} />
      ) : null}
      {effectsOpen ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {EFFECTS.map((e) => (
            <Pressable key={e.id} accessibilityRole="radio" accessibilityLabel={e.label} accessibilityState={{ checked: capture.effect === e.id }}
              onPress={() => captureStore.set({ effect: e.id })} style={[styles.tool, capture.effect === e.id ? styles.toolOn : styles.toolOff]}>
              <AppText variant="captionStrong" color={capture.effect === e.id ? colors.white : colors.text}>{e.label}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 8 }}>
        <Button title="Chụp lại" variant="secondary" style={{ flex: 1 }} onPress={() => router.back()} />
        <Button title="Tiếp tục" style={{ flex: 1 }} onPress={() => setClassifyOpen(true)} />
      </View>
      {partner && uri ? (
        <Pressable accessibilityRole="button" onPress={quickSend} disabled={sending} style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, height: 44 }}>
          <Icon name="send" size={16} color={colors.textMuted} />
          <AppText variant="caption" color={colors.textMuted}>{sending ? 'Đang gửi…' : `Hoặc chỉ gửi nhanh cho ${partner.displayName} (không lưu Nhật ký)`}</AppText>
        </Pressable>
      ) : null}
      <ErrorText message={error} />
      <ClassifySheet visible={classifyOpen} onClose={() => setClassifyOpen(false)} thumbUri={uri} />
    </View>
  );
}

const styles = StyleSheet.create({
  tool: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 999 },
  toolOn: { backgroundColor: colors.roseStrong },
  toolOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  caption: { height: 46, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
});

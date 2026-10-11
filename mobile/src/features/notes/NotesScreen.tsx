import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMe } from '@/features/account/api';
import { useCouple } from '@/features/couple/api';
import { uploadImage } from '@/features/media/upload';
import { errorMessage } from '@/lib/api/client';
import type { LoveNote } from '@/lib/api/types';
import { formatTime } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ErrorText } from '@/ui/ErrorText';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { colors, fonts } from '@/ui/theme';
import { TopBar } from '@/ui/TopBar';

import { useLoveNotes, useMarkNoteSeen, useSendNote } from './api';
import { DrawPad } from './DrawPad';
import { PEN_COLORS, Stroke } from './drawing';
import { exportDrawing } from './export-drawing';

const QUICK = ['Nhớ quá', 'Ăn gì chưa?', 'Yêu nhiều'];

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const couple = useCouple();
  const notes = useLoveNotes();
  const send = useSendNote();
  const seen = useMarkNoteSeen();
  const [draft, setDraft] = useState('');
  const [drawOpen, setDrawOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const partnerName = couple.data?.partner.displayName ?? 'người ấy';
  const thread = [...(notes.data ?? [])].reverse();

  useEffect(() => {
    (notes.data ?? []).filter((n) => n.authorId !== me.data?.id && !n.seenAt && me.data).forEach((n) => seen.mutate(n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes.data, me.data?.id]);

  async function sendText(text: string) {
    const t = text.trim();
    if (!t) return;
    setError(null);
    try {
      await send.mutateAsync({ kind: 'TEXT', text: t });
      setDraft('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20 }}>
        <TopBar title={`Lời nhắn với ${partnerName}`} />
        <AppText variant="caption" color={colors.textMuted} style={{ marginLeft: 56 }}>Gửi kèm thông báo đến điện thoại {partnerName}</AppText>
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 10 }}>
        {thread.map((n) => <Bubble key={n.id} note={n} mine={n.authorId === me.data?.id} />)}
        {notes.isSuccess && thread.length === 0 ? (
          <AppText color={colors.textMuted} style={{ textAlign: 'center' }}>Chưa có lời nhắn nào. Gửi câu đầu tiên nhé!</AppText>
        ) : null}
      </ScrollView>
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {QUICK.map((q) => <Chip key={q} label={q} selected={false} onPress={() => sendText(q)} />)}
        </ScrollView>
        <ErrorText message={error} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Vẽ tay" onPress={() => setDrawOpen(true)} style={[styles.round, { backgroundColor: colors.roseSoft }]}>
            <Icon name="pen" size={18} color={colors.roseStrong} />
          </Pressable>
          <TextInput accessibilityLabel={`Nhắn cho ${partnerName}`} placeholder={`Nhắn cho ${partnerName}…`} placeholderTextColor={colors.textMuted}
            value={draft} onChangeText={setDraft} onSubmitEditing={() => sendText(draft)} style={styles.input} />
          <Pressable accessibilityRole="button" accessibilityLabel="Gửi" onPress={() => sendText(draft)} style={[styles.round, { backgroundColor: colors.roseStrong }]}>
            <Icon name="send" size={18} color={colors.white} />
          </Pressable>
        </View>
      </View>
      <DrawSheet visible={drawOpen} onClose={() => setDrawOpen(false)} partnerName={partnerName} />
    </View>
  );
}

function Bubble({ note, mine }: { note: LoveNote; mine: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {note.drawing ? (
          <Image source={{ uri: note.drawing.url }} style={{ width: 200, height: 200, borderRadius: 14, backgroundColor: colors.surface }} accessibilityLabel="Hình vẽ tay" />
        ) : null}
        {note.text ? <AppText testID="note-text" color={mine ? colors.white : colors.text}>{note.text}</AppText> : null}
        <AppText variant="micro" color={mine ? colors.roseSoft : colors.textMuted} style={{ letterSpacing: 0 }}>
          {note.kind === 'DRAWING' ? 'Vẽ tay · ' : ''}{formatTime(note.createdAt)}
        </AppText>
      </View>
    </View>
  );
}

function DrawSheet({ visible, onClose, partnerName }: { visible: boolean; onClose: () => void; partnerName: string }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 48, 360);
  const send = useSendNote();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (strokes.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const uri = await exportDrawing(strokes, size);
      const media = await uploadImage(uri, { purpose: 'SHARED', filter: 'DRAWING' });
      await send.mutateAsync({ kind: 'DRAWING', drawingMediaId: media.id });
      setStrokes([]);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Vẽ tay" subtitle={`${partnerName} sẽ nhận được ngay`}
      right={<Avatar name={partnerName} tone="lavender" size={32} />}>
      <DrawPad strokes={strokes} onChange={setStrokes} color={color} size={size} />
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {PEN_COLORS.map((c) => (
          <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Màu ${c}`} accessibilityState={{ selected: c === color }}
            onPress={() => setColor(c)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, borderWidth: c === color ? 3 : 0, borderColor: colors.white }} />
        ))}
        <View style={{ flex: 1 }} />
        <Button title="Xoá" variant="secondary" compact onPress={() => setStrokes([])} style={{ paddingHorizontal: 16 }} />
      </View>
      <ErrorText message={error} />
      <Button title="Gửi hình vẽ" onPress={submit} loading={busy} disabled={strokes.length === 0} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  composer: { paddingHorizontal: 20, paddingTop: 12, gap: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  bubble: { maxWidth: 260, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  mine: { backgroundColor: colors.roseStrong, borderRadius: 20, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surface, borderRadius: 20, borderBottomLeftRadius: 6 },
});

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMe } from '@/features/account/api';
import { useCouple } from '@/features/couple/api';
import { useMoments } from '@/features/moments/api';
import { moodLabel, TYPE_LABELS } from '@/features/moments/labels';
import { weekdayName } from '@/lib/calendar';
import { formatDate, formatTime } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Avatar } from '@/ui/Avatar';
import { Icon } from '@/ui/Icon';
import { PhotoTile } from '@/ui/PhotoTile';
import { colors, shadow } from '@/ui/theme';
import { TopBar } from '@/ui/TopBar';

import { Position, step } from './group';
import { SwipeDeck } from './SwipeDeck';

export default function DayViewerScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const moments = useMoments();
  const me = useMe();
  const couple = useCouple();
  const [pos, setPos] = useState<Position>({ item: 0, photo: 0 });
  const items = (moments.data ?? []).filter((m) => m.occursOn === date && m.type !== 'CYCLE').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  // Ảnh rộng gần hết màn (chừa 16px mỗi bên), tỉ lệ 4:5.
  const cardW = width - 32;
  const cardH = Math.min(Math.round(cardW * 1.25), 480);

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 8, paddingHorizontal: 20 }}>
        <TopBar title={date ? `${weekdayName(date)}, ${formatDate(date)}` : ''} />
        <AppText color={colors.textMuted} style={{ marginTop: 24 }}>{moments.isSuccess ? 'Ngày này chưa có kỷ niệm nào.' : 'Đang tải…'}</AppText>
      </View>
    );
  }

  const m = items[Math.min(pos.item, items.length - 1)];
  const media = m.media[pos.photo];
  const prevPos = step(items, pos, -1);
  const nextPos = step(items, pos, 1);
  const prev = prevPos === pos ? null : prevPos;
  const next = nextPos === pos ? null : nextPos;

  const keyOf = (p: Position) => `${items[p.item].id}-${p.photo}`;

  function renderCard(p: Position, interactive: boolean) {
    const cm = items[p.item];
    const cmedia = cm.media[p.photo];
    const cmood = moodLabel(cm.details.mood);
    const cauthor = cm.createdBy === me.data?.id ? me.data?.displayName : couple.data?.partner.displayName ?? '';
    return (
      <View style={[{ flex: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.surface }, shadow.raised]}>
        {cmedia ? (
          <PhotoTile uri={cmedia.url} seed={cm.id} style={{ flex: 1, borderRadius: 0 }} />
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.lavender, padding: 28, justifyContent: 'center', gap: 14 }}>
            <Icon name="quote" size={34} color={colors.lavenderInk} />
            <AppText variant="h2">{cm.message || cm.title}</AppText>
          </View>
        )}
        <View style={styles.typeChip}><AppText variant="captionStrong" color={colors.roseStrong} style={{ fontSize: 12 }}>{TYPE_LABELS[cm.type]}{cmood ? ` · ${cmood}` : ''}</AppText></View>
        {cm.media.length > 1 ? <View style={styles.photoCount}><AppText variant="micro" color={colors.white} style={{ letterSpacing: 0 }}>Ảnh {p.photo + 1}/{cm.media.length}</AppText></View> : null}
        <View style={styles.who}>
          <Avatar name={cauthor || '?'} tone={cm.createdBy === me.data?.id ? 'rose' : 'lavender'} size={26} />
          <AppText variant="captionStrong">{cauthor} · {formatTime(cm.occursAt ?? cm.createdAt)}</AppText>
        </View>
        {interactive ? (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="Ảnh hoặc kỷ niệm trước" onPress={() => setPos(step(items, pos, -1))} style={[StyleSheet.absoluteFill, { right: '60%' }]} />
            <Pressable accessibilityRole="button" accessibilityLabel="Ảnh hoặc kỷ niệm tiếp theo" onPress={() => setPos(step(items, pos, 1))} style={[StyleSheet.absoluteFill, { left: '40%' }]} />
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <TopBar title={`${weekdayName(date!)}, ${formatDate(date!)}`}
          right={<View style={styles.counter}><AppText variant="captionStrong" color={colors.roseStrong}>{pos.item + 1} / {items.length}</AppText></View>} />
        <AppText variant="caption" color={colors.textMuted} style={{ marginLeft: 56 }}>{items.length} kỷ niệm trong ngày</AppText>
      </View>
      <View style={styles.progress}>
        {items.map((it, i) => <View key={it.id} style={[styles.seg, { backgroundColor: i <= pos.item ? colors.rose : colors.line }]} />)}
      </View>

      <View style={{ marginTop: 10, alignItems: 'center' }}>
        <SwipeDeck width={cardW} height={cardH}
          card={{ key: keyOf(pos), node: renderCard(pos, true) }}
          prevCard={prev ? { key: keyOf(prev), node: renderCard(prev, false) } : null}
          nextCard={next ? { key: keyOf(next), node: renderCard(next, false) } : null}
          onPrev={() => setPos(step(items, pos, -1))} onNext={() => setPos(step(items, pos, 1))} />
      </View>

      <View style={{ paddingHorizontal: 24, gap: 6, marginTop: 14 }}>
        {media && m.message ? <AppText variant="bodyStrong">{m.message}</AppText> : media ? <AppText variant="bodyStrong">{m.title}</AppText> : null}
        {m.place ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="pin" size={14} color={colors.textMuted} />
            <AppText variant="caption" color={colors.textMuted}>{m.place.name}</AppText>
          </View>
        ) : null}
        {m.type !== 'MOMENT' ? (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/moments/${m.id}`)}>
            <AppText variant="captionStrong" color={colors.roseStrong}>Xem chi tiết & nhắc nhở</AppText>
          </Pressable>
        ) : null}
      </View>

      <AppText variant="micro" color={colors.textMuted} style={{ marginHorizontal: 24, marginTop: 16 }}>TRONG NGÀY NÀY</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 10, paddingVertical: 8 }}>
        {items.map((it, i) => (
          <Pressable key={it.id} accessibilityRole="button" accessibilityLabel={`Mở kỷ niệm ${i + 1}: ${it.title}`} accessibilityState={{ selected: i === pos.item }}
            onPress={() => setPos({ item: i, photo: 0 })} style={{ alignItems: 'center', gap: 6 }}>
            {it.media[0] ? (
              <PhotoTile uri={it.media[0].url} seed={it.id} style={[styles.thumb, i === pos.item ? styles.thumbOn : { opacity: 0.7 }]} />
            ) : (
              <View style={[styles.thumb, { backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' }, i === pos.item ? styles.thumbOn : { opacity: 0.7 }]}>
                <Icon name="quote" size={20} color={colors.lavenderInk} />
              </View>
            )}
            <AppText variant="micro" color={i === pos.item ? colors.roseStrong : colors.textMuted} style={{ letterSpacing: 0 }}>{TYPE_LABELS[it.type]}</AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  counter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.roseSoft },
  progress: { flexDirection: 'row', gap: 4, paddingHorizontal: 24, marginTop: 10 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  typeChip: { position: 'absolute', left: 14, top: 14, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)' },
  photoCount: { position: 'absolute', right: 14, top: 16, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(43,26,46,0.55)' },
  who: { position: 'absolute', left: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingLeft: 5, paddingRight: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)' },
  thumb: { width: 58, height: 58, borderRadius: 16 },
  thumbOn: { borderWidth: 3, borderColor: colors.rose },
});

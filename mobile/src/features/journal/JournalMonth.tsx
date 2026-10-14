import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { captureStore } from '@/features/create/capture-store';
import type { Moment } from '@/lib/api/types';
import { monthGrid, monthLabel, shiftMonth, WEEKDAYS } from '@/lib/calendar';
import { toIsoDate } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { PhotoTile } from '@/ui/PhotoTile';
import { colors } from '@/ui/theme';

import { countByDay, dayLabel, journalMoments } from './group';

export function JournalMonth({ moments, initial }: { moments: Moment[]; initial?: string }) {
  const todayIso = toIsoDate(new Date());
  const start = initial && /^\d{4}-\d{2}$/.test(initial) ? initial : todayIso.slice(0, 7);
  const [view, setView] = useState({ year: Number(start.slice(0, 4)), month: Number(start.slice(5, 7)) });
  const [selected, setSelected] = useState<string>(todayIso);
  const list = journalMoments(moments, todayIso);
  const counts = countByDay(list);
  const birthdays = new Set(moments.filter((m) => m.type === 'GIFT_OCCASION').map((m) => m.occursOn.slice(5)));
  const dayMoments = list.filter((m) => m.occursOn === selected);

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Tháng trước" style={styles.arrow} onPress={() => setView(shiftMonth(view.year, view.month, -1))}><Icon name="back" size={18} /></Pressable>
        <AppText variant="h2">{monthLabel(view.year, view.month)}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Tháng sau" style={styles.arrow} onPress={() => setView(shiftMonth(view.year, view.month, 1))}><Icon name="chevronRight" size={18} /></Pressable>
      </View>
      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, gap: 0 }}>
        {WEEKDAYS.map((w) => <AppText key={w} variant="micro" color={w === 'CN' ? colors.roseStrong : colors.textMuted} style={styles.cellW}>{w}</AppText>)}
        {monthGrid(view.year, view.month).map((c, i) => {
          if (!c.iso) return <View key={`e${i}`} style={styles.cell} />;
          const n = counts[c.iso] ?? 0;
          const gift = birthdays.has(c.iso.slice(5));
          const on = c.iso === selected;
          const cover = list.find((m) => m.occursOn === c.iso && m.media[0])?.media[0];
          return (
            <View key={c.iso} style={styles.cell}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Ngày ${c.day}${n ? `, ${n} kỷ niệm` : ''}`} accessibilityState={{ selected: on }}
                onPress={() => {
                  setSelected(c.iso!);
                  // Ngày đã có kỷ niệm → mở thẳng màn xem trong ngày.
                  if (n > 0) router.push(`/journal/${c.iso}`);
                }}
                style={{ alignItems: 'center', gap: 3 }}>
                {/* Mọi ô cùng cấu trúc: số luôn ở hàng trên (thẳng hàng), bên dưới là ảnh tròn / chấm / trống.
                    Viền luôn có, chỉ đổi màu: Android gỡ viền khỏi view bo góc thì nội dung có thể biến mất. */}
                <View style={[styles.num, gift && { backgroundColor: colors.peachSoft }, on && { backgroundColor: colors.roseStrong },
                  { borderColor: c.iso === todayIso && !on ? colors.roseStrong : 'transparent', borderStyle: c.iso === todayIso && !on ? 'dashed' : 'solid' }]}>
                  <AppText variant={n ? 'bodyStrong' : 'body'} style={{ fontSize: 14, lineHeight: 18 }}
                    color={on ? colors.white : c.weekday === 6 ? colors.roseStrong : colors.text}>{c.day}</AppText>
                </View>
                <View style={styles.mark}>
                  {cover ? (
                    <PhotoTile uri={cover.url} seed={c.iso} style={styles.thumb} />
                  ) : n > 0 ? (
                    <View style={styles.dot} />
                  ) : null}
                  {cover && n > 1 ? <View style={styles.badge}><AppText variant="micro" color={colors.white} style={{ letterSpacing: 0, fontSize: 9, lineHeight: 11 }}>{n}</AppText></View> : null}
                </View>
              </Pressable>
            </View>
          );
        })}
      </Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="h3">{dayLabel(selected)}</AppText>
        <Pressable accessibilityRole="button" onPress={() => { captureStore.reset({ date: selected }); router.push('/create'); }}>
          <AppText variant="captionStrong" color={colors.roseStrong}>+ Thêm vào ngày này</AppText>
        </Pressable>
      </View>
      {dayMoments.length === 0 ? (
        <AppText variant="caption" color={colors.textMuted} style={styles.empty}>Chưa có kỷ niệm nào ngày này</AppText>
      ) : dayMoments.map((m) => (
        <Pressable key={m.id} accessibilityRole="button" onPress={() => router.push(`/journal/${selected}`)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <PhotoTile uri={m.media[0]?.url} seed={m.id} style={{ width: 52, height: 52, borderRadius: 14 }} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{m.title}</AppText>
              <AppText variant="caption" color={colors.textMuted}>{m.media.length} ảnh</AppText>
            </View>
            <Icon name="chevronRight" size={18} color={colors.textMuted} />
          </Card>
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  arrow: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  cellW: { width: `${100 / 7}%`, textAlign: 'center', paddingBottom: 6 },
  cell: { width: `${100 / 7}%`, height: 66, alignItems: 'center', justifyContent: 'center' },
  num: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 28, height: 28, borderRadius: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.rose },
  badge: { position: 'absolute', right: -4, top: -3, minWidth: 14, height: 14, borderRadius: 7, paddingHorizontal: 3, backgroundColor: colors.roseStrong, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 16, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, textAlign: 'center' },
});

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
import { colors, gradientFor } from '@/ui/theme';

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
                onPress={() => setSelected(c.iso!)}
                style={[styles.day, gift && { backgroundColor: colors.peachSoft }, n > 0 && !cover && { backgroundColor: gradientFor(c.iso)[0] },
                  on && { borderWidth: 2.5, borderColor: colors.roseStrong }, c.iso === todayIso && !on && { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.roseStrong }]}>
                {cover ? <PhotoTile uri={cover.url} seed={c.iso} style={StyleSheet.absoluteFill} /> : null}
                <AppText variant={n ? 'bodyStrong' : 'body'} color={c.weekday === 6 && !n ? colors.roseStrong : colors.text}>{c.day}</AppText>
                {n > 1 ? <AppText variant="micro" style={{ letterSpacing: 0 }}>{'•'.repeat(Math.min(n, 3))}</AppText> : null}
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
  cell: { width: `${100 / 7}%`, height: 50, alignItems: 'center', justifyContent: 'center' },
  day: { width: 40, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  empty: { padding: 16, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, textAlign: 'center' },
});

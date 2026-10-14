import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Moment } from '@/lib/api/types';
import { monthGrid } from '@/lib/calendar';
import { pad, toIsoDate } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Icon } from '@/ui/Icon';
import { colors, shadow } from '@/ui/theme';

import { countByDay, journalMoments } from './group';

export function JournalYear({ moments }: { moments: Moment[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const list = journalMoments(moments, toIsoDate(today));
  const counts = countByDay(list);
  const yearTotal = list.filter((m) => m.occursOn.startsWith(String(year))).length;
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Năm trước" style={styles.arrow} onPress={() => setYear(year - 1)}><Icon name="back" size={18} /></Pressable>
        <View style={{ alignItems: 'center' }}>
          <AppText variant="h2">{year}</AppText>
          <AppText variant="caption" color={colors.textMuted}>{yearTotal} kỷ niệm</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Năm sau" style={styles.arrow} onPress={() => setYear(year + 1)}><Icon name="chevronRight" size={18} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
          const key = `${year}-${pad(month)}`;
          const n = list.filter((m) => m.occursOn.startsWith(key)).length;
          const current = year === today.getFullYear() && month === today.getMonth() + 1;
          return (
            <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Tháng ${month}, ${n} kỷ niệm`}
              onPress={() => router.setParams({ view: 'month', ym: key })}
              style={[styles.card, current && { borderColor: colors.rose }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText variant="bodyStrong" color={current ? colors.roseStrong : colors.text}>Th {month}</AppText>
                <AppText variant="micro" color={colors.textMuted}>{n}</AppText>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                {monthGrid(year, month).map((c, i) => (
                  <View key={i} style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: !c.iso ? 'transparent' : counts[c.iso] ? (counts[c.iso] > 1 ? colors.rose : colors.roseBorder) : colors.line }} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  arrow: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  card: { width: '31%', padding: 10, gap: 6, borderRadius: 20, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface, ...shadow.card },
});

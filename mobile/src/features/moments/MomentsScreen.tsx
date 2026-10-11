import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Moment } from '@/lib/api/types';
import { daysBetween, formatDate, parseIsoDate, toIsoDate } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { useMoments } from './api';
import { daysLeftLabel, TYPE_LABELS } from './labels';
import { nextOccurrence } from './occurrence';

export default function MomentsScreen() {
  const moments = useMoments();
  const today = new Date();
  const todayIso = toIsoDate(today);
  const visible = (moments.data ?? []).filter((m) => m.type !== 'CYCLE');
  const upcoming = visible
    .map((m) => ({ m, date: nextOccurrence(m, today) }))
    .filter((x): x is { m: Moment; date: string } => x.date !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcomingIds = new Set(upcoming.map((x) => x.m.id));
  const past = visible.filter((m) => !upcomingIds.has(m.id)).sort((a, b) => b.occursOn.localeCompare(a.occursOn));

  return (
    <Screen>
      <Button title="+ Thêm kỷ niệm" onPress={() => router.push('/create')} />
      <Title>Sắp tới</Title>
      {upcoming.length === 0 && <Text style={styles.muted}>Chưa có gì sắp tới.</Text>}
      {upcoming.map(({ m, date }) => (
        <Row key={m.id} moment={m} date={date} badge={daysLeftLabel(daysBetween(todayIso, parseIsoDate(date)))} />
      ))}
      <Title>Đã qua</Title>
      {past.length === 0 && <Text style={styles.muted}>Chưa có kỷ niệm nào.</Text>}
      {past.map((m) => (
        <Row key={m.id} moment={m} date={m.occursOn} />
      ))}
    </Screen>
  );
}

function Row({ moment, date, badge }: { moment: Moment; date: string; badge?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/moments/${moment.id}`)}>
      <Card style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{moment.title}</Text>
          <Text style={styles.muted}>
            {TYPE_LABELS[moment.type]} · {formatDate(date)}
          </Text>
        </View>
        {badge && <Text style={styles.badge}>{badge}</Text>}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  muted: { color: colors.muted, marginBottom: spacing.sm },
  badge: { color: colors.primary, fontWeight: '700' },
});

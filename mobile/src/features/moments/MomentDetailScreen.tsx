import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text } from 'react-native';

import { errorMessage } from '@/lib/api/client';
import { daysBetween, formatDate, formatDateTime, formatTime, parseIsoDate, toIsoDate } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { colors, radius, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { useDeleteMoment, useMoment, useMomentReminders } from './api';
import { daysLeftLabel, TYPE_LABELS } from './labels';
import { nextOccurrence } from './occurrence';

export default function MomentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const moment = useMoment(id);
  const reminders = useMomentReminders(id);
  const remove = useDeleteMoment();

  if (moment.isError) return <Screen><ErrorText message={errorMessage(moment.error)} /></Screen>;
  if (!moment.data) return <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;

  const m = moment.data;
  const today = new Date();
  const next = nextOccurrence(m, today);

  function confirmDelete() {
    Alert.alert('Xoá kỷ niệm?', 'Ảnh và nhắc nhở của kỷ niệm này cũng bị xoá.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          await remove.mutateAsync(m.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Title>{m.title}</Title>
      <Text style={styles.meta}>
        {TYPE_LABELS[m.type]} · {formatDate(m.occursOn)}
        {m.occursAt ? ` · ${formatTime(m.occursAt)}` : ''}
      </Text>
      {next && <Text style={styles.badge}>{daysLeftLabel(daysBetween(toIsoDate(today), parseIsoDate(next)))}</Text>}
      {m.message ? <Text style={styles.message}>{m.message}</Text> : null}
      {m.place && <Text style={styles.meta}>📍 {m.place.name}</Text>}

      {m.media.length > 0 && (
        <ScrollView horizontal style={{ marginVertical: spacing.md }}>
          {m.media.map((p) => (
            <Image key={p.id} source={{ uri: p.url }} style={styles.photo} contentFit="cover" />
          ))}
        </ScrollView>
      )}

      <Card>
        <Text style={styles.heading}>Nhắc nhở sắp tới của bạn</Text>
        {(reminders.data ?? []).slice(0, 3).map((r) => (
          <Text key={r.id} style={styles.reminder}>
            <Text style={styles.reminderTime}>{formatDateTime(r.fireAt)}</Text>
            {'\n'}
            {r.body}
          </Text>
        ))}
        {reminders.data?.length === 0 && <Text style={styles.meta}>Không có nhắc nhở nào cho bạn.</Text>}
        <Button title="Tuỳ chỉnh nhắc nhở" variant="secondary" onPress={() => router.push(`/moments/${m.id}/reminders`)} />
      </Card>

      {m.type !== 'CYCLE' && (
        <>
          <Button title="Sửa kỷ niệm" variant="secondary" onPress={() => router.push(`/moments/${m.id}/edit`)} />
          <Button title="Xoá kỷ niệm" variant="danger" onPress={confirmDelete} loading={remove.isPending} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, marginBottom: spacing.xs },
  badge: { color: colors.primary, fontWeight: '700', marginBottom: spacing.sm },
  message: { color: colors.text, fontSize: 16, marginVertical: spacing.sm },
  photo: { width: 220, height: 220, borderRadius: radius.md, marginRight: spacing.sm, backgroundColor: colors.border },
  heading: { fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  reminder: { color: colors.text, marginBottom: spacing.sm },
  reminderTime: { color: colors.muted, fontSize: 12 },
});

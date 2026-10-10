import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';

import { useMe } from '@/features/account/api';
import { useMoment, useMomentReminders, useSetReminderConfig } from '@/features/moments/api';
import { errorMessage } from '@/lib/api/client';
import type { ReminderConfig } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { DateField } from '@/ui/DateField';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { colors, spacing } from '@/ui/theme';

import { Choice, fromAudience, ownerOf, toAudience } from './audience';
import { OFFSET_PRESETS, offsetLabel, parseMilestones, toggleOffset } from './offsets';

const CHOICES: { value: Choice; label: string }[] = [
  { value: 'me', label: 'Mình' },
  { value: 'partner', label: 'Người ấy' },
  { value: 'both', label: 'Cả hai' },
];

export default function ReminderConfigScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const moment = useMoment(id);
  const me = useMe();
  const reminders = useMomentReminders(id);
  const save = useSetReminderConfig(id);

  const [choice, setChoice] = useState<Choice>('both');
  const [offsets, setOffsets] = useState<string[]>([]);
  const [sendAt, setSendAt] = useState('08:00');
  const [yearly, setYearly] = useState(true);
  const [milestones, setMilestones] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!moment.data || !me.data || ready) return;
    const cfg = moment.data.effectiveReminderConfig;
    setChoice(fromAudience(cfg.recipients ?? 'BOTH', me.data.id, ownerOf(moment.data)));
    setOffsets(cfg.offsets ?? []);
    setSendAt(cfg.sendAt ?? '08:00');
    setYearly(cfg.yearly ?? true);
    setMilestones(cfg.milestoneDays ? cfg.milestoneDays.join(', ') : '');
    setReady(true);
  }, [moment.data, me.data, ready]);

  if (!moment.data || !me.data || !ready) return <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;

  const m = moment.data;
  const isAnniversary = m.type === 'ANNIVERSARY';
  const lockedCycle = m.type === 'CYCLE' && m.subjectUserId !== me.data.id;
  const presets = [...new Set([...OFFSET_PRESETS, ...offsets])];

  async function onSave() {
    const parsed = milestones.trim() ? parseMilestones(milestones) : { days: [], error: null };
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    const config: ReminderConfig = {
      recipients: toAudience(choice, me.data!.id, ownerOf(m)),
      offsets,
      sendAt,
      yearly: isAnniversary ? yearly : null,
      milestoneDays: isAnniversary && milestones.trim() ? parsed.days : null,
    };
    try {
      await save.mutateAsync(config);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onReset() {
    try {
      await save.mutateAsync(null);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>{m.title}</Text>
      {lockedCycle ? (
        <Text style={styles.muted}>Chỉ người có chu kỳ được chỉnh nhắc nhở này.</Text>
      ) : (
        <>
          <Text style={styles.label}>Nhắc cho</Text>
          <View style={styles.chips}>
            {CHOICES.map((c) => (
              <Chip key={c.value} label={c.label} selected={choice === c.value} onPress={() => setChoice(c.value)} />
            ))}
          </View>

          <Text style={styles.label}>Nhắc trước (tối đa 5)</Text>
          <View style={styles.chips}>
            {presets.map((iso) => (
              <Chip
                key={iso}
                label={offsetLabel(iso)}
                selected={offsets.includes(iso)}
                onPress={() => {
                  const next = toggleOffset(offsets, iso);
                  setOffsets(next.list);
                  setError(next.error);
                }}
              />
            ))}
          </View>

          <DateField label="Giờ gửi (với nhắc theo ngày)" mode="time" value={sendAt} onChange={setSendAt} />

          {isAnniversary && (
            <>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Nhắc mỗi năm tròn</Text>
                <Switch accessibilityLabel="Nhắc mỗi năm tròn" value={yearly} onValueChange={setYearly} trackColor={{ true: colors.primary }} />
              </View>
              <TextField
                label="Mốc ngày (cách nhau bởi dấu phẩy)"
                value={milestones}
                onChangeText={setMilestones}
                placeholder="Mặc định: 100, 200, 300, 500, 1000, mỗi 500 ngày"
                keyboardType="numbers-and-punctuation"
              />
            </>
          )}

          <ErrorText message={error} />
          <Button title="Lưu" onPress={onSave} loading={save.isPending} />
          <Button title="Khôi phục mặc định" variant="secondary" onPress={onReset} />
        </>
      )}

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.label}>Nhắc nhở sắp tới của bạn</Text>
        {(reminders.data ?? []).map((r) => (
          <Text key={r.id} style={styles.muted}>
            {formatDateTime(r.fireAt)} — {r.body}
          </Text>
        ))}
        {reminders.data?.length === 0 && <Text style={styles.muted}>Không có.</Text>}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: '500', marginBottom: spacing.xs },
  muted: { color: colors.muted, marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
});

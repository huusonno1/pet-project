import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useSettings, useUpdateSettings } from '@/features/account/api';
import { useCouple } from '@/features/couple/api';
import { daysLeftLabel } from '@/features/moments/labels';
import { errorMessage } from '@/lib/api/client';
import type { Prediction } from '@/lib/api/types';
import { daysBetween, formatDate, parseIsoDate, toIsoDate } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DateField } from '@/ui/DateField';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { useAddCycleLog, useCycleLogs, useDeleteCycleLog, usePrediction, useSetDefaultLength } from './api';

export default function CycleScreen() {
  const couple = useCouple();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const logs = useCycleLogs();
  const mine = usePrediction();
  const partnerId = couple.data?.partner.id;
  const partner = usePrediction(partnerId, !!partnerId);
  const add = useAddCycleLog();
  const remove = useDeleteCycleLog();
  const setLength = useSetDefaultLength();
  const [start, setStart] = useState(toIsoDate(new Date()));
  const [error, setError] = useState<string | null>(null);

  const defaultLength = settings.data?.cycleLengthDefault ?? 28;
  const needsDefault = !mine.data || mine.data.basedOnCycles === 0;

  async function logStart() {
    setError(null);
    try {
      await add.mutateAsync({ periodStart: start });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function confirmDelete(id: string, date: string) {
    Alert.alert('Xoá kỳ này?', formatDate(date), [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => remove.mutate(id) },
    ]);
  }

  return (
    <Screen>
      <Card>
        <Title>Chu kỳ của tôi</Title>
        <PredictionText prediction={mine.data} emptyText="Chưa có dữ liệu. Ghi ngày bắt đầu kỳ gần nhất nhé." />
        <DateField label="Ngày bắt đầu kỳ" value={start} onChange={setStart} />
        <Button title="Ghi lại" onPress={logStart} loading={add.isPending} />
        <ErrorText message={error} />

        {needsDefault && (
          <View style={styles.stepper}>
            <Text style={styles.text}>Độ dài chu kỳ mặc định: {defaultLength} ngày</Text>
            <View style={styles.row}>
              <StepButton
                label="Giảm độ dài chu kỳ"
                text="−"
                onPress={() => defaultLength > 20 && setLength.mutate(defaultLength - 1)}
              />
              <StepButton
                label="Tăng độ dài chu kỳ"
                text="+"
                onPress={() => defaultLength < 45 && setLength.mutate(defaultLength + 1)}
              />
            </View>
          </View>
        )}

        <View style={styles.switchRow}>
          <Text style={styles.text}>Chia sẻ với người ấy</Text>
          <Switch
            accessibilityLabel="Chia sẻ với người ấy"
            value={settings.data?.shareCycle ?? true}
            onValueChange={(shareCycle) => updateSettings.mutate({ shareCycle })}
            trackColor={{ true: colors.primary }}
          />
        </View>

        <Text style={styles.label}>Các kỳ đã ghi</Text>
        {(logs.data ?? []).map((log) => (
          <View key={log.id} style={styles.logRow}>
            <Text style={styles.text}>{formatDate(log.periodStart)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Xoá kỳ ${formatDate(log.periodStart)}`}
              onPress={() => confirmDelete(log.id, log.periodStart)}>
              <Text style={styles.delete}>Xoá</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      {couple.data && (
        <Card>
          <Title>Chu kỳ của {couple.data.partner.displayName}</Title>
          <PredictionText prediction={partner.data} emptyText="Người ấy chưa chia sẻ hoặc chưa có dữ liệu." />
        </Card>
      )}
    </Screen>
  );
}

function PredictionText({ prediction, emptyText }: { prediction: Prediction | null | undefined; emptyText: string }) {
  if (!prediction) return <Text style={styles.muted}>{emptyText}</Text>;
  const days = daysBetween(toIsoDate(new Date()), parseIsoDate(prediction.nextStart));
  return (
    <>
      <Text style={styles.text}>Kỳ tiếp theo dự kiến: {formatDate(prediction.nextStart)}</Text>
      <Text style={styles.badge}>{daysLeftLabel(days)}</Text>
      <Text style={styles.muted}>Chu kỳ trung bình {prediction.averageLength} ngày</Text>
    </>
  );
}

function StepButton({ label, text, onPress }: { label: string; text: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.step}>
      <Text style={styles.stepText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text },
  label: { color: colors.text, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.xs },
  muted: { color: colors.muted, marginBottom: spacing.sm },
  badge: { color: colors.primary, fontWeight: '700', marginVertical: spacing.xs },
  stepper: { marginVertical: spacing.sm },
  row: { flexDirection: 'row', marginTop: spacing.xs },
  step: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  stepText: { color: colors.primary, fontSize: 22, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: spacing.sm },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  delete: { color: colors.danger },
});

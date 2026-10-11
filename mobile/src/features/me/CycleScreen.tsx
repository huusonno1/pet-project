import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { useMe, useSettings, useUpdateSettings } from '@/features/account/api';
import { useCouple } from '@/features/couple/api';
import { useAddCycleLog, useCycleLogs, useDeleteCycleLog, usePrediction, useSetDefaultLength } from '@/features/cycle/api';
import { errorMessage } from '@/lib/api/client';
import { daysBetween, formatDate, toIsoDate } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DatePickerSheet } from '@/ui/DatePickerSheet';
import { ErrorText } from '@/ui/ErrorText';
import { Icon } from '@/ui/Icon';
import { IconCircle } from '@/ui/IconCircle';
import { ProgressRing } from '@/ui/ProgressRing';
import { Screen } from '@/ui/Screen';
import { colors } from '@/ui/theme';
import { Toggle } from '@/ui/Toggle';
import { TopBar } from '@/ui/TopBar';

export default function CycleScreen() {
  const me = useMe();
  const couple = useCouple();
  const settings = useSettings();
  const update = useUpdateSettings();
  const tracking = settings.data?.cycleTracking ?? false;
  const logs = useCycleLogs();
  const prediction = usePrediction(undefined, tracking);
  const add = useAddCycleLog();
  const del = useDeleteCycleLog();
  const length = useSetDefaultLength();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const partnerName = couple.data?.partner.displayName;
  const p = prediction.data;
  const daysLeft = p ? Math.max(0, -daysBetween(p.nextStart, new Date())) : null;
  const cycleLen = p?.averageLength ?? settings.data?.cycleLengthDefault ?? 28;

  async function log(date: string) {
    setPickerOpen(false);
    setError(null);
    try {
      await add.mutateAsync({ periodStart: date });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen bottomPad={40}>
      <TopBar title="Theo dõi chu kỳ" />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconCircle name="droplet" bg={colors.roseSoft} color={colors.cycle} size={40} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">Bật theo dõi chu kỳ</AppText>
          <AppText variant="caption" color={colors.textMuted}>Mặc định tắt. Chỉ dành cho ai cần.</AppText>
        </View>
        <Toggle label="Bật theo dõi chu kỳ" value={tracking} onValueChange={(v) => update.mutate({ cycleTracking: v })} />
      </Card>

      {!tracking ? (
        <AppText color={colors.textMuted} style={{ padding: 20, borderRadius: 24, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, textAlign: 'center' }}>
          Tính năng đang tắt. {partnerName ? `${partnerName} không thấy gì về chu kỳ của bạn.` : 'Không có nhắc nhở chu kỳ nào.'}
        </AppText>
      ) : (
        <>
          <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 20 }}>
            {p ? (
              <>
                <ProgressRing progress={1 - (daysLeft ?? 0) / cycleLen} label={String(daysLeft)} sub="ngày nữa" />
                <AppText variant="caption" color={colors.textMuted}>Dự kiến bắt đầu {formatDate(p.nextStart).slice(0, 5)} · chu kỳ {cycleLen} ngày</AppText>
              </>
            ) : (
              <AppText color={colors.textMuted}>Ghi ngày bắt đầu kỳ gần nhất để app dự đoán kỳ tới.</AppText>
            )}
          </Card>
          <Button title="Ghi nhận ngày bắt đầu" onPress={() => setPickerOpen(true)} loading={add.isPending} />
          <ErrorText message={error} />

          {partnerName ? (
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconCircle name="heart" bg={colors.roseSoft} color={colors.rose} size={36} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">Chia sẻ với {partnerName}</AppText>
                  <AppText variant="caption" color={colors.textMuted}>{partnerName} sẽ thấy thẻ nhắc ở tab “Người ấy” và được nhắc trước 2 ngày</AppText>
                </View>
                <Toggle label={`Chia sẻ với ${partnerName}`} value={settings.data?.shareCycle ?? true} onValueChange={(v) => update.mutate({ shareCycle: v })} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.surfaceMuted }}>
                <Icon name="eye" size={14} color={colors.textMuted} />
                <AppText variant="caption" color={colors.textMuted} style={{ flex: 1 }}>
                  {settings.data?.shareCycle && daysLeft !== null
                    ? `${partnerName} thấy: “Khoảng ${daysLeft} ngày nữa là tới ngày của ${me.data?.displayName}”`
                    : 'Đang không chia sẻ — chỉ mình bạn thấy'}
                </AppText>
              </View>
            </Card>
          ) : null}

          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">Độ dài chu kỳ mặc định</AppText>
              <AppText variant="caption" color={colors.textMuted}>Dùng khi chưa đủ 2 kỳ để tính trung bình</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Giảm độ dài chu kỳ" onPress={() => length.mutate(Math.max(20, (settings.data?.cycleLengthDefault ?? 28) - 1))}>
              <AppText variant="h2" color={colors.roseStrong}>−</AppText>
            </Pressable>
            <AppText variant="bodyStrong">{settings.data?.cycleLengthDefault ?? 28} ngày</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Tăng độ dài chu kỳ" onPress={() => length.mutate(Math.min(45, (settings.data?.cycleLengthDefault ?? 28) + 1))}>
              <AppText variant="h2" color={colors.roseStrong}>+</AppText>
            </Pressable>
          </Card>

          <AppText variant="micro" color={colors.textMuted}>CÁC KỲ ĐÃ GHI</AppText>
          {(logs.data ?? []).map((l) => (
            <Card key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
              <AppText variant="bodyStrong" style={{ flex: 1 }}>{formatDate(l.periodStart)}</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel={`Xoá kỳ ${formatDate(l.periodStart)}`}
                onPress={() => Alert.alert('Xoá kỳ này?', formatDate(l.periodStart), [{ text: 'Huỷ', style: 'cancel' }, { text: 'Xoá', style: 'destructive', onPress: () => del.mutate(l.id) }])}>
                <Icon name="trash" size={18} color={colors.textMuted} />
              </Pressable>
            </Card>
          ))}
        </>
      )}
      <DatePickerSheet visible={pickerOpen} title="Ngày bắt đầu kỳ" value={toIsoDate(new Date())} maxDate={toIsoDate(new Date())} onClose={() => setPickerOpen(false)} onConfirm={log} />
    </Screen>
  );
}

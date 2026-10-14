import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useMe } from '@/features/account/api';
import { useCouple } from '@/features/couple/api';
import { useMoment, useSetReminderConfig } from '@/features/moments/api';
import { TYPE_LABELS } from '@/features/moments/labels';
import { recurrenceSummary } from '@/features/moments/occurrence';
import { errorMessage } from '@/lib/api/client';
import type { ReminderConfig } from '@/lib/api/types';
import { AppText } from '@/ui/AppText';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { DatePickerSheet } from '@/ui/DatePickerSheet';
import { ErrorText } from '@/ui/ErrorText';
import { IconCircle } from '@/ui/IconCircle';
import { ListRow } from '@/ui/ListRow';
import { PhotoTile } from '@/ui/PhotoTile';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { TextField } from '@/ui/TextField';
import { colors } from '@/ui/theme';
import { TopBar } from '@/ui/TopBar';

import { Choice, fromAudience, ownerOf, toAudience } from './audience';
import { MAX_OFFSETS, OFFSET_PRESETS, offsetLabel, parseMilestones, toggleOffset } from './offsets';

const QUICK = ['P0D', 'P1D', 'P3D', 'P7D', 'PT2H'];

export default function ReminderConfigScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const moment = useMoment(id);
  const me = useMe();
  const couple = useCouple();
  const save = useSetReminderConfig(id);
  const [choice, setChoice] = useState<Choice>('both');
  const [offsets, setOffsets] = useState<string[]>([]);
  const [sendAt, setSendAt] = useState('08:00');
  const [milestones, setMilestones] = useState('');
  const [ready, setReady] = useState(false);
  const [sheet, setSheet] = useState<'time' | 'more' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!moment.data || !me.data) return;
    const cfg = moment.data.effectiveReminderConfig;
    setChoice(moment.data.personal ? 'me' : fromAudience(cfg.recipients ?? 'BOTH', me.data.id, ownerOf(moment.data)));
    setOffsets(cfg.offsets ?? []);
    setSendAt(cfg.sendAt ?? '08:00');
    setMilestones(cfg.milestoneDays ? cfg.milestoneDays.join(', ') : '');
    setReady(true);
  }, [moment.data, me.data]);

  if (!moment.data || !me.data || !ready) return <Screen><AppText color={colors.textMuted}>Đang tải…</AppText></Screen>;
  const m = moment.data;
  const partnerName = couple.data?.partner.displayName ?? 'người ấy';
  const locked = m.type === 'CYCLE' && m.subjectUserId !== me.data.id;
  const isAnniversary = m.type === 'ANNIVERSARY';

  function toggle(iso: string) {
    const r = toggleOffset(offsets, iso);
    setOffsets(r.list);
    setError(r.error);
  }

  async function submit(config: ReminderConfig | null) {
    setError(null);
    try {
      await save.mutateAsync(config);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function onSave() {
    const parsed = isAnniversary && milestones.trim() ? parseMilestones(milestones) : { days: [], error: null };
    if (parsed.error) return setError(parsed.error);
    submit({
      recipients: m.personal ? 'OWNER' : toAudience(choice, me.data!.id, ownerOf(m)),
      offsets,
      sendAt,
      yearly: isAnniversary ? true : null,
      milestoneDays: isAnniversary && milestones.trim() ? parsed.days : null,
    });
  }

  const target = choice === 'me' ? `Gửi cho ${me.data.displayName}` : choice === 'partner' ? `Gửi cho ${partnerName}` : 'Gửi cho cả hai';
  const first = offsets[0];
  const preview = first ? `${first === 'P0D' ? 'Hôm nay là' : `${offsetLabel(first).replace('Trước', 'Còn')} nữa là`} ${m.title} · ${target}` : 'Chưa chọn lần nhắc nào';
  const recipients: { value: Choice; label: string }[] = [{ value: 'me', label: 'Mình' }, { value: 'partner', label: 'Người ấy' }, { value: 'both', label: 'Cả hai' }];

  return (
    <Screen bottomPad={40}>
      <TopBar title="Nhắc nhở" right={locked ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel="Lưu" onPress={onSave} hitSlop={8}><AppText variant="bodyStrong" color={colors.roseStrong}>Lưu</AppText></Pressable>
      )} />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <PhotoTile uri={m.media[0]?.url} seed={m.id} style={{ width: 48, height: 48, borderRadius: 14 }} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{m.title}</AppText>
          <AppText variant="caption" color={colors.textMuted}>{TYPE_LABELS[m.type]} · {isAnniversary ? 'theo mốc ngày yêu' : recurrenceSummary(m.recurrence, m.occursOn).toLowerCase()}</AppText>
        </View>
      </Card>
      {locked ? <AppText color={colors.textMuted}>Chỉ người theo dõi chu kỳ mới đổi được nhắc nhở này.</AppText> : (
        <>
          {m.personal ? (
            <AppText variant="caption" color={colors.textMuted}>Kỷ niệm riêng — chỉ nhắc cho bạn</AppText>
          ) : (
            <>
              <AppText variant="micro" color={colors.textMuted}>AI SẼ NHẬN NHẮC?</AppText>
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
                {recipients.map((r) => {
                  const on = choice === r.value;
                  return (
                    <Pressable key={r.value} accessibilityRole="radio" accessibilityLabel={r.label} accessibilityState={{ checked: on }} onPress={() => setChoice(r.value)}
                      style={{ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 24, borderWidth: 2, borderColor: on ? colors.rose : 'transparent', backgroundColor: on ? colors.roseSoft : colors.surface }}>
                      <View style={{ flexDirection: 'row' }}>
                        {r.value !== 'partner' ? <Avatar name={me.data!.displayName} tone="rose" size={28} ring /> : null}
                        {r.value !== 'me' ? <View style={{ marginLeft: r.value === 'both' ? -8 : 0 }}><Avatar name={partnerName} tone="lavender" size={28} ring /></View> : null}
                      </View>
                      <AppText variant="captionStrong" color={on ? colors.roseStrong : colors.text}>{r.label}</AppText>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="micro" color={colors.textMuted}>NHẮC TRƯỚC</AppText>
            <AppText variant="micro" color={colors.roseStrong}>{offsets.length}/{MAX_OFFSETS} đã chọn</AppText>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...new Set([...QUICK, ...offsets])].map((o) => <Chip key={o} label={offsetLabel(o)} selected={offsets.includes(o)} onPress={() => toggle(o)} />)}
            <Chip label="+ Tuỳ chỉnh" selected={false} onPress={() => setSheet('more')} />
          </View>
          <Card style={{ paddingVertical: 4 }}>
            <ListRow icon="clock" iconBg={colors.peachSoft} iconColor={colors.peachInk} title="Giờ gửi" subtitle="Cho các lần nhắc theo ngày"
              right={<AppText variant="bodyStrong" color={colors.roseStrong}>{sendAt}</AppText>} onPress={() => setSheet('time')} />
          </Card>
          {isAnniversary ? (
            <TextField label="Mốc ngày (cách nhau bằng dấu phẩy)" value={milestones} onChangeText={setMilestones} placeholder="100, 200, 365, 520, 1000" keyboardType="numbers-and-punctuation" />
          ) : null}
          <AppText variant="micro" color={colors.textMuted}>XEM TRƯỚC THÔNG BÁO</AppText>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconCircle name="heartFilled" bg={colors.roseStrong} color={colors.white} size={40} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{m.title} sắp tới</AppText>
              <AppText variant="caption" color={colors.textMuted}>{preview}</AppText>
            </View>
          </Card>
          <ErrorText message={error} />
          <Button title="Khôi phục mặc định" variant="ghost" onPress={() => submit(null)} />
        </>
      )}
      <DatePickerSheet visible={sheet === 'time'} mode="time" title="Giờ gửi nhắc" value={m.occursOn} time={sendAt}
        onClose={() => setSheet(null)} onConfirm={(_, t) => { if (t) setSendAt(t); setSheet(null); }} />
      <Sheet visible={sheet === 'more'} onClose={() => setSheet(null)} title="Nhắc trước">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {OFFSET_PRESETS.map((o) => <Chip key={o} label={offsetLabel(o)} selected={offsets.includes(o)} onPress={() => toggle(o)} />)}
        </View>
        <Button title="Xong" onPress={() => setSheet(null)} />
      </Sheet>
    </Screen>
  );
}

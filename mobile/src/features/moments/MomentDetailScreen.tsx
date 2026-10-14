import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMe } from '@/features/account/api';
import { useCouple } from '@/features/couple/api';
import { formatDate, formatDateTime, formatTime, toIsoDate, daysBetween } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { IconCircle } from '@/ui/IconCircle';
import { PhotoTile } from '@/ui/PhotoTile';
import { colors } from '@/ui/theme';

import { useMoment, useMomentReminders } from './api';
import { daysLeftLabel, moodLabel, TYPE_LABELS } from './labels';
import { nextOccurrence, recurrenceSummary } from './occurrence';

export default function MomentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const moment = useMoment(id);
  const reminders = useMomentReminders(id);
  const me = useMe();
  const couple = useCouple();
  const m = moment.data;
  if (!m) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const today = new Date();
  const next = nextOccurrence(m, today);
  const repeating = m.recurrence !== 'NONE' || m.type === 'ANNIVERSARY';
  const summary = m.type === 'ANNIVERSARY' ? 'Theo mốc ngày yêu' : recurrenceSummary(m.recurrence, m.occursOn);
  const countdown = next && next !== toIsoDate(today) ? daysLeftLabel(-daysBetween(next, today)).toLowerCase() : null;
  const author = m.createdBy === me.data?.id ? me.data?.displayName : couple.data?.partner.displayName;
  const mood = moodLabel(m.details.mood);
  const canEdit = m.type !== 'CYCLE' || m.subjectUserId === me.data?.id;
  const nextReminder = reminders.data?.[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView>
        <PhotoTile uri={m.media[0]?.url} seed={m.id} style={{ height: 380, borderRadius: 0 }} />
        <View style={styles.sheet}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View style={styles.typeChip}><AppText variant="micro" color={colors.roseStrong}>{TYPE_LABELS[m.type].toUpperCase()}</AppText></View>
            {m.personal ? <View style={[styles.typeChip, { backgroundColor: colors.lavender }]}><AppText variant="micro" color={colors.lavenderInk}>RIÊNG TƯ</AppText></View> : null}
            {m.type !== 'MOMENT' ? (
              <AppText variant="caption" color={colors.textMuted}>{repeating ? summary : 'Một lần'}{countdown ? ` · ${countdown}` : ''}</AppText>
            ) : null}
          </View>
          <AppText variant="display">{m.title}</AppText>
          <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
            <View style={styles.fact}><Icon name="calendar" size={16} color={colors.textMuted} /><AppText variant="caption" color={colors.textMuted}>{formatDate(m.occursOn)}{m.occursAt ? ` · ${formatTime(m.occursAt)}` : ''}</AppText></View>
            {m.place ? <View style={styles.fact}><Icon name="pin" size={16} color={colors.textMuted} /><AppText variant="caption" color={colors.textMuted}>{m.place.name}</AppText></View> : null}
            {author ? <View style={styles.fact}><Icon name="user" size={16} color={colors.textMuted} /><AppText variant="caption" color={colors.textMuted}>{author} lưu</AppText></View> : null}
          </View>
          {mood && m.type === 'MOMENT' ? <View style={[styles.typeChip, { alignSelf: 'flex-start' }]}><AppText variant="captionStrong" color={colors.roseStrong}>{mood}</AppText></View> : null}
          {m.message ? (
            <View style={styles.quote}>
              <Icon name="quote" size={20} color={colors.rose} />
              <AppText style={{ flex: 1 }}>{m.message}</AppText>
            </View>
          ) : null}
          {m.media.length > 1 ? (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/journal/${m.occursOn}`)}>
              <AppText variant="captionStrong" color={colors.roseStrong}>Xem cả {m.media.length} ảnh</AppText>
            </Pressable>
          ) : null}
          {m.type !== 'MOMENT' ? (
            <Card style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <AppText variant="h3">Nhắc nhở</AppText>
                {canEdit ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Tuỳ chỉnh" onPress={() => router.push(`/moments/${m.id}/reminders`)}>
                    <AppText variant="captionStrong" color={colors.roseStrong}>Tuỳ chỉnh</AppText>
                  </Pressable>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                <IconCircle name="bell" bg={colors.roseSoft} color={colors.rose} size={36} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{nextReminder ? nextReminder.body : 'Không có nhắc nào sắp tới cho bạn'}</AppText>
                  {nextReminder ? <AppText variant="caption" color={colors.textMuted}>{formatDateTime(nextReminder.fireAt)}</AppText> : null}
                </View>
              </View>
            </Card>
          ) : null}
        </View>
      </ScrollView>
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.round}><Icon name="back" size={20} /></Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Chia sẻ" style={styles.round}
            onPress={() => Share.share({ message: `${m.title} · ${formatDate(m.occursOn)}` })}><Icon name="share" size={20} /></Pressable>
          {canEdit ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Sửa" style={styles.round} onPress={() => router.push(`/moments/${m.id}/edit`)}><Icon name="edit" size={20} /></Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { marginTop: -30, padding: 24, gap: 14, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: colors.bg },
  typeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.roseSoft },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quote: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 20, backgroundColor: colors.roseSoft },
  top: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});

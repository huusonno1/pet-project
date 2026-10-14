import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useMe } from '@/features/account/api';
import { useCouple, useDistance } from '@/features/couple/api';
import { BellButton } from '@/features/couple/SoloHomeScreen';
import { useMoments } from '@/features/moments/api';
import { daysLeftLabel } from '@/features/moments/labels';
import { upcomingMoments } from '@/features/moments/occurrence';
import { useLatestNote, useSendNote } from '@/features/notes/api';
import { errorMessage } from '@/lib/api/client';
import type { Moment, MomentType } from '@/lib/api/types';
import { daysBetween, formatDate, formatKm, formatTime, timeAgo, toIsoDate } from '@/lib/format';
import { greeting } from '@/lib/greeting';
import { AppText } from '@/ui/AppText';
import { Avatar } from '@/ui/Avatar';
import { Card } from '@/ui/Card';
import { ErrorText } from '@/ui/ErrorText';
import { Icon, IconName } from '@/ui/Icon';
import { IconCircle } from '@/ui/IconCircle';
import { PhotoTile } from '@/ui/PhotoTile';
import { Screen } from '@/ui/Screen';
import { colors, fonts } from '@/ui/theme';

import { nextHundred } from './milestone';
import { useLocationSync } from './use-location-sync';

const TYPE_STYLE: Partial<Record<MomentType, { icon: IconName; bg: string; color: string }>> = {
  ANNIVERSARY: { icon: 'heart', bg: colors.roseSoft, color: colors.rose },
  GIFT_OCCASION: { icon: 'gift', bg: colors.peachSoft, color: colors.peachInk },
  DATE_PLAN: { icon: 'calendar', bg: colors.mint, color: colors.mintInk },
  CUSTOM: { icon: 'bell', bg: colors.lavender, color: colors.lavenderInk },
};

export default function HomeScreen() {
  const me = useMe();
  const couple = useCouple();
  const distance = useDistance();
  const moments = useMoments();
  const location = useLocationSync();
  const today = new Date();
  const todayIso = toIsoDate(today);
  const list = moments.data ?? [];
  const upcoming = upcomingMoments(list.filter((m) => m.type !== 'MOMENT'), today, 6);
  const nextDate = upcoming.find((u) => u.moment.type === 'DATE_PLAN');
  const recent = list.filter((m) => m.type !== 'CYCLE' && m.occursOn <= todayIso)
    .sort((a, b) => b.occursOn.localeCompare(a.occursOn)).slice(0, 3);
  const partner = couple.data?.partner;
  const since = couple.data?.startedDatingOn ?? null;
  const days = since ? Math.max(0, daysBetween(since, today)) : null;

  return (
    <Screen gap={18}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="h2">{greeting(today)}, {me.data?.displayName ?? ''}</AppText>
        <BellButton />
      </View>

      <LinearGradient colors={['#B92E55', '#C9533F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row' }}>
            <Avatar name={me.data?.displayName ?? 'B'} tone="rose" size={30} ring uri={me.data?.avatarUrl} />
            <View style={{ marginLeft: -10 }}><Avatar name={partner?.displayName ?? '?'} tone="lavender" size={30} ring uri={partner?.avatarUrl} /></View>
          </View>
          <AppText variant="bodyStrong" color={colors.white}>{me.data?.displayName} & {partner?.displayName}</AppText>
        </View>
        {days !== null ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <AppText color={colors.white} style={{ fontFamily: fonts.extrabold, fontSize: 64, lineHeight: 70 }}>{days}</AppText>
              <AppText variant="h3" color={colors.white}>ngày bên nhau</AppText>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(nextHundred(days).progress * 100)}%` }]} /></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="caption" color={colors.white}>Từ {formatDate(since!)}</AppText>
              <AppText variant="caption" color={colors.white}>Còn {nextHundred(days).daysLeft} ngày tới mốc {nextHundred(days).target}</AppText>
            </View>
          </>
        ) : (
          <AppText color={colors.white}>Thêm ngày bắt đầu yêu ở Tôi → Thông tin cặp đôi để bắt đầu đếm ngày</AppText>
        )}
      </LinearGradient>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, gap: 8 }}>
          <IconCircle name="navigation" bg={colors.lavender} color={colors.lavenderInk} size={36} />
          {location === 'denied' || location === 'disabled' ? (
            <Pressable accessibilityRole="button" onPress={() => (location === 'denied' ? Linking.openSettings() : router.push('/me'))}>
              <AppText variant="h3">Chưa bật định vị</AppText>
              <AppText variant="caption" color={colors.textMuted}>{location === 'denied' ? 'Chạm để mở cài đặt' : 'Bật lại ở Tôi'}</AppText>
            </Pressable>
          ) : distance.data?.distanceKm != null ? (
            <>
              <AppText variant="h2">{formatKm(distance.data.distanceKm)}</AppText>
              <AppText variant="caption" color={colors.textMuted}>{partner?.displayName} · {distance.data.partner ? timeAgo(distance.data.partner.updatedAt) : ''}</AppText>
            </>
          ) : (
            <>
              <AppText variant="h3">—</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {distance.data && !distance.data.partner ? 'Người ấy chưa bật chia sẻ vị trí' : 'Đang lấy vị trí…'}
              </AppText>
            </>
          )}
        </Card>
        <Pressable style={{ flex: 1 }} accessibilityRole="button"
          onPress={() => (nextDate ? router.push(`/moments/${nextDate.moment.id}`) : router.push('/create'))}>
          <Card style={{ gap: 8, flex: 1 }}>
            <IconCircle name="calendar" bg={colors.mint} color={colors.mintInk} size={36} />
            {nextDate ? (
              <>
                <AppText variant="h2">{nextDate.moment.occursAt ? formatTime(nextDate.moment.occursAt) : formatDate(nextDate.date)}</AppText>
                <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>{nextDate.moment.title} · {daysLeftLabel(nextDate.daysLeft).toLowerCase()}</AppText>
              </>
            ) : (
              <>
                <AppText variant="h3">Chưa có hẹn</AppText>
                <AppText variant="caption" color={colors.textMuted}>Chạm để lên lịch</AppText>
              </>
            )}
          </Card>
        </Pressable>
      </View>

      <SectionHeader title="Sắp tới" action="Xem lịch" onPress={() => router.push('/journal?view=month')} />
      {upcoming.length === 0 ? (
        <AppText variant="caption" color={colors.textMuted}>Chưa có ngày đặc biệt nào sắp tới.</AppText>
      ) : (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {upcoming.slice(0, 2).map(({ moment, date, daysLeft }) => <UpcomingCard key={moment.id} moment={moment} date={date} daysLeft={daysLeft} />)}
        </View>
      )}

      <SectionHeader title="Nhật ký gần đây" action="Xem hết" onPress={() => router.push('/journal')} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {recent.map((m) => (
          <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={m.title} style={{ flex: 1 }} onPress={() => router.push(`/journal/${m.occursOn}`)}>
            <PhotoTile uri={m.media[0]?.url} seed={m.id} style={{ height: 104 }} />
          </Pressable>
        ))}
      </View>

      {partner ? <NoteCard partnerName={partner.displayName} /> : null}
    </Screen>
  );
}

function SectionHeader({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <AppText variant="h2">{title}</AppText>
      <Pressable accessibilityRole="button" onPress={onPress}><AppText variant="captionStrong" color={colors.roseStrong}>{action}</AppText></Pressable>
    </View>
  );
}

function UpcomingCard({ moment, date, daysLeft }: { moment: Moment; date: string; daysLeft: number }) {
  const s = TYPE_STYLE[moment.type] ?? TYPE_STYLE.CUSTOM!;
  const [, mm, dd] = date.split('-');
  const label = daysLeftLabel(daysLeft);
  return (
    <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${moment.title}, ${label}`}
      onPress={() => router.push(moment.type === 'GIFT_OCCASION' ? '/partner' : `/moments/${moment.id}`)}>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={[styles.dateBadge, { backgroundColor: s.bg }]}>
            <AppText variant="h2">{dd}</AppText>
            <AppText variant="micro" color={colors.textMuted}>TH{mm}</AppText>
          </View>
          <IconCircle name={s.icon} bg={s.bg} color={s.color} size={32} />
        </View>
        <AppText variant="h3" numberOfLines={1}>{moment.title}</AppText>
        <AppText variant="caption" color={colors.textMuted}>{label}</AppText>
      </Card>
    </Pressable>
  );
}

function NoteCard({ partnerName }: { partnerName: string }) {
  const latest = useLatestNote();
  const send = useSendNote();
  const [draft, setDraft] = useState('');
  const [sentTo, setSentTo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const note = latest.data;

  async function submit() {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    try {
      await send.mutateAsync({ kind: 'TEXT', text });
      setDraft('');
      setSentTo(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <LinearGradient colors={['#EDE8FF', '#FDE3EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.note}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={partnerName} tone="lavender" size={28} />
        <View>
          <AppText variant="bodyStrong">{note ? `${partnerName} nhắn cho bạn` : `Lời nhắn với ${partnerName}`}</AppText>
          {note ? <AppText variant="caption" color={colors.textMuted}>{timeAgo(note.createdAt)}</AppText> : null}
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/notes')} style={styles.bubble}>
        <AppText>{note ? (note.text ?? 'Một hình vẽ tay cho bạn') : 'Chưa có lời nhắn nào — gửi câu đầu tiên nhé'}</AppText>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput accessibilityLabel={`Lời nhắn cho ${partnerName}`} placeholder={`Bạn muốn nhắn gì cho ${partnerName}?`} placeholderTextColor={colors.textMuted}
          value={draft} onChangeText={(t) => { setDraft(t); setSentTo(false); }} onSubmitEditing={submit} style={styles.composer} />
        <Pressable accessibilityRole="button" accessibilityLabel="Gửi" onPress={submit} disabled={send.isPending} style={styles.send}>
          <Icon name="send" size={18} color={colors.white} />
        </Pressable>
      </View>
      {sentTo ? <AppText variant="caption" color={colors.mintInk}>Đã gửi cho {partnerName}</AppText> : null}
      <ErrorText message={error} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 32, paddingHorizontal: 22, paddingVertical: 20, gap: 10 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.white },
  dateBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, alignItems: 'center' },
  note: { borderRadius: 24, padding: 16, gap: 12 },
  bubble: { padding: 14, borderRadius: 18, borderBottomLeftRadius: 6, backgroundColor: colors.surface },
  composer: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.roseStrong, alignItems: 'center', justifyContent: 'center' },
});

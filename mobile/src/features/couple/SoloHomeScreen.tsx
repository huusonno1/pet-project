import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useMe } from '@/features/account/api';
import { useUnreadCount } from '@/features/inbox/api';
import { useMoments } from '@/features/moments/api';
import { formatDate, toIsoDate } from '@/lib/format';
import { greeting } from '@/lib/greeting';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { PhotoTile } from '@/ui/PhotoTile';
import { Screen } from '@/ui/Screen';
import { colors, shadow } from '@/ui/theme';

import { ConnectCard } from './ConnectCard';

export function BellButton() {
  const unread = useUnreadCount();
  const count = unread.data ?? 0;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={count ? `Thông báo, có ${count} mục mới` : 'Thông báo'}
      onPress={() => router.push('/notifications')}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
      <Icon name="bell" size={20} />
      {count ? <View style={{ position: 'absolute', left: 26, top: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.rose, borderWidth: 2, borderColor: colors.white }} /> : null}
    </Pressable>
  );
}

export default function SoloHomeScreen() {
  const me = useMe();
  const moments = useMoments();
  const today = toIsoDate(new Date());
  const recent = (moments.data ?? [])
    .filter((m) => m.type !== 'CYCLE' && m.occursOn <= today)
    .sort((a, b) => b.occursOn.localeCompare(a.occursOn))
    .slice(0, 2);

  return (
    <Screen gap={16}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="h1">{greeting(new Date())}, {me.data?.displayName ?? ''}</AppText>
        <BellButton />
      </View>
      <ConnectCard name={me.data?.displayName ?? 'B'} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <AppText variant="h2">Nhật ký của tôi</AppText>
        <Pressable accessibilityRole="button" onPress={() => router.push('/journal')}>
          <AppText variant="captionStrong" color={colors.roseStrong}>Xem hết</AppText>
        </Pressable>
      </View>
      {moments.isSuccess && recent.length === 0 ? (
        <AppText variant="caption" color={colors.textMuted}>Chưa có khoảnh khắc nào. Bấm + để lưu khoảnh khắc đầu tiên.</AppText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {recent.map((m) => (
          <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={m.title} style={{ flex: 1 }} onPress={() => router.push(`/journal/${m.occursOn}`)}>
            <Card style={{ padding: 10, gap: 6 }}>
              <PhotoTile uri={m.media[0]?.url} seed={m.id} style={{ height: 110, borderRadius: 16 }} />
              <AppText variant="bodyStrong" numberOfLines={1}>{m.title}</AppText>
              <AppText variant="caption" color={colors.textMuted}>{formatDate(m.occursOn)}</AppText>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

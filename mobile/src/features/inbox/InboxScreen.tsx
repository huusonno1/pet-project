import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { routeForDeepLink } from '@/lib/push';
import type { InboxItem } from '@/lib/api/types';
import { timeAgo, toIsoDate } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { IconName } from '@/ui/Icon';
import { IconCircle } from '@/ui/IconCircle';
import { Screen } from '@/ui/Screen';
import { colors, shadow } from '@/ui/theme';
import { TopBar } from '@/ui/TopBar';

import { useInbox, useMarkAllRead, useMarkRead } from './api';

const KIND: Record<string, { icon: IconName; bg: string; color: string }> = {
  LOVE_NOTE: { icon: 'heart', bg: colors.roseSoft, color: colors.rose },
  PAIRED: { icon: 'heart', bg: colors.roseSoft, color: colors.rose },
  PAIR_REQUEST: { icon: 'user', bg: colors.lavender, color: colors.lavenderInk },
  MOMENT: { icon: 'sparkles', bg: colors.lavender, color: colors.lavenderInk },
  REMINDER: { icon: 'bell', bg: colors.peachSoft, color: colors.peachInk },
};

/** Bỏ emoji ở đầu tiêu đề push (UI dùng icon thay emoji). */
function cleanTitle(t: string) {
  return t.replace(/^[^\p{L}\p{N}]+/u, '');
}

export default function InboxScreen() {
  const inbox = useInbox();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const today = toIsoDate(new Date());
  const items = inbox.data ?? [];
  const groups: [string, InboxItem[]][] = [
    ['HÔM NAY', items.filter((i) => toIsoDate(new Date(i.createdAt)) === today)],
    ['TRƯỚC ĐÓ', items.filter((i) => toIsoDate(new Date(i.createdAt)) !== today)],
  ];

  function open(item: InboxItem) {
    if (!item.readAt) markRead.mutate(item.id);
    const route = routeForDeepLink(item.deepLink);
    if (route) router.push(route);
  }

  return (
    <Screen gap={10}>
      <TopBar title="Thông báo" right={
        <Pressable accessibilityRole="button" accessibilityLabel="Đọc hết" onPress={() => markAll.mutate()} hitSlop={8}>
          <AppText variant="captionStrong" color={colors.roseStrong}>Đọc hết</AppText>
        </Pressable>
      } />
      {inbox.isSuccess && items.length === 0 ? (
        <AppText color={colors.textMuted}>Chưa có thông báo nào.</AppText>
      ) : null}
      {groups.filter(([, list]) => list.length > 0).map(([label, list]) => (
        <View key={label} style={{ gap: 10 }}>
          <AppText variant="micro" color={colors.textMuted}>{label}</AppText>
          {list.map((item) => {
            const k = KIND[item.kind] ?? KIND.REMINDER;
            const title = cleanTitle(item.title);
            return (
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${title}, ${item.body}`} onPress={() => open(item)}
                style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: item.readAt ? 'transparent' : colors.roseBorder }, shadow.card]}>
                <IconCircle name={k.icon} bg={k.bg} color={k.color} size={40} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{title}</AppText>
                  <AppText variant="caption" color={colors.textMuted} numberOfLines={2}>{item.body}</AppText>
                  <AppText variant="caption" color={colors.textMuted}>{timeAgo(item.createdAt)}</AppText>
                </View>
                {item.readAt ? null : <View accessibilityLabel="Chưa đọc" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rose }} />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

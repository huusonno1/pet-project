import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { useMe, useSettings, useUpdateSettings } from '@/features/account/api';
import { useCouple, useEndCouple } from '@/features/couple/api';
import { apiFetch } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { daysBetween, formatDate } from '@/lib/format';
import { getLastPushToken } from '@/lib/push';
import { AppText } from '@/ui/AppText';
import { Avatar } from '@/ui/Avatar';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { ListRow } from '@/ui/ListRow';
import { Screen } from '@/ui/Screen';
import { colors } from '@/ui/theme';
import { Toggle } from '@/ui/Toggle';

export default function MeScreen() {
  const me = useMe();
  const couple = useCouple();
  const settings = useSettings();
  const update = useUpdateSettings();
  const end = useEndCouple();
  const { signOut } = useSession();
  const s = settings.data;
  const c = couple.data;

  function confirmEnd() {
    Alert.alert('Kết thúc cặp đôi?', 'Hai bạn sẽ không còn xem chung kỷ niệm, nhắc nhở sắp tới bị huỷ. Kỷ niệm riêng của bạn vẫn giữ lại.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Kết thúc', style: 'destructive', onPress: async () => { await end.mutateAsync(); router.replace('/'); } },
    ]);
  }

  async function handleSignOut() {
    const token = getLastPushToken();
    if (token) await apiFetch(`/api/me/devices?token=${encodeURIComponent(token)}`, { method: 'DELETE' }).catch(() => undefined);
    await signOut();
  }

  return (
    <Screen gap={12}>
      <Pressable accessibilityRole="button" accessibilityLabel="Hồ sơ của tôi" onPress={() => router.push('/me/profile')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={me.data?.displayName ?? '?'} tone="rose" size={52} uri={me.data?.avatarUrl} />
          <View style={{ flex: 1 }}>
            <AppText variant="h2">{me.data?.displayName ?? ''}</AppText>
            <AppText variant="caption" color={colors.textMuted}>{me.data ? `@${me.data.handle} · ${me.data.email}` : ''}</AppText>
          </View>
          <Icon name="chevronRight" size={18} color={colors.textMuted} />
        </Card>
      </Pressable>

      {c ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 24, backgroundColor: colors.roseSoft }}>
          <Icon name="heart" size={20} color={colors.rose} />
          <View>
            <AppText variant="bodyStrong">{me.data?.displayName} & {c.partner.displayName} · {Math.max(0, daysBetween(c.startedDatingOn ?? c.createdAt.slice(0, 10), new Date()))} ngày</AppText>
            <AppText variant="caption" color={colors.textMuted}>{c.startedDatingOn ? `Bắt đầu yêu ${formatDate(c.startedDatingOn)}` : 'Chưa có ngày bắt đầu yêu'}</AppText>
          </View>
        </View>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          <ListRow icon="heart" iconBg={colors.roseSoft} iconColor={colors.rose} title="Ghép đôi" subtitle="Mời bằng mã, nhập mã hoặc tìm theo ID" onPress={() => router.push('/pair')} />
        </Card>
      )}

      <AppText variant="micro" color={colors.textMuted} style={{ marginTop: 4 }}>TÀI KHOẢN</AppText>
      <Card style={{ paddingVertical: 4, gap: 0 }}>
        <ListRow icon="user" iconBg={colors.roseSoft} iconColor={colors.rose} title="Thông tin cá nhân" subtitle="Tên, ID, sinh nhật, size & món bạn thích" onPress={() => router.push('/me/profile')} />
        {me.data?.gender === 'FEMALE' ? (
          <ListRow icon="droplet" iconBg={colors.roseSoft} iconColor={colors.cycle} title="Theo dõi chu kỳ"
            subtitle={s?.cycleTracking ? 'Tuỳ chọn · đang bật' : 'Tuỳ chọn · đang tắt'} onPress={() => router.push('/me/cycle')} />
        ) : null}
      </Card>

      <AppText variant="micro" color={colors.textMuted} style={{ marginTop: 4 }}>QUYỀN RIÊNG TƯ & THÔNG BÁO</AppText>
      <Card style={{ paddingVertical: 4, gap: 0 }}>
        <ListRow icon="pin" iconBg={colors.mint} iconColor={colors.mintInk} title="Chia sẻ vị trí"
          subtitle={s?.shareLocation ? 'Để tính khoảng cách' : 'Đã tắt · người ấy không thấy khoảng cách'}
          right={<Toggle label="Chia sẻ vị trí" value={s?.shareLocation ?? true} onValueChange={(v) => update.mutate({ shareLocation: v })} />} />
        <ListRow icon="search" iconBg={colors.lavender} iconColor={colors.lavenderInk} title="Cho phép tìm theo ID"
          subtitle={me.data ? `Người khác nhập đúng @${me.data.handle} sẽ thấy bạn` : null}
          right={<Toggle label="Cho phép tìm theo ID" value={s?.discoverable ?? true} onValueChange={(v) => update.mutate({ discoverable: v })} />} />
        <ListRow icon="bell" iconBg={colors.lavender} iconColor={colors.lavenderInk} title="Thông báo" subtitle="Lời nhắn, nhắc nhở, mốc" onPress={() => router.push('/me/notifications')} />
      </Card>

      <Card style={{ paddingVertical: 4, gap: 0 }}>
        {c ? <ListRow icon="unlink" iconBg={colors.surfaceMuted} iconColor={colors.danger} title="Kết thúc cặp đôi" danger onPress={confirmEnd} right={<View />} /> : null}
        <ListRow icon="logout" iconBg={colors.surfaceMuted} iconColor={colors.textMuted} title="Đăng xuất" onPress={handleSignOut} right={<View />} />
      </Card>
    </Screen>
  );
}

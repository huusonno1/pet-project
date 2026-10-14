import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { useMe } from '@/features/account/api';
import { daysBetween, formatDate } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { colors } from '@/ui/theme';

import { useCouple } from './api';

export default function PairSuccessScreen() {
  const couple = useCouple();
  const me = useMe();
  const c = couple.data;
  const since = c?.startedDatingOn ?? c?.createdAt.slice(0, 10) ?? null;
  const days = since ? Math.max(0, daysBetween(since, new Date())) : 0;
  return (
    <LinearGradient colors={['#FDE3EA', colors.bg]} locations={[0, 0.7]} style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 12 }}>
      <View style={{ flexDirection: 'row', alignSelf: 'center', alignItems: 'center', marginBottom: 24 }}>
        <Avatar name={me.data?.displayName ?? 'B'} tone="rose" size={84} ring uri={me.data?.avatarUrl} />
        <View style={{ marginLeft: -6 }}><Avatar name={c?.partner.displayName ?? '?'} tone="lavender" size={84} ring uri={c?.partner.avatarUrl} /></View>
        <View style={{ position: 'absolute', left: 57, top: 36, width: 56, height: 56, borderRadius: 28, borderWidth: 4, borderColor: colors.white, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="heartFilled" size={22} color={colors.white} />
        </View>
      </View>
      <AppText variant="display" style={{ textAlign: 'center' }}>Hai bạn đã được kết nối!</AppText>
      <AppText color={colors.textMuted} style={{ textAlign: 'center' }}>
        {me.data?.displayName} & {c?.partner.displayName}{since ? ` · bên nhau từ ${formatDate(since)}` : ''}
      </AppText>
      <Card style={{ alignItems: 'center', gap: 0, borderRadius: 28, marginTop: 8 }}>
        <AppText style={{ fontFamily: 'BeVietnamPro_800ExtraBold', fontSize: 56, lineHeight: 64 }} color={colors.roseStrong}>{days}</AppText>
        <AppText variant="h3" color={colors.textMuted}>ngày bên nhau</AppText>
      </Card>
      <View style={{ height: 24 }} />
      <Button title="Vào trang chủ" onPress={() => router.replace('/')} />
      <Button title="Thêm kỷ niệm đầu tiên" variant="ghost" onPress={() => router.replace('/create')} />
    </LinearGradient>
  );
}

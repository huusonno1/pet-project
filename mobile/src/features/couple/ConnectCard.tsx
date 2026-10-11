import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/ui/AppText';
import { Avatar } from '@/ui/Avatar';
import { Icon, IconName } from '@/ui/Icon';
import { colors } from '@/ui/theme';

const OPTIONS: { label: string; icon: IconName; href: string }[] = [
  { label: 'Tạo mã mời', icon: 'qr', href: '/pair?tab=invite' },
  { label: 'Nhập mã', icon: 'hash', href: '/pair?tab=code' },
  { label: 'Tìm theo ID', icon: 'search', href: '/pair/search' },
];

export function ConnectCard({ name }: { name: string }) {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={name} tone="rose" size={54} ring />
        <View style={styles.unknown}><AppText variant="h2" color={colors.roseStrong}>?</AppText></View>
      </View>
      <AppText variant="h3">Kết nối với người ấy</AppText>
      <AppText variant="caption" color={colors.textMuted} style={{ textAlign: 'center', maxWidth: 290 }}>
        Đếm ngày yêu, khoảng cách và nhắc nhở cho cả hai sẽ mở khi ghép đôi
      </AppText>
      <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
        {OPTIONS.map((o) => (
          <Pressable key={o.label} accessibilityRole="button" accessibilityLabel={o.label} onPress={() => router.push(o.href)} style={styles.option}>
            <Icon name={o.icon} size={22} color={colors.roseStrong} />
            <AppText variant="captionStrong">{o.label}</AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.roseSoft, borderRadius: 24, paddingTop: 20, paddingBottom: 18, paddingHorizontal: 16, alignItems: 'center', gap: 12 },
  unknown: { marginLeft: -10, width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.rose, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  option: { flex: 1, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', gap: 6 },
});

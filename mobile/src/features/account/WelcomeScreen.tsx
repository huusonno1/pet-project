import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui/AppText';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Icon, IconName } from '@/ui/Icon';
import { colors, shadow } from '@/ui/theme';

const PILLS: { icon: IconName; color: string; label: string; style: object }[] = [
  { icon: 'heart', color: colors.rose, label: '604 ngày', style: { left: 30, top: 40 } },
  { icon: 'navigation', color: colors.lavenderInk, label: '1.137 km', style: { right: 20, top: 70 } },
  { icon: 'gift', color: colors.peachInk, label: 'Còn 5 ngày', style: { left: 40, top: 270 } },
  { icon: 'sparkles', color: colors.mintInk, label: 'Kỷ niệm mới', style: { right: 30, top: 300 } },
];

export default function WelcomeScreen() {
  return (
    <LinearGradient colors={['#FDE3EA', colors.bg]} locations={[0, 0.55]} style={{ flex: 1 }}>
      <View style={styles.illo}>
        <View style={styles.ring} />
        <View style={styles.pair}>
          <Avatar name="L" tone="rose" size={92} ring />
          <View style={{ marginLeft: -8 }}><Avatar name="M" tone="lavender" size={92} ring /></View>
          <View style={styles.heart}><Icon name="heartFilled" size={22} color={colors.white} /></View>
        </View>
        {PILLS.map((p) => (
          <View key={p.label} style={[styles.pill, p.style]}>
            <Icon name={p.icon} size={14} color={p.color} />
            <AppText variant="captionStrong">{p.label}</AppText>
          </View>
        ))}
      </View>
      <View style={styles.bottom}>
        <AppText variant="display" style={{ textAlign: 'center' }}>Lưu giữ từng khoảnh khắc của hai bạn</AppText>
        <AppText color={colors.textMuted} style={{ textAlign: 'center' }}>
          Đếm ngày yêu, nhắc ngày quan trọng và ghi nhớ sở thích của nhau.
        </AppText>
        <View style={{ height: 24 }} />
        <Button title="Tạo tài khoản" onPress={() => router.push('/sign-up')} />
        <Button title="Tôi đã có tài khoản" variant="ghost" onPress={() => router.push('/sign-in')} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  illo: { height: 400, marginTop: 70 },
  ring: { position: 'absolute', left: '50%', marginLeft: -125, top: 50, width: 250, height: 250, borderRadius: 125, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(233,85,122,0.35)' },
  pair: { position: 'absolute', top: 129, alignSelf: 'center', flexDirection: 'row', alignItems: 'center' },
  heart: { position: 'absolute', left: 64, top: 18, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.rose, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingLeft: 12, paddingRight: 14, borderRadius: 999, backgroundColor: colors.surface, ...shadow.card },
  bottom: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
});

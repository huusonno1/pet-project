import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCouple } from '@/features/couple/api';
import type { MomentType } from '@/lib/api/types';
import { AppText } from '@/ui/AppText';
import { Icon, IconName } from '@/ui/Icon';
import { IconCircle } from '@/ui/IconCircle';
import { PhotoTile } from '@/ui/PhotoTile';
import { Sheet } from '@/ui/Sheet';
import { colors } from '@/ui/theme';

const TILES: { type: MomentType; label: string; sub: string; icon: IconName; bg: string; color: string; couple: boolean }[] = [
  { type: 'ANNIVERSARY', label: 'Kỷ niệm', sub: 'Ngày yêu, mốc 100 ngày…', icon: 'heart', bg: colors.roseSoft, color: colors.rose, couple: true },
  { type: 'DATE_PLAN', label: 'Lịch hẹn', sub: 'Hẹn hò, chuyến đi', icon: 'calendar', bg: colors.lavender, color: colors.lavenderInk, couple: true },
  { type: 'GIFT_OCCASION', label: 'Tặng quà', sub: 'Sinh nhật, 14/2, 20/10', icon: 'gift', bg: colors.peachSoft, color: colors.peachInk, couple: true },
  { type: 'CUSTOM', label: 'Khác', sub: 'Tự đặt tên & lịch nhắc', icon: 'pen', bg: colors.mint, color: colors.mintInk, couple: false },
];

export function ClassifySheet({ visible, onClose, thumbUri }: { visible: boolean; onClose: () => void; thumbUri?: string | null }) {
  const paired = !!useCouple().data;
  function go(path: string) {
    onClose();
    router.push(path);
  }
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <PhotoTile uri={thumbUri} seed="capture" style={{ width: 52, height: 52, borderRadius: 14 }} />
        <View style={{ flex: 1 }}>
          <AppText variant="h2">Lưu ảnh này thành…</AppText>
          <AppText variant="caption" color={colors.textMuted}>Chọn loại phù hợp, đổi lại được sau</AppText>
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Khoảnh khắc, lưu ngay vào Nhật ký" onPress={() => go('/create/moment')} style={styles.hero}>
        <IconCircle name="sparkles" bg={colors.surface} color={colors.rose} size={44} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="bodyStrong" style={{ fontSize: 16 }}>Khoảnh khắc</AppText>
          <AppText variant="caption" color={colors.textMuted}>Lưu ngay vào Nhật ký — không cần nhắc nhở hay lặp lại</AppText>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {['Nhớ nhung', 'Hạnh phúc', 'Bình yên'].map((m) => (
              <View key={m} style={styles.moodPill}><AppText variant="captionStrong" color={colors.roseStrong} style={{ fontSize: 12 }}>{m}</AppText></View>
            ))}
          </View>
        </View>
        <Icon name="chevronRight" size={18} color={colors.roseStrong} />
      </Pressable>
      <AppText variant="micro" color={colors.textMuted}>HOẶC ĐÁNH DẤU LÀ MỐC CẦN NHỚ · CÓ NHẮC NHỞ</AppText>
      <View style={styles.grid}>
        {TILES.map((t) => {
          const locked = t.couple && !paired;
          return (
            <Pressable key={t.type} accessibilityRole="button" accessibilityLabel={`${t.label}, ${locked ? 'cần ghép đôi' : t.sub}`}
              accessibilityState={{ disabled: locked }} disabled={locked} onPress={() => go(`/create/milestone?type=${t.type}`)}
              style={[styles.tile, locked && { opacity: 0.45 }]}>
              <IconCircle name={t.icon} bg={t.bg} color={t.color} size={36} />
              <AppText variant="bodyStrong">{t.label}</AppText>
              <AppText variant="caption" color={colors.textMuted} style={{ fontSize: 12 }}>{locked ? 'Cần ghép đôi' : t.sub}</AppText>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22, borderWidth: 1.5, borderColor: colors.roseBorder, backgroundColor: colors.roseSoft },
  moodPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.surface },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47.5%', height: 124, padding: 14, gap: 8, borderRadius: 20, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
});

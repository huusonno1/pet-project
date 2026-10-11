import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { colors } from './theme';

export type TabName = 'index' | 'journal' | 'create' | 'partner' | 'me';

const TABS: { name: TabName; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Trang chủ', icon: 'home' },
  { name: 'journal', label: 'Nhật ký', icon: 'journal' },
  { name: 'create', label: 'Tạo mới', icon: 'plus' },
  { name: 'partner', label: 'Người ấy', icon: 'heart' },
  { name: 'me', label: 'Tôi', icon: 'user' },
];

export function TabBar({ active, onSelect }: { active: string; onSelect: (name: TabName) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {TABS.map((t) => {
        const on = t.name === active;
        if (t.name === 'create') {
          return (
            <Pressable key={t.name} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: on }}
              onPress={() => onSelect(t.name)} style={[styles.plus, on && { backgroundColor: colors.text }]}>
              <Icon name="plus" size={26} color={colors.white} />
            </Pressable>
          );
        }
        return (
          <Pressable key={t.name} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }}
            onPress={() => onSelect(t.name)} style={styles.tab}>
            <Icon name={t.icon} size={24} color={on ? colors.roseStrong : colors.textMuted} />
            <AppText variant="micro" color={on ? colors.roseStrong : colors.textMuted} style={{ letterSpacing: 0 }}>{t.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 10, paddingHorizontal: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  tab: { width: 64, alignItems: 'center', gap: 4, paddingVertical: 4 },
  plus: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.roseStrong, alignItems: 'center', justifyContent: 'center', shadowColor: colors.roseStrong, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
});

import { ActivityIndicator, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { colors } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.roseStrong, fg: colors.white, border: colors.roseStrong },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.line },
  ghost: { bg: 'transparent', fg: colors.roseStrong, border: 'transparent' },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.line },
};

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  compact?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', disabled = false, loading = false, icon, compact, testID, style }: Props) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: v.bg, borderColor: v.border },
        (pressed || inactive) && { opacity: inactive ? 0.5 : 0.85 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={v.fg} /> : null}
          <AppText variant="bodyStrong" color={v.fg} style={{ fontSize: compact ? 15 : 16 }}>
            {title}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 54, borderRadius: 18, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  compact: { height: 44, borderRadius: 16 },
});

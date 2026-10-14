import { Pressable } from 'react-native';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors } from './theme';

const PROVIDERS = {
  apple: { label: 'Apple', bg: '#000000', fg: colors.white, iconColor: colors.white, border: '#000000' },
  google: { label: 'Google', bg: colors.surface, fg: colors.text, iconColor: '#4285F4', border: colors.line },
  facebook: { label: 'Facebook', bg: colors.surface, fg: colors.text, iconColor: '#1877F2', border: colors.line },
} as const;

export function SocialButton({ provider, onPress }: { provider: keyof typeof PROVIDERS; onPress: () => void }) {
  const p = PROVIDERS[provider];
  const label = `Tiếp tục với ${p.label}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ height: 52, borderRadius: 18, borderWidth: 1.5, borderColor: p.border, backgroundColor: p.bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <Icon name={provider} size={20} color={p.iconColor} />
      <AppText variant="bodyStrong" color={p.fg}>{label}</AppText>
    </Pressable>
  );
}

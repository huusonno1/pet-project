import { Image } from 'expo-image';
import { View } from 'react-native';

import { AppText } from './AppText';
import { colors } from './theme';
import { imageCacheKey } from '@/lib/image-cache';

const TONES = {
  rose: { bg: colors.roseSoft, fg: colors.roseStrong },
  lavender: { bg: colors.lavender, fg: colors.lavenderInk },
  peach: { bg: colors.peachSoft, fg: colors.peachInk },
};

type Props = { name: string; tone?: keyof typeof TONES; size?: number; uri?: string | null; ring?: boolean };

export function Avatar({ name, tone = 'rose', size = 48, uri, ring }: Props) {
  const t = TONES[tone];
  const box = { width: size, height: size, borderRadius: size / 2, borderWidth: ring ? 3 : 0, borderColor: colors.white };
  if (uri) {
    return <Image source={{ uri, cacheKey: imageCacheKey(uri) }} style={box} contentFit="cover" accessibilityLabel={name} />;
  }
  return (
    <View accessibilityLabel={name} style={[box, { backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }]}>
      <AppText variant="bodyStrong" color={t.fg} style={{ fontSize: Math.round(size * 0.38), lineHeight: Math.round(size * 0.5) }}>
        {name.trim().charAt(0).toUpperCase()}
      </AppText>
    </View>
  );
}

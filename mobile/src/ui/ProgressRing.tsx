import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { View } from 'react-native';

import { AppText } from './AppText';
import { colors, fonts } from './theme';

export function ProgressRing({ progress, size = 170, label, sub }: { progress: number; size?: number; label: string; sub: string }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const track = Skia.Path.Make();
  track.addCircle(size / 2, size / 2, r);
  const arc = Skia.Path.Make();
  arc.addArc({ x: stroke / 2, y: stroke / 2, width: size - stroke, height: size - stroke }, -90, 360 * Math.max(0, Math.min(1, progress)));
  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        <Path path={track} style="stroke" strokeWidth={stroke} color={colors.roseSoft} />
        <Path path={arc} style="stroke" strokeWidth={stroke} strokeCap="round" color={colors.rose} />
      </Canvas>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <AppText color={colors.cycle} style={{ fontFamily: fonts.extrabold, fontSize: 48, lineHeight: 52 }}>{label}</AppText>
        <AppText variant="caption" color={colors.textMuted}>{sub}</AppText>
      </View>
    </View>
  );
}

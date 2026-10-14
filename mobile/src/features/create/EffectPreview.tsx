import { Blur, Canvas, ColorMatrix, Image, useImage } from '@shopify/react-native-skia';
import { View } from 'react-native';

import { AppText } from '@/ui/AppText';
import { Icon } from '@/ui/Icon';
import { colors, fonts } from '@/ui/theme';

import { blurSigma, bunnyEars, colorMatrix, Composition, heartSpots, sparkleSpots, stampText } from './effects';

/** Xem trước: màu/mờ bằng Skia, trang trí bằng View chồng lên (ảnh lưu thật do render-effects vẽ). */
export function EffectPreview({ uri, composition: c, size }: { uri: string; composition: Composition; size: number }) {
  const image = useImage(uri);
  const sigma = blurSigma(c.effect) * (size / 1000) * 3;
  return (
    <View style={{ width: size, height: size, borderRadius: 56, overflow: 'hidden', backgroundColor: colors.roseSoft }}>
      <Canvas style={{ width: size, height: size }}>
        {image ? (
          <Image image={image} x={0} y={0} width={size} height={size} fit="cover">
            <ColorMatrix matrix={colorMatrix(c.effect)} />
            {sigma > 0 ? <Blur blur={sigma} /> : null}
          </Image>
        ) : null}
      </Canvas>
      {(c.effect === 'HEARTS' || c.hearts) && heartSpots(size, size).map((s, i) => (
        <View key={`h${i}`} style={{ position: 'absolute', left: s.x, top: s.y, opacity: s.opacity }}><Icon name="heartFilled" size={s.size} color={colors.white} /></View>
      ))}
      {c.effect === 'SPARKLE' && sparkleSpots(size, size).map((s, i) => (
        <View key={`s${i}`} style={{ position: 'absolute', left: s.x, top: s.y, opacity: s.opacity }}><Icon name="sparkles" size={s.size} color={colors.white} /></View>
      ))}
      {c.effect === 'BUNNY' && bunnyEars(size, size).map((e, i) => (
        <View key={`b${i}`} style={{ position: 'absolute', left: e.cx - e.rx, top: e.cy - e.ry, width: e.rx * 2, height: e.ry * 2, borderRadius: e.rx, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: e.rx, height: e.ry * 1.4, borderRadius: e.rx / 2, backgroundColor: '#F7A8CC' }} />
        </View>
      ))}
      {c.stamp && c.date ? (
        <View style={{ position: 'absolute', right: 22, top: 22, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 2, borderColor: colors.white }}>
          <AppText color={colors.white} style={{ fontFamily: fonts.extrabold, fontSize: 13 }}>{stampText(c.date)}</AppText>
        </View>
      ) : null}
      {c.caption.trim() ? (
        <View style={{ position: 'absolute', bottom: size * 0.12, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <AppText variant="bodyStrong" color={colors.white}>{c.caption.trim()}</AppText>
        </View>
      ) : null}
    </View>
  );
}

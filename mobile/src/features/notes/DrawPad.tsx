import { Canvas, Path } from '@shopify/react-native-skia';
import { useRef } from 'react';
import { View } from 'react-native';

import { colors } from '@/ui/theme';

import { PEN_WIDTH, Stroke, strokeToPath } from './drawing';

type Props = { strokes: Stroke[]; onChange: (s: Stroke[]) => void; color: string; size: number };

export function DrawPad({ strokes, onChange, color, size }: Props) {
  const current = useRef<Stroke | null>(null);
  const latest = useRef(strokes);
  latest.current = strokes;

  return (
    <View
      accessibilityLabel="Vùng vẽ"
      style={{ width: size, height: size, borderRadius: 20, backgroundColor: colors.surface, overflow: 'hidden' }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        current.current = { color, points: [{ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }] };
        onChange([...latest.current, current.current]);
      }}
      onResponderMove={(e) => {
        if (!current.current) return;
        current.current = { ...current.current, points: [...current.current.points, { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }] };
        onChange([...latest.current.slice(0, -1), current.current]);
      }}
      onResponderRelease={() => {
        current.current = null;
      }}>
      <Canvas style={{ flex: 1 }} pointerEvents="none">
        {strokes.map((s, i) => (
          <Path key={i} path={strokeToPath(s.points)} color={s.color} style="stroke" strokeWidth={PEN_WIDTH} strokeCap="round" strokeJoin="round" />
        ))}
      </Canvas>
    </View>
  );
}

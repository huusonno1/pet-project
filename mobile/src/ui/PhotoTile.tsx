import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, View, ViewStyle } from 'react-native';

import { gradientFor } from './theme';

type Props = { uri?: string | null; seed: string; style?: StyleProp<ViewStyle>; children?: React.ReactNode; testID?: string };

/** Ảnh thật nếu có, nếu không là gradient giữ chỗ cố định theo `seed`. */
export function PhotoTile({ uri, seed, style, children, testID }: Props) {
  return (
    <View testID={testID} style={[{ overflow: 'hidden', borderRadius: 20 }, style]}>
      {uri ? (
        <Image source={{ uri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
      ) : (
        <LinearGradient colors={gradientFor(seed)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      )}
      {children}
    </View>
  );
}

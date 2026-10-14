import { StyleProp, View, ViewStyle } from 'react-native';

import { colors, shadow } from './theme';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: colors.surface, borderRadius: 24, padding: 16, gap: 12 }, shadow.card, style]}>{children}</View>;
}

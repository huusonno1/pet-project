import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from './theme';

type Props = { children: React.ReactNode; scroll?: boolean; padded?: boolean; bottomPad?: number; gap?: number };

export function Screen({ children, scroll = true, padded = true, bottomPad = 24, gap = 14 }: Props) {
  const insets = useSafeAreaInsets();
  const content = { paddingTop: insets.top + 8, paddingHorizontal: padded ? 24 : 0, paddingBottom: bottomPad, gap };
  return scroll ? (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, backgroundColor: colors.bg }, content]}>{children}</View>
  );
}

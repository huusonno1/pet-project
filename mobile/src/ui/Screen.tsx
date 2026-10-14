import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardScrollView } from './KeyboardScrollView';
import { colors } from './theme';

type Props = { children: React.ReactNode; scroll?: boolean; padded?: boolean; bottomPad?: number; gap?: number };

export function Screen({ children, scroll = true, padded = true, bottomPad = 24, gap = 14 }: Props) {
  const insets = useSafeAreaInsets();
  const content = { paddingTop: insets.top + 8, paddingHorizontal: padded ? 24 : 0, paddingBottom: bottomPad, gap };
  return scroll ? (
    <KeyboardScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={content}>
      {children}
    </KeyboardScrollView>
  ) : (
    <View style={[{ flex: 1, backgroundColor: colors.bg }, content]}>{children}</View>
  );
}

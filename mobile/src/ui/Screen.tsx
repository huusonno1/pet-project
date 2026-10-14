import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from './theme';

type Props = { children: React.ReactNode; scroll?: boolean; padded?: boolean; bottomPad?: number; gap?: number };

export function Screen({ children, scroll = true, padded = true, bottomPad = 24, gap = 14 }: Props) {
  const insets = useSafeAreaInsets();
  const content = { paddingTop: insets.top + 8, paddingHorizontal: padded ? 24 : 0, paddingBottom: bottomPad, gap };
  return scroll ? (
    // Bàn phím mở → tự cuộn ô đang nhập lên trên bàn phím để người dùng thấy mình gõ gì.
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}>
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View style={[{ flex: 1, backgroundColor: colors.bg }, content]}>{children}</View>
  );
}

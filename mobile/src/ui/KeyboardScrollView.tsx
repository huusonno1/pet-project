import { Platform, ScrollView, ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { useKeyboardInset } from './useKeyboardInset';

/**
 * ScrollView không bị bàn phím che, không thêm khoảng trắng thừa:
 * - iOS: inset gốc của hệ điều hành — chỉ chừa đúng phần bị bàn phím đè và tự cuộn tới ô đang nhập.
 * - Android: co vùng cuộn đúng bằng chiều cao bàn phím; ScrollView gốc tự cuộn ô đang focus vào tầm nhìn.
 */
export function KeyboardScrollView({ style, ...props }: ScrollViewProps & { style?: StyleProp<ViewStyle> }) {
  if (Platform.OS === 'ios') {
    return (
      <ScrollView
        style={[{ flex: 1 }, style]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        {...props}
      />
    );
  }
  return <AndroidKeyboardScroll style={style} {...props} />;
}

function AndroidKeyboardScroll({ style, ...props }: ScrollViewProps & { style?: StyleProp<ViewStyle> }) {
  const inset = useKeyboardInset();
  return (
    <Animated.View style={[{ flex: 1 }, style, inset]}>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" {...props} />
    </Animated.View>
  );
}

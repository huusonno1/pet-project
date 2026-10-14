import { Platform, ScrollView, ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

/**
 * ScrollView không bị bàn phím che, không thêm khoảng trắng thừa:
 * - iOS: inset gốc của hệ điều hành — chỉ chừa đúng phần bị bàn phím đè và tự cuộn tới ô đang nhập.
 * - Android: co vùng cuộn lại phía trên bàn phím; ScrollView gốc tự cuộn ô đang focus vào tầm nhìn.
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
  return (
    <KeyboardAvoidingView behavior="padding" style={[{ flex: 1 }, style]}>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" {...props} />
    </KeyboardAvoidingView>
  );
}

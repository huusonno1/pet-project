import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './AppText';
import { colors } from './theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  testID?: string;
};

export function Sheet({ visible, onClose, title, subtitle, right, children, testID }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {/* Bàn phím mở → đẩy cả sheet lên và cuộn tới ô đang nhập (cả iOS lẫn Android). */}
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <Pressable testID="sheet-scrim" accessibilityLabel="Đóng" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View testID={testID} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 18 }]}>
          <View style={styles.grabber} />
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppText variant="h2">{title}</AppText>
                {subtitle ? <AppText variant="caption" color={colors.textMuted}>{subtitle}</AppText> : null}
              </View>
              {right}
            </View>
          ) : null}
          <KeyboardAwareScrollView bounces={false} keyboardShouldPersistTaps="handled" bottomOffset={24} contentContainerStyle={{ gap: 14 }}>
            {children}
          </KeyboardAwareScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: { maxHeight: '92%', backgroundColor: colors.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 12, gap: 14 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line },
});

import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors, fonts } from './theme';

type Props = TextInputProps & { label: string; error?: string | null };

export function TextField({ label, error, style, multiline, secureTextEntry, ...input }: Props) {
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" color={colors.textMuted}>{label}</AppText>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          secureTextEntry={secureTextEntry && !revealed}
          style={[styles.input, multiline && styles.multi, secureTextEntry && styles.withToggle, !!error && { borderColor: colors.danger }, style]}
          {...input}
        />
        {secureTextEntry ? (
          // Ô mật khẩu: nút mắt để xem lại mình đã gõ đúng chưa.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            onPress={() => setRevealed((v) => !v)}
            hitSlop={8}
            style={styles.toggle}>
            <Icon name={revealed ? 'eyeOff' : 'eye'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <AppText variant="caption" color={colors.danger}>{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 48, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  multi: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
  withToggle: { paddingRight: 48 },
  toggle: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 48, alignItems: 'center', justifyContent: 'center' },
});

import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { AppText } from './AppText';
import { colors, fonts } from './theme';

type Props = TextInputProps & { label: string; error?: string | null };

export function TextField({ label, error, style, multiline, ...input }: Props) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" color={colors.textMuted}>{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[styles.input, multiline && styles.multi, !!error && { borderColor: colors.danger }, style]}
        {...input}
      />
      {error ? <AppText variant="caption" color={colors.danger}>{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 48, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  multi: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
});

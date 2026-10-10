import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { ErrorText } from './ErrorText';
import { colors, radius, spacing } from './theme';

type Props = TextInputProps & { label: string; error?: string | null };

export function TextField({ label, error, style, ...input }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, input.multiline && styles.multiline, error ? styles.inputError : null, style]}
        {...input}
      />
      <ErrorText message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: '500', marginBottom: spacing.xs },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 16,
  },
  multiline: { minHeight: 96, paddingTop: spacing.sm, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
});

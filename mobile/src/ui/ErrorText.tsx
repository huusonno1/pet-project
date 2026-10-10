import { StyleSheet, Text } from 'react-native';

import { colors, spacing } from './theme';

export function ErrorText({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: { color: colors.danger, marginTop: spacing.xs, fontSize: 13 },
});

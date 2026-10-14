import { AppText } from './AppText';
import { colors } from './theme';

export function ErrorText({ message }: { message?: string | null }) {
  if (!message) return null;
  return <AppText variant="caption" color={colors.danger} accessibilityRole="alert">{message}</AppText>;
}

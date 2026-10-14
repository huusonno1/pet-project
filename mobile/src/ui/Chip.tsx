import { Pressable, StyleSheet } from 'react-native';

import { AppText } from './AppText';
import { colors } from './theme';

export function Chip({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.on : styles.off]}>
      <AppText variant="captionStrong" color={selected ? colors.white : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.roseStrong, borderColor: colors.roseStrong },
  off: { backgroundColor: colors.surface, borderColor: colors.line },
});

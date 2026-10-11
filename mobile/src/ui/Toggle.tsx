import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from './theme';

export function Toggle({ value, onValueChange, label }: { value: boolean; onValueChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      style={[styles.track, { backgroundColor: value ? colors.roseStrong : colors.toggleOff }]}>
      <View style={[styles.knob, { left: value ? 24 : 4 }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 50, height: 30, borderRadius: 15 },
  knob: { position: 'absolute', top: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
});

import { Pressable, View } from 'react-native';

import { AppText } from './AppText';
import { colors, shadow } from './theme';

type Props<T extends string> = { options: { key: T; label: string }[]; value: T; onChange: (key: T) => void };

export function SegmentedTabs<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: colors.surfaceMuted }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={[{ flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, on && { backgroundColor: colors.surface, ...shadow.card }]}>
            <AppText variant={on ? 'bodyStrong' : 'captionStrong'} color={on ? colors.text : colors.textMuted}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

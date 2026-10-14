import { Pressable, View } from 'react-native';

import type { Recurrence } from '@/lib/api/types';
import { WEEKDAYS, weekdayIndex } from '@/lib/calendar';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { colors } from '@/ui/theme';

import { alignToWeekday, recurrenceSummary } from './occurrence';

const TITLES: Record<Recurrence, string> = { NONE: 'Không lặp lại', WEEKLY: 'Hằng tuần', MONTHLY: 'Hằng tháng', YEARLY: 'Hằng năm' };

type Props = {
  visible: boolean;
  value: Recurrence;
  date: string;
  options: Recurrence[];
  onChange: (r: Recurrence, date: string) => void;
  onClose: () => void;
};

export function RepeatSheet({ visible, value, date, options, onChange, onClose }: Props) {
  const weekday = weekdayIndex(date);
  return (
    <Sheet visible={visible} onClose={onClose} title="Lặp lại">
      <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
        {options.map((r) => {
          const on = r === value;
          return (
            <Pressable key={r} accessibilityRole="radio" accessibilityLabel={TITLES[r]} accessibilityState={{ checked: on }}
              onPress={() => onChange(r, date)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: on ? colors.rose : 'transparent', backgroundColor: on ? colors.roseSoft : colors.surface }}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{TITLES[r]}</AppText>
                <AppText variant="caption" color={colors.textMuted}>{recurrenceSummary(r, date)}</AppText>
              </View>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? colors.roseStrong : colors.toggleOff, backgroundColor: on ? colors.roseStrong : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {on ? <Icon name="check" size={14} color={colors.white} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {value === 'WEEKLY' ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {WEEKDAYS.map((w, i) => (
            <Pressable key={w} accessibilityRole="button" accessibilityLabel={`Lặp vào ${w}`} accessibilityState={{ selected: i === weekday }}
              onPress={() => onChange('WEEKLY', alignToWeekday(date, i))}
              style={{ flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: i === weekday ? colors.roseStrong : colors.surface }}>
              <AppText variant="captionStrong" color={i === weekday ? colors.white : colors.text}>{w}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Button title="Xong" onPress={onClose} />
    </Sheet>
  );
}

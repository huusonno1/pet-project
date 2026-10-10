import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, pad, parseIsoDate, toIsoDate } from '@/lib/format';

import { colors, radius, spacing } from './theme';

type Props = {
  label: string;
  /** YYYY-MM-DD khi mode="date", HH:mm khi mode="time". */
  value: string | null;
  mode?: 'date' | 'time';
  onChange: (value: string) => void;
  placeholder?: string;
};

function timeToDate(value: string): Date {
  const [h, m] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function DateField({ label, value, mode = 'date', onChange, placeholder = 'Chọn' }: Props) {
  const [open, setOpen] = useState(false);
  const current = value ? (mode === 'date' ? parseIsoDate(value) : timeToDate(value)) : new Date();
  const display = value ? (mode === 'date' ? formatDate(value) : value) : placeholder;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={styles.input}>
        <Text style={value ? styles.value : styles.placeholder}>{display}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={current}
          mode={mode}
          is24Hour
          onValueChange={(_event, date) => {
            setOpen(false);
            onChange(mode === 'date' ? toIsoDate(date) : `${pad(date.getHours())}:${pad(date.getMinutes())}`);
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
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
    justifyContent: 'center',
  },
  value: { color: colors.text, fontSize: 16 },
  placeholder: { color: colors.muted, fontSize: 16 },
});

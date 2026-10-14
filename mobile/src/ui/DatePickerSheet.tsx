import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { monthGrid, monthLabel, shiftMonth, WEEKDAYS } from '@/lib/calendar';
import { pad, toIsoDate } from '@/lib/format';

import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { colors, fonts, shadow } from './theme';

type Props = {
  visible: boolean;
  title: string;
  value: string | null;
  mode?: 'date' | 'datetime' | 'time';
  time?: string | null;
  quick?: boolean;
  maxDate?: string;
  onConfirm: (date: string, time: string | null) => void;
  onClose: () => void;
};

export function DatePickerSheet({ visible, title, value, mode = 'date', time, quick = true, maxDate, onConfirm, onClose }: Props) {
  const today = toIsoDate(new Date());
  const [sel, setSel] = useState(value ?? today);
  const [view, setView] = useState({ year: 0, month: 0 });
  // Bấm vào "Tháng X, YYYY" → chọn năm → chọn tháng → quay về lưới ngày (khỏi bấm < > hàng chục lần).
  const [pane, setPane] = useState<'days' | 'years' | 'months'>('days');
  const [hour, setHour] = useState('19');
  const [minute, setMinute] = useState('00');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const start = value ?? today;
    setSel(start);
    setView({ year: Number(start.slice(0, 4)), month: Number(start.slice(5, 7)) });
    setHour(time?.slice(0, 2) ?? '19');
    setMinute(time?.slice(3, 5) ?? '00');
    setError(null);
    setPane('days');
  }, [visible, value, time, today]);

  function pick(iso: string) {
    if (maxDate && iso > maxDate) return;
    setSel(iso);
    setView({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) });
  }

  function confirm() {
    if (mode === 'date') {
      onConfirm(sel, null);
      return;
    }
    const h = Number(hour);
    const m = Number(minute);
    if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute) || h > 23 || m > 59) {
      setError('Giờ không hợp lệ');
      return;
    }
    onConfirm(sel, `${pad(h)}:${pad(m)}`);
  }

  const maxYear = maxDate ? Number(maxDate.slice(0, 4)) : Number(today.slice(0, 4)) + 10;
  const maxMonthKey = maxDate ? maxDate.slice(0, 7) : null;
  const years = Array.from({ length: maxYear - MIN_YEAR + 1 }, (_, i) => maxYear - i);
  const firstOfMonth = `${today.slice(0, 8)}01`;
  const yesterday = toIsoDate(new Date(Date.now() - 86_400_000));

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {mode !== 'time' ? (
        <>
          <View style={styles.nav}>
            <Pressable accessibilityRole="button" accessibilityLabel="Chọn tháng và năm" style={styles.monthChip}
              onPress={() => setPane(pane === 'days' ? 'years' : 'days')}>
              <AppText variant="bodyStrong">{monthLabel(view.year, view.month)}</AppText>
              <Icon name="chevronDown" size={16} />
            </Pressable>
            {pane === 'days' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable accessibilityRole="button" accessibilityLabel="Tháng trước" style={styles.arrow}
                  onPress={() => setView(shiftMonth(view.year, view.month, -1))}>
                  <Icon name="back" size={18} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Tháng sau" style={styles.arrow}
                  onPress={() => setView(shiftMonth(view.year, view.month, 1))}>
                  <Icon name="chevronRight" size={18} />
                </Pressable>
              </View>
            ) : null}
          </View>
          {pane === 'years' ? (
            <ScrollView style={styles.panel} nestedScrollEnabled
              contentOffset={{ x: 0, y: Math.max(0, Math.floor(years.indexOf(view.year) / 4) * YEAR_ROW - YEAR_ROW * 2) }}
              contentContainerStyle={styles.pickGrid}>
              {years.map((y) => (
                <Pressable key={y} accessibilityRole="button" accessibilityLabel={`Năm ${y}`} accessibilityState={{ selected: y === view.year }}
                  onPress={() => {
                    setView({ year: y, month: maxMonthKey && `${y}-${pad(view.month)}` > maxMonthKey ? Number(maxMonthKey.slice(5, 7)) : view.month });
                    setPane('months');
                  }}
                  style={[styles.pick, { width: '25%' }]}>
                  <View style={[styles.pickInner, y === view.year && styles.dayOn]}>
                    <AppText variant={y === view.year ? 'bodyStrong' : 'body'} color={y === view.year ? colors.white : colors.text}>{y}</AppText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : pane === 'months' ? (
            <View style={[styles.panel, styles.pickGrid]}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => {
                const disabled = !!maxMonthKey && `${view.year}-${pad(mo)}` > maxMonthKey;
                const on = mo === view.month;
                return (
                  <Pressable key={mo} accessibilityRole="button" accessibilityLabel={`Tháng ${mo}`} accessibilityState={{ selected: on, disabled }}
                    disabled={disabled} onPress={() => { setView({ year: view.year, month: mo }); setPane('days'); }}
                    style={[styles.pick, { width: `${100 / 3}%` }, disabled && { opacity: 0.3 }]}>
                    <View style={[styles.pickInner, on && styles.dayOn]}>
                      <AppText variant={on ? 'bodyStrong' : 'body'} color={on ? colors.white : colors.text}>Tháng {mo}</AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.grid}>
              {WEEKDAYS.map((w) => (
                <AppText key={w} variant="micro" color={w === 'CN' ? colors.roseStrong : colors.textMuted} style={styles.weekday}>{w}</AppText>
              ))}
              {monthGrid(view.year, view.month).map((c, i) => {
                if (!c.iso) return <View key={`e${i}`} style={styles.cell} />;
                const on = c.iso === sel;
                const disabled = !!maxDate && c.iso > maxDate;
                return (
                  <View key={c.iso} style={styles.cell}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ngày ${c.day}`}
                      accessibilityState={{ selected: on, disabled }}
                      disabled={disabled}
                      onPress={() => pick(c.iso!)}
                      style={[styles.day, on && styles.dayOn, disabled && { opacity: 0.3 }]}>
                      <AppText variant={on ? 'bodyStrong' : 'body'} color={on ? colors.white : c.weekday === 6 ? colors.roseStrong : colors.text}>
                        {c.day}
                      </AppText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : null}

      {mode !== 'date' ? (
        <View style={styles.timeRow}>
          <Icon name="clock" size={20} color={colors.textMuted} />
          <AppText variant="bodyStrong" style={{ flex: 1 }}>Giờ</AppText>
          <TextInput accessibilityLabel="Giờ" value={hour} onChangeText={setHour} keyboardType="number-pad" maxLength={2} style={styles.timeBox} />
          <AppText variant="h2">:</AppText>
          <TextInput accessibilityLabel="Phút" value={minute} onChangeText={setMinute} keyboardType="number-pad" maxLength={2} style={styles.timeBox} />
        </View>
      ) : null}
      {error ? <AppText variant="caption" color={colors.danger}>{error}</AppText> : null}

      {quick && mode !== 'time' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Hôm nay" selected={sel === today} onPress={() => pick(today)} />
          <Chip label="Hôm qua" selected={sel === yesterday} onPress={() => pick(yesterday)} />
          <Chip label="Đầu tháng này" selected={sel === firstOfMonth} onPress={() => pick(firstOfMonth)} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Huỷ" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button title="Xác nhận" onPress={confirm} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

const MIN_YEAR = 1940;
const YEAR_ROW = 48;

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthChip: { height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.surfaceMuted, flexDirection: 'row', alignItems: 'center', gap: 6 },
  panel: { maxHeight: 300, backgroundColor: colors.surface, borderRadius: 24, ...shadow.card },
  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8, paddingHorizontal: 8 },
  pick: { height: YEAR_ROW, alignItems: 'center', justifyContent: 'center' },
  pickInner: { paddingHorizontal: 12, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.surface, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 8, ...shadow.card },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', paddingBottom: 6 },
  cell: { width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.roseStrong },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 20, backgroundColor: colors.surface },
  timeBox: { width: 54, height: 42, borderRadius: 12, backgroundColor: colors.roseSoft, textAlign: 'center', fontFamily: fonts.bold, fontSize: 20, color: colors.roseStrong },
});

import { pad, parseIsoDate, toIsoDate } from './format';

export type DayCell = { iso: string | null; day: number | null; weekday: number };

export const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY_NAMES = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

/** Lưới tháng bắt đầu từ Thứ Hai, đủ số tuần (5 hoặc 6 hàng). month: 1–12. */
export function monthGrid(year: number, month: number): DayCell[] {
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const total = Math.ceil((offset + days) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const d = i - offset + 1;
    const inMonth = d >= 1 && d <= days;
    return { iso: inMonth ? toIsoDate(new Date(year, month - 1, d)) : null, day: inMonth ? d : null, weekday: i % 7 };
  });
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function monthLabel(year: number, month: number): string {
  return `Tháng ${month}, ${year}`;
}

/** 0 = Thứ Hai … 6 = Chủ Nhật. */
export function weekdayIndex(iso: string): number {
  return (parseIsoDate(iso).getDay() + 6) % 7;
}

export function weekdayName(iso: string): string {
  return WEEKDAY_NAMES[weekdayIndex(iso)];
}

export function dayMonth(iso: string): string {
  const d = parseIsoDate(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

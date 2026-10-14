import type { Moment, Recurrence } from '@/lib/api/types';
import { weekdayIndex, weekdayName } from '@/lib/calendar';
import { daysBetween, parseIsoDate, toIsoDate } from '@/lib/format';

/** Ngày hợp lệ gần nhất: 29/02 ở năm không nhuận → 28/02. */
function safeDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, lastDay));
}

/** Lần diễn ra kế tiếp (YYYY-MM-DD) tính từ hôm nay, hoặc null nếu đã qua và không lặp. */
export function nextOccurrence(m: Moment, today: Date): string | null {
  const todayIso = toIsoDate(today);
  if (m.occursOn >= todayIso) return m.occursOn;
  const [y, month, day] = m.occursOn.split('-').map(Number);
  if (m.recurrence === 'WEEKLY') {
    const gap = daysBetween(m.occursOn, today);
    const start = parseIsoDate(m.occursOn);
    start.setDate(start.getDate() + Math.ceil(gap / 7) * 7);
    return toIsoDate(start);
  }
  if (m.recurrence === 'MONTHLY') {
    for (let k = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - month); k < 1200; k++) {
      const candidate = toIsoDate(safeDate(y, month + k, day));
      if (candidate >= todayIso) return candidate;
    }
    return null;
  }
  if (m.recurrence === 'YEARLY' || m.type === 'ANNIVERSARY') {
    for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
      const candidate = toIsoDate(safeDate(year, month, day));
      if (candidate >= todayIso) return candidate;
    }
  }
  return null;
}

export function recurrenceSummary(r: Recurrence, dateIso: string): string {
  const [, mm, dd] = dateIso.split('-');
  switch (r) {
    case 'WEEKLY':
      return `Mỗi ${weekdayName(dateIso)}`;
    case 'MONTHLY':
      return `Ngày ${Number(dd)} mỗi tháng`;
    case 'YEARLY':
      return `${dd}/${mm} mỗi năm`;
    default:
      return 'Chỉ nhắc một lần';
  }
}

/** Ngày gần nhất từ `dateIso` trở đi rơi vào `weekday` (0 = Thứ Hai). */
export function alignToWeekday(dateIso: string, weekday: number): string {
  const d = parseIsoDate(dateIso);
  d.setDate(d.getDate() + ((weekday - weekdayIndex(dateIso) + 7) % 7));
  return toIsoDate(d);
}

export function upcomingMoments(list: Moment[], today: Date, limit: number) {
  const todayIso = toIsoDate(today);
  return list
    .filter((m) => m.type !== 'CYCLE')
    .map((m) => ({ moment: m, date: nextOccurrence(m, today) }))
    .filter((x): x is { moment: Moment; date: string } => x.date !== null)
    .map((x) => ({ ...x, daysLeft: daysBetween(todayIso, parseIsoDate(x.date)) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

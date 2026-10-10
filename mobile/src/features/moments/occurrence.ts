import type { Moment } from '@/lib/api/types';
import { daysBetween, parseIsoDate, toIsoDate } from '@/lib/format';

/** Ngày hợp lệ gần nhất: 29/02 ở năm không nhuận → 28/02. */
function safeDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, lastDay));
}

/** Lần diễn ra kế tiếp (YYYY-MM-DD) tính từ hôm nay, hoặc null nếu đã qua và không lặp. */
export function nextOccurrence(m: Moment, today: Date): string | null {
  const todayIso = toIsoDate(today);
  const yearly = m.recurrence === 'YEARLY' || m.type === 'ANNIVERSARY';
  if (!yearly) {
    return m.occursOn >= todayIso ? m.occursOn : null;
  }
  if (m.occursOn >= todayIso) {
    return m.occursOn;
  }
  const [, month, day] = m.occursOn.split('-').map(Number);
  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    const candidate = toIsoDate(safeDate(year, month, day));
    if (candidate >= todayIso) return candidate;
  }
  return null;
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

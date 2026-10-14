import { daysBetween, toIsoDate } from '@/lib/format';

/** Mốc tròn 100 ngày tiếp theo và tiến độ trong khoảng 100 ngày hiện tại. */
export function nextHundred(days: number): { target: number; daysLeft: number; progress: number } {
  const target = (Math.floor(days / 100) + 1) * 100;
  return { target, daysLeft: target - days, progress: (days % 100) / 100 };
}

function birthdayIn(year: number, month: number, day: number): Date {
  const last = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, last));
}

/** Số ngày tới sinh nhật kế tiếp (0 = hôm nay); 29/02 ở năm không nhuận tính là 28/02. */
export function daysUntilBirthday(birthdayIso: string, today: Date): number {
  const [, m, d] = birthdayIso.split('-').map(Number);
  const todayIso = toIsoDate(today);
  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    const candidate = toIsoDate(birthdayIn(year, m, d));
    if (candidate >= todayIso) return -daysBetween(candidate, today);
  }
  return 0;
}

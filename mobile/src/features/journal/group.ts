import type { Moment, MomentType } from '@/lib/api/types';
import { dayMonth, weekdayName } from '@/lib/calendar';

export type JournalFilter = 'ALL' | 'MOMENT' | 'MILESTONE' | 'DATE' | 'GIFT';
export type DayGroup = { date: string; moments: Moment[] };
export type Position = { item: number; photo: number };

const FILTER_TYPES: Record<Exclude<JournalFilter, 'ALL'>, MomentType[]> = {
  MOMENT: ['MOMENT'],
  MILESTONE: ['ANNIVERSARY', 'CUSTOM'],
  DATE: ['DATE_PLAN'],
  GIFT: ['GIFT_OCCASION'],
};

/** Nhật ký chỉ gồm kỷ niệm đã diễn ra (≤ hôm nay), không gồm chu kỳ. */
export function journalMoments(list: Moment[], todayIso: string, filter: JournalFilter = 'ALL'): Moment[] {
  return list.filter((m) => m.type !== 'CYCLE' && m.occursOn <= todayIso && (filter === 'ALL' || FILTER_TYPES[filter].includes(m.type)));
}

export function groupByDay(list: Moment[]): DayGroup[] {
  const map = new Map<string, Moment[]>();
  for (const m of list) map.set(m.occursOn, [...(map.get(m.occursOn) ?? []), m]);
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, moments]) => ({ date, moments: [...moments].sort((x, y) => x.createdAt.localeCompare(y.createdAt)) }));
}

export function countByDay(list: Moment[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of list) out[m.occursOn] = (out[m.occursOn] ?? 0) + 1;
  return out;
}

export function dayLabel(iso: string): string {
  return `${weekdayName(iso)}, ${dayMonth(iso)}`;
}

/** Như story: qua hết ảnh của một kỷ niệm rồi mới sang kỷ niệm kế; kỷ niệm không ảnh tính là một trang. */
export function step(items: Moment[], pos: Position, dir: 1 | -1): Position {
  const photos = (i: number) => Math.max(1, items[i].media.length);
  if (dir === 1) {
    if (pos.photo < photos(pos.item) - 1) return { item: pos.item, photo: pos.photo + 1 };
    if (pos.item < items.length - 1) return { item: pos.item + 1, photo: 0 };
    return pos;
  }
  if (pos.photo > 0) return { item: pos.item, photo: pos.photo - 1 };
  if (pos.item > 0) return { item: pos.item - 1, photo: 0 };
  return pos;
}

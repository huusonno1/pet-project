export const OFFSET_PRESETS = ['P30D', 'P14D', 'P7D', 'P3D', 'P1D', 'P0D', 'PT2H', 'PT1H'];
export const MAX_OFFSETS = 5;

function seconds(iso: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60;
}

export function offsetLabel(iso: string): string {
  const days = /^P(\d+)D$/.exec(iso);
  if (days) return days[1] === '0' ? 'Đúng ngày' : `Trước ${days[1]} ngày`;
  const hours = /^PT(\d+)H$/.exec(iso);
  if (hours) return `Trước ${hours[1]} giờ`;
  const minutes = /^PT(\d+)M$/.exec(iso);
  if (minutes) return `Trước ${minutes[1]} phút`;
  return iso;
}

/** Bật/tắt một mốc nhắc; danh sách sắp xếp từ xa đến gần sự kiện. */
export function toggleOffset(list: string[], iso: string): { list: string[]; error: string | null } {
  if (list.includes(iso)) return { list: list.filter((x) => x !== iso), error: null };
  if (list.length >= MAX_OFFSETS) return { list, error: `Tối đa ${MAX_OFFSETS} lần nhắc` };
  return { list: [...list, iso].sort((a, b) => seconds(b) - seconds(a)), error: null };
}

export function parseMilestones(text: string): { days: number[]; error: string | null } {
  const parts = text.split(/[,\s]+/).filter(Boolean);
  const days = parts.map(Number);
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 36500)) {
    return { days: [], error: 'Mốc ngày phải là số nguyên từ 1 đến 36500' };
  }
  const unique = [...new Set(days)].sort((a, b) => a - b);
  if (unique.length > 20) return { days: [], error: 'Tối đa 20 mốc ngày' };
  return { days: unique, error: null };
}

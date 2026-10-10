import type { MomentType } from '@/lib/api/types';

export const TYPE_LABELS: Record<MomentType, string> = {
  ANNIVERSARY: 'Kỷ niệm',
  DATE_PLAN: 'Lịch hẹn',
  GIFT_OCCASION: 'Dịp tặng quà',
  CYCLE: 'Chu kỳ',
  CUSTOM: 'Khác',
};

export const CREATABLE_TYPES: MomentType[] = ['ANNIVERSARY', 'DATE_PLAN', 'GIFT_OCCASION', 'CUSTOM'];

/** Dịp tặng quà gợi ý sẵn; monthDay = MM-DD nếu là ngày cố định hằng năm. */
export const OCCASIONS: { code: string; label: string; monthDay: string | null }[] = [
  { code: 'BIRTHDAY', label: 'Sinh nhật', monthDay: null },
  { code: 'VALENTINE', label: 'Valentine 14/2', monthDay: '02-14' },
  { code: 'WOMENS_DAY_8_3', label: 'Quốc tế Phụ nữ 8/3', monthDay: '03-08' },
  { code: 'WOMENS_DAY_20_10', label: 'Phụ nữ Việt Nam 20/10', monthDay: '10-20' },
  { code: 'CHRISTMAS', label: 'Giáng sinh 24/12', monthDay: '12-24' },
  { code: 'OTHER', label: 'Dịp khác', monthDay: null },
];

export function daysLeftLabel(days: number): string {
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Ngày mai';
  return `Còn ${days} ngày`;
}

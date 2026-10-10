import {
  combineDateTime,
  daysBetween,
  formatDate,
  formatKm,
  timeAgo,
  toIsoDate,
} from '@/lib/format';

describe('format', () => {
  test('toIsoDate uses local calendar date', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  test('formatDate renders dd/MM/yyyy', () => {
    expect(formatDate('2026-03-08')).toBe('08/03/2026');
  });

  test('daysBetween counts calendar days', () => {
    expect(daysBetween('2025-02-14', new Date(2025, 4, 25, 15, 0))).toBe(100);
    expect(daysBetween('2025-02-14', new Date(2025, 1, 14))).toBe(0);
  });

  test('formatKm picks a readable unit', () => {
    expect(formatKm(null)).toBe('—');
    expect(formatKm(0.35)).toBe('350 m');
    expect(formatKm(12.34)).toBe('12,3 km');
    expect(formatKm(1137.4)).toBe('1.137 km');
  });

  test('timeAgo describes elapsed time', () => {
    const now = new Date('2026-10-10T10:00:00Z');
    expect(timeAgo('2026-10-10T09:59:40Z', now)).toBe('vừa xong');
    expect(timeAgo('2026-10-10T09:55:00Z', now)).toBe('5 phút trước');
    expect(timeAgo('2026-10-10T07:00:00Z', now)).toBe('3 giờ trước');
    expect(timeAgo('2026-10-08T10:00:00Z', now)).toBe('2 ngày trước');
  });

  test('combineDateTime keeps the local wall-clock time', () => {
    const d = new Date(combineDateTime('2026-03-10', '19:30'));
    expect(d.getHours()).toBe(19);
    expect(d.getMinutes()).toBe(30);
    expect(toIsoDate(d)).toBe('2026-03-10');
  });
});

import { fromAudience, toAudience } from '@/features/reminders/audience';
import { offsetLabel, parseMilestones, toggleOffset } from '@/features/reminders/offsets';

describe('reminder helpers', () => {
  test('audienceIsRelativeToViewer', () => {
    // Người xem là chủ kỷ niệm
    expect(toAudience('me', 'u1', 'u1')).toBe('OWNER');
    expect(toAudience('partner', 'u1', 'u1')).toBe('PARTNER');
    // Người xem là người còn lại
    expect(toAudience('me', 'u2', 'u1')).toBe('PARTNER');
    expect(toAudience('partner', 'u2', 'u1')).toBe('OWNER');
    expect(toAudience('both', 'u2', 'u1')).toBe('BOTH');

    expect(fromAudience('OWNER', 'u2', 'u1')).toBe('partner');
    expect(fromAudience('PARTNER', 'u2', 'u1')).toBe('me');
    expect(fromAudience('BOTH', 'u1', 'u1')).toBe('both');
  });

  test('offset labels', () => {
    expect(offsetLabel('P0D')).toBe('Đúng ngày');
    expect(offsetLabel('P3D')).toBe('Trước 3 ngày');
    expect(offsetLabel('PT2H')).toBe('Trước 2 giờ');
    expect(offsetLabel('PT30M')).toBe('Trước 30 phút');
  });

  test('toggleOffset adds, removes and limits to 5', () => {
    expect(toggleOffset(['P1D'], 'P7D').list).toEqual(['P7D', 'P1D']);
    expect(toggleOffset(['P7D', 'P1D'], 'P1D').list).toEqual(['P7D']);
    const full = ['P30D', 'P14D', 'P7D', 'P3D', 'P1D'];
    expect(toggleOffset(full, 'P0D')).toEqual({ list: full, error: 'Tối đa 5 lần nhắc' });
  });

  test('parseMilestones validates and sorts', () => {
    expect(parseMilestones('520, 100 999 100')).toEqual({ days: [100, 520, 999], error: null });
    expect(parseMilestones('0, 5').error).toBe('Mốc ngày phải là số nguyên từ 1 đến 36500');
    expect(parseMilestones(Array.from({ length: 21 }, (_, i) => i + 1).join(',')).error).toBe('Tối đa 20 mốc ngày');
  });
});

import type { Moment } from '@/lib/api/types';
import { nextOccurrence, upcomingMoments } from '@/features/moments/occurrence';

function moment(partial: Partial<Moment>): Moment {
  return {
    id: 'm',
    type: 'CUSTOM',
    title: 'X',
    occursOn: '2026-01-01',
    occursAt: null,
    recurrence: 'NONE',
    personal: false,
    subjectUserId: null,
    message: null,
    details: {},
    reminderConfig: null,
    effectiveReminderConfig: { milestoneDays: null, yearly: null, offsets: [], sendAt: '08:00', recipients: 'OWNER' },
    place: null,
    media: [],
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

const TODAY = new Date(2026, 0, 10);

describe('occurrence', () => {
  test('one-off moments only count when today or later', () => {
    expect(nextOccurrence(moment({ occursOn: '2026-01-10' }), TODAY)).toBe('2026-01-10');
    expect(nextOccurrence(moment({ occursOn: '2026-01-09' }), TODAY)).toBeNull();
  });

  test('yearly moments roll to this or next year', () => {
    expect(nextOccurrence(moment({ occursOn: '2020-03-08', recurrence: 'YEARLY' }), TODAY)).toBe('2026-03-08');
    expect(nextOccurrence(moment({ occursOn: '2020-01-05', recurrence: 'YEARLY' }), TODAY)).toBe('2027-01-05');
  });

  test('anniversaries repeat yearly even without recurrence', () => {
    expect(nextOccurrence(moment({ type: 'ANNIVERSARY', occursOn: '2025-02-14' }), TODAY)).toBe('2026-02-14');
  });

  test('feb29FallsBackToFeb28', () => {
    expect(nextOccurrence(moment({ occursOn: '2024-02-29', recurrence: 'YEARLY' }), TODAY)).toBe('2026-02-28');
  });

  test('a yearly moment that starts in the future waits for its first date', () => {
    expect(nextOccurrence(moment({ occursOn: '2027-06-01', recurrence: 'YEARLY' }), TODAY)).toBe('2027-06-01');
  });

  test('upcomingMoments sorts, skips cycle and limits', () => {
    const list = [
      moment({ id: 'a', occursOn: '2026-05-01' }),
      moment({ id: 'b', occursOn: '2026-01-12' }),
      moment({ id: 'c', type: 'CYCLE', occursOn: '2026-01-11' }),
      moment({ id: 'd', occursOn: '2025-12-01' }),
      moment({ id: 'e', occursOn: '2026-02-01' }),
    ];
    const result = upcomingMoments(list, TODAY, 2);
    expect(result.map((r) => r.moment.id)).toEqual(['b', 'e']);
    expect(result[0].daysLeft).toBe(2);
  });
});

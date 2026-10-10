import { applyOccasion, emptyForm, toMomentInput, validateForm } from '@/features/moments/form';
import { toIsoDate } from '@/lib/format';

const TODAY = new Date(2026, 0, 10);
const IDS = { me: 'u1', partner: 'u2' };

describe('moment form', () => {
  test('empty form defaults to an anniversary today', () => {
    const f = emptyForm(TODAY);
    expect(f.type).toBe('ANNIVERSARY');
    expect(f.date).toBe('2026-01-10');
  });

  test('validation messages', () => {
    const base = emptyForm(TODAY);
    expect(validateForm(base)).toBe('Nhập tiêu đề');
    expect(validateForm({ ...base, title: 'Hẹn', type: 'DATE_PLAN' })).toBe('Lịch hẹn cần có giờ');
    expect(validateForm({ ...base, title: 'Quà', type: 'GIFT_OCCASION' })).toBe('Chọn dịp tặng quà');
    expect(validateForm({ ...base, title: 'Quà', type: 'GIFT_OCCASION', occasion: 'BIRTHDAY' })).toBe('Chọn người nhận quà');
    expect(validateForm({ ...base, title: 'Đi chơi', place: { name: ' ', lat: 1, lng: 2 } })).toBe('Đặt tên cho địa điểm');
    expect(validateForm({ ...base, title: 'Ngày yêu' })).toBeNull();
  });

  test('date plan combines date and time', () => {
    const input = toMomentInput(
      { ...emptyForm(TODAY), type: 'DATE_PLAN', title: ' Ăn tối ', date: '2026-03-10', time: '19:30', message: 'Nhà hàng Ý' },
      IDS,
      ['p1'],
      'create',
    );
    expect(input.type).toBe('DATE_PLAN');
    expect(input.title).toBe('Ăn tối');
    expect(input.recurrence).toBe('NONE');
    expect(input.mediaIds).toEqual(['p1']);
    const at = new Date(input.occursAt as string);
    expect(toIsoDate(at)).toBe('2026-03-10');
    expect(at.getHours()).toBe(19);
  });

  test('gift occasion sends subject, occasion and yearly recurrence', () => {
    const input = toMomentInput(
      { ...emptyForm(TODAY), type: 'GIFT_OCCASION', title: 'Sinh nhật Minh', occasion: 'BIRTHDAY', subject: 'partner' },
      IDS,
      [],
      'create',
    );
    expect(input.subjectUserId).toBe('u2');
    expect(input.details).toEqual({ occasion: 'BIRTHDAY' });
    expect(input.recurrence).toBe('YEARLY');
  });

  test('edit mode does not send type', () => {
    const input = toMomentInput({ ...emptyForm(TODAY), title: 'X' }, IDS, [], 'edit');
    expect(input.type).toBeUndefined();
  });

  test('place is sent with trimmed name', () => {
    const input = toMomentInput(
      { ...emptyForm(TODAY), title: 'X', place: { name: ' Hồ Gươm ', lat: 21.02, lng: 105.85 } },
      IDS,
      [],
      'create',
    );
    expect(input.place).toEqual({ name: 'Hồ Gươm', lat: 21.02, lng: 105.85 });
  });

  test('applyOccasion fills a fixed-date occasion for this year', () => {
    const f = applyOccasion({ ...emptyForm(TODAY), type: 'GIFT_OCCASION' }, 'WOMENS_DAY_8_3', TODAY);
    expect(f.occasion).toBe('WOMENS_DAY_8_3');
    expect(f.date).toBe('2026-03-08');
    expect(f.title).toBe('Quốc tế Phụ nữ 8/3');
  });

  test('applyOccasion keeps a custom title', () => {
    const f = applyOccasion({ ...emptyForm(TODAY), type: 'GIFT_OCCASION', title: 'Quà cho em' }, 'VALENTINE', TODAY);
    expect(f.title).toBe('Quà cho em');
  });
});

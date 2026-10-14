import type { Moment, MomentInput, MomentType, PlaceInput, Recurrence } from '@/lib/api/types';
import { combineDateTime, formatTime, toIsoDate } from '@/lib/format';

import { OCCASIONS } from './labels';

export type SubjectChoice = 'me' | 'partner';

export type MomentForm = {
  type: MomentType;
  title: string;
  date: string;
  time: string | null;
  message: string;
  occasion: string | null;
  subject: SubjectChoice | null;
  recurrence: Recurrence;
  place: PlaceInput | null;
};

export function repeatOptions(type: MomentType): Recurrence[] {
  return type === 'CUSTOM' || type === 'DATE_PLAN' ? ['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY'] : [];
}

export function emptyForm(today: Date, type: MomentType = 'ANNIVERSARY'): MomentForm {
  return {
    type,
    title: '',
    date: toIsoDate(today),
    time: type === 'DATE_PLAN' ? '19:00' : null,
    message: '',
    occasion: null,
    subject: null,
    recurrence: type === 'GIFT_OCCASION' ? 'YEARLY' : 'NONE',
    place: null,
  };
}

export function formFromMoment(m: Moment, meId: string): MomentForm {
  return {
    type: m.type,
    title: m.title,
    date: m.occursOn,
    time: m.occursAt ? formatTime(m.occursAt) : null,
    message: m.message ?? '',
    occasion: typeof m.details.occasion === 'string' ? m.details.occasion : null,
    subject: m.subjectUserId ? (m.subjectUserId === meId ? 'me' : 'partner') : null,
    recurrence: m.recurrence,
    place: null,
  };
}

/** Chọn dịp tặng quà: ngày cố định (8/3, 20/10…) tự điền ngày năm nay; tiêu đề trống thì điền tên dịp. */
export function applyOccasion(form: MomentForm, code: string, today: Date): MomentForm {
  const occasion = OCCASIONS.find((o) => o.code === code);
  if (!occasion) return form;
  return {
    ...form,
    occasion: code,
    title: form.title.trim() ? form.title : occasion.label,
    date: occasion.monthDay ? `${today.getFullYear()}-${occasion.monthDay}` : form.date,
  };
}

export function validateForm(f: MomentForm): string | null {
  if (!f.title.trim()) return 'Nhập tiêu đề';
  if (f.type === 'DATE_PLAN' && !f.time) return 'Lịch hẹn cần có giờ';
  if (f.type === 'GIFT_OCCASION' && !f.occasion) return 'Chọn dịp tặng quà';
  if (f.type === 'GIFT_OCCASION' && !f.subject) return 'Chọn người nhận quà';
  if (f.place && !f.place.name.trim()) return 'Đặt tên cho địa điểm';
  return null;
}

export function toMomentInput(
  f: MomentForm,
  ids: { me: string; partner: string },
  mediaIds: string[],
  mode: 'create' | 'edit',
): MomentInput {
  const input: MomentInput = {
    title: f.title.trim(),
    occursOn: f.date,
    message: f.message.trim(),
    mediaIds,
  };
  if (f.type === 'GIFT_OCCASION') input.recurrence = 'YEARLY';
  else if (repeatOptions(f.type).includes(f.recurrence)) input.recurrence = f.recurrence;
  if (mode === 'create') {
    input.type = f.type;
  }
  if (f.type === 'DATE_PLAN' && f.time) {
    input.occursAt = combineDateTime(f.date, f.time);
  }
  if ((f.type === 'GIFT_OCCASION' || f.type === 'CUSTOM') && f.subject) {
    input.subjectUserId = f.subject === 'me' ? ids.me : ids.partner;
  }
  if (f.type === 'GIFT_OCCASION' && f.occasion) {
    input.details = { occasion: f.occasion };
  }
  if (f.place) {
    input.place = { ...f.place, name: f.place.name.trim() };
  }
  return input;
}

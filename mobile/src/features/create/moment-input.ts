import { moodLabel } from '@/features/moments/labels';

/** Tiêu đề bắt buộc ở backend: dòng đầu của lời viết, nếu trống thì theo cảm xúc. */
export function momentTitle(caption: string, mood: string | null): string {
  const first = caption.trim().split('\n')[0].trim();
  if (first) return first.slice(0, 60);
  const label = moodLabel(mood);
  return label && mood !== 'OTHER' ? `Khoảnh khắc ${label.toLowerCase()}` : 'Khoảnh khắc';
}

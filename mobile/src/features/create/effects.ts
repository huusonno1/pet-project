import type { IconName } from '@/ui/Icon';

export type EffectId = 'ORIGINAL' | 'SMOOTH' | 'BUNNY' | 'HEARTS' | 'SPARKLE' | 'FILM';
export type Composition = { effect: EffectId; hearts: boolean; stamp: boolean; caption: string; date: string };
export type Spot = { x: number; y: number; size: number; opacity: number };

export const EFFECTS: { id: EffectId; label: string; colors: [string, string]; icon: IconName }[] = [
  { id: 'ORIGINAL', label: 'Gốc', colors: ['#EFE6E8', '#E3D6DA'], icon: 'slash' },
  { id: 'SMOOTH', label: 'Mịn da', colors: ['#FFC9B9', '#F59AB1'], icon: 'smile' },
  { id: 'BUNNY', label: 'Tai thỏ', colors: ['#FFE3F0', '#F7A8CC'], icon: 'bunny' },
  { id: 'HEARTS', label: 'Tim bay', colors: ['#FF8FAB', '#E9557A'], icon: 'heartFilled' },
  { id: 'SPARKLE', label: 'Lấp lánh', colors: ['#C9B8FF', '#7E6BE0'], icon: 'sparkles' },
  { id: 'FILM', label: 'Film', colors: ['#E9C9A8', '#8E6A4E'], icon: 'film' },
];

const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

export function colorMatrix(effect: EffectId): number[] {
  switch (effect) {
    case 'SMOOTH':
      return [1.04, 0, 0, 0, 0.04, 0, 1.04, 0, 0, 0.03, 0, 0, 1.04, 0, 0.03, 0, 0, 0, 1, 0];
    case 'FILM':
      return [0.9, 0.1, 0.05, 0, 0.05, 0.05, 0.85, 0.05, 0, 0.04, 0.05, 0.05, 0.75, 0, 0.06, 0, 0, 0, 1, 0];
    default:
      return IDENTITY;
  }
}

/** Độ mờ (sigma) trên ảnh rộng 1000px; nhân theo kích thước thật khi render. */
export function blurSigma(effect: EffectId): number {
  return effect === 'SMOOTH' ? 1.2 : 0;
}

const HEARTS: [number, number, number, number][] = [[0.1, 0.11, 0.095, 0.9], [0.81, 0.17, 0.073, 0.8], [0.7, 0.05, 0.045, 0.7], [0.17, 0.7, 0.061, 0.85], [0.84, 0.64, 0.084, 0.9]];
const SPARKLES: [number, number, number][] = [[0.11, 0.14, 0.061], [0.84, 0.22, 0.045], [0.2, 0.73, 0.039], [0.8, 0.7, 0.056]];

export function heartSpots(w: number, h: number): Spot[] {
  const m = Math.min(w, h);
  return HEARTS.map(([x, y, s, o]) => ({ x: x * w, y: y * h, size: s * m, opacity: o }));
}

export function sparkleSpots(w: number, h: number): Spot[] {
  const m = Math.min(w, h);
  return SPARKLES.map(([x, y, s]) => ({ x: x * w, y: y * h, size: s * m, opacity: 0.85 }));
}

/** Tai thỏ đặt cố định ở nửa trên ảnh (chưa nhận diện khuôn mặt — spec §12.7). */
export function bunnyEars(w: number, h: number): { cx: number; cy: number; rx: number; ry: number }[] {
  return [0.38, 0.62].map((x) => ({ cx: x * w, cy: 0.1 * h, rx: 0.07 * w, ry: 0.13 * h }));
}

export function stampText(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function hasEdits(c: Composition): boolean {
  return c.effect !== 'ORIGINAL' || c.hearts || c.stamp || c.caption.trim().length > 0;
}

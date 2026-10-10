export type FilterId = 'ORIGINAL' | 'WARM' | 'COOL' | 'VINTAGE' | 'BW';

const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** Ma trận màu 4x5 (hàng R, G, B, A; cột cuối là độ lệch 0..1) dùng cho Skia ColorMatrix. */
export const FILTERS: { id: FilterId; label: string; matrix: number[] }[] = [
  { id: 'ORIGINAL', label: 'Gốc', matrix: IDENTITY },
  { id: 'WARM', label: 'Ấm', matrix: [1.08, 0, 0, 0, 0.03, 0, 1, 0, 0, 0.01, 0, 0, 0.88, 0, 0, 0, 0, 0, 1, 0] },
  { id: 'COOL', label: 'Lạnh', matrix: [0.9, 0, 0, 0, 0, 0, 1, 0, 0, 0.01, 0, 0, 1.1, 0, 0.03, 0, 0, 0, 1, 0] },
  {
    id: 'VINTAGE',
    label: 'Vintage',
    matrix: [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    id: 'BW',
    label: 'Đen trắng',
    matrix: [0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0],
  },
];

export function matrixOf(id: FilterId): number[] {
  return FILTERS.find((f) => f.id === id)?.matrix ?? IDENTITY;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Áp ma trận lên một điểm ảnh (0..1) — dùng để kiểm thử ma trận. */
export function applyMatrix(m: number[], [r, g, b, a]: [number, number, number, number]): [number, number, number, number] {
  const row = (i: number) => clamp(m[i] * r + m[i + 1] * g + m[i + 2] * b + m[i + 3] * a + m[i + 4]);
  return [row(0), row(5), row(10), row(15)];
}

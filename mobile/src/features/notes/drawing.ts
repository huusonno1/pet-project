export type Point = { x: number; y: number };
export type Stroke = { color: string; points: Point[] };

export const PEN_COLORS = ['#E9557A', '#5B4BC4', '#24795A', '#2B1A2E'];
export const PEN_WIDTH = 6;

const r = (n: number) => Math.round(n * 10) / 10;

/** Nối các điểm thành path SVG; một điểm → chấm nhỏ để vẫn thấy được. */
export function strokeToPath(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  if (rest.length === 0) return `M${r(first.x)} ${r(first.y)} L${r(first.x + 0.1)} ${r(first.y)}`;
  return `M${r(first.x)} ${r(first.y)}` + rest.map((p) => ` L${r(p.x)} ${r(p.y)}`).join('');
}

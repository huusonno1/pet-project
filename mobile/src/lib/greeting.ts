export function greeting(now: Date): string {
  const h = now.getHours();
  if (h >= 5 && h < 11) return 'Chào buổi sáng';
  if (h >= 11 && h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

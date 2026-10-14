import { pad } from '@/lib/format';

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

export function formatInviteCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}

/** Thời gian còn lại dạng mm:ss, không âm. */
export function countdownLabel(expiresAt: string, now: Date = new Date()): string {
  const s = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

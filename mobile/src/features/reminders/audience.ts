import type { Audience, Moment } from '@/lib/api/types';

export type Choice = 'me' | 'partner' | 'both';

/** Chủ kỷ niệm theo backend: chủ thể nếu có, ngược lại là người tạo. */
export function ownerOf(m: Moment): string {
  return m.subjectUserId ?? m.createdBy;
}

export function toAudience(choice: Choice, viewerId: string, ownerId: string): Audience {
  if (choice === 'both') return 'BOTH';
  const viewerIsOwner = viewerId === ownerId;
  if (choice === 'me') return viewerIsOwner ? 'OWNER' : 'PARTNER';
  return viewerIsOwner ? 'PARTNER' : 'OWNER';
}

export function fromAudience(audience: Audience, viewerId: string, ownerId: string): Choice {
  if (audience === 'BOTH') return 'both';
  const viewerIsOwner = viewerId === ownerId;
  if (audience === 'OWNER') return viewerIsOwner ? 'me' : 'partner';
  return viewerIsOwner ? 'partner' : 'me';
}

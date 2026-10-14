export type TokenResponse = { accessToken: string; refreshToken: string; expiresIn: number };

export type Gender = 'MALE' | 'FEMALE';

export type Me = {
  id: string;
  email: string;
  displayName: string;
  handle: string;
  birthday: string | null;
  timezone: string;
  avatarUrl: string | null;
  gender: Gender | null;
};

export type Settings = {
  shareLocation: boolean;
  shareCycle: boolean;
  cycleLengthDefault: number;
  notifyPrefs: Record<string, boolean>;
  discoverable: boolean;
  cycleTracking: boolean;
};

export type Partner = {
  id: string;
  displayName: string;
  handle: string;
  birthday: string | null;
  avatarUrl: string | null;
  gender: Gender | null;
};
export type Couple = { id: string; startedDatingOn: string | null; createdAt: string; partner: Partner };
export type Invite = { code: string; expiresAt: string };

export type Distance = {
  distanceKm: number | null;
  me: { updatedAt: string } | null;
  partner: { updatedAt: string } | null;
};

export type MomentType = 'ANNIVERSARY' | 'DATE_PLAN' | 'GIFT_OCCASION' | 'CYCLE' | 'CUSTOM' | 'MOMENT';
export type Recurrence = 'NONE' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type Audience = 'OWNER' | 'PARTNER' | 'BOTH';

export type ReminderConfig = {
  milestoneDays: number[] | null;
  yearly: boolean | null;
  offsets: string[] | null;
  sendAt: string | null;
  recipients: Audience | null;
};

export type PlaceInput = { name: string; address?: string; lat: number; lng: number; category?: string };
export type Place = { id: string; name: string; address: string | null; lat: number; lng: number; category: string | null };

export type MediaDto = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  filter: string | null;
  takenAt: string | null;
};

export type Moment = {
  id: string;
  type: MomentType;
  title: string;
  occursOn: string;
  occursAt: string | null;
  recurrence: Recurrence;
  personal: boolean;
  subjectUserId: string | null;
  message: string | null;
  details: Record<string, unknown>;
  reminderConfig: ReminderConfig | null;
  effectiveReminderConfig: ReminderConfig;
  place: Place | null;
  media: MediaDto[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type MomentInput = {
  type?: MomentType;
  title?: string;
  occursOn?: string;
  occursAt?: string | null;
  recurrence?: Recurrence;
  subjectUserId?: string | null;
  message?: string;
  details?: Record<string, unknown>;
  place?: PlaceInput;
  mediaIds?: string[];
  notifyPartner?: boolean;
};

export type ReminderItem = { id: string; fireAt: string; title: string; body: string; deepLink: string | null };

export type CycleLog = { id: string; periodStart: string; periodEnd: string | null };
export type Prediction = { nextStart: string; averageLength: number; basedOnCycles: number };

export type Visibility = 'SHARED' | 'AUTHOR_ONLY';

export type SizeEntry = {
  id: string;
  subjectUserId: string;
  kind: string;
  value: string;
  note: string | null;
  visibility: Visibility;
  createdBy: string;
  updatedAt: string;
};

export type LinkDto = { id: string; url: string; label: string | null; price: number | null };

export type Preference = {
  id: string;
  subjectUserId: string;
  category: string;
  brand: string | null;
  name: string | null;
  color: string | null;
  note: string | null;
  visibility: Visibility;
  createdBy: string;
  updatedAt: string;
  links: LinkDto[];
  image: MediaDto | null;
};

export type Traits = { sizes: SizeEntry[]; preferences: Preference[] };
export type CatalogItem = { code: string; label: string };
export type Catalog = { sizeKinds: CatalogItem[]; preferenceCategories: CatalogItem[] };

export type UploadUrl = {
  mediaId: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
};

export type LoveNote = {
  id: string;
  authorId: string;
  kind: 'TEXT' | 'DRAWING';
  text: string | null;
  drawing: MediaDto | null;
  seenAt: string | null;
  createdAt: string;
};

export type InboxItem = {
  id: string;
  kind: 'REMINDER' | 'PAIRED' | 'LOVE_NOTE' | 'PAIR_REQUEST' | 'MOMENT' | string;
  title: string;
  body: string;
  deepLink: string | null;
  readAt: string | null;
  createdAt: string;
};

export type UserCard = { id: string; displayName: string; handle: string; avatarUrl: string | null; gender: Gender | null };
export type PairRequest = { id: string; user: UserCard; createdAt: string; expiresAt: string };
export type PairRequests = { incoming: PairRequest[]; outgoing: PairRequest[] };

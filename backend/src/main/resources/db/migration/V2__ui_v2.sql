-- ===== ID người dùng & cài đặt =====
ALTER TABLE users ADD COLUMN handle text;
UPDATE users SET handle = 'user' || substr(replace(id::text, '-', ''), 1, 8);
ALTER TABLE users ALTER COLUMN handle SET NOT NULL;
CREATE UNIQUE INDEX ux_users_handle ON users (lower(handle));

ALTER TABLE user_settings ADD COLUMN discoverable   boolean NOT NULL DEFAULT true;
ALTER TABLE user_settings ADD COLUMN cycle_tracking boolean NOT NULL DEFAULT false;
UPDATE user_settings s SET cycle_tracking = true
WHERE EXISTS (SELECT 1 FROM cycle_logs l WHERE l.user_id = s.user_id);

-- ===== Kỷ niệm: loại MOMENT, lặp tuần/tháng, kỷ niệm riêng =====
ALTER TABLE moments ALTER COLUMN couple_id DROP NOT NULL;
ALTER TABLE moments DROP CONSTRAINT moments_type_check;
ALTER TABLE moments ADD CONSTRAINT moments_type_check
    CHECK (type IN ('ANNIVERSARY', 'DATE_PLAN', 'GIFT_OCCASION', 'CYCLE', 'CUSTOM', 'MOMENT'));
ALTER TABLE moments DROP CONSTRAINT moments_recurrence_check;
ALTER TABLE moments ADD CONSTRAINT moments_recurrence_check
    CHECK (recurrence IN ('NONE', 'WEEKLY', 'MONTHLY', 'YEARLY'));
-- Kỷ niệm riêng (chưa ghép đôi): chỉ MOMENT/CUSTOM, không gắn địa điểm
ALTER TABLE moments ADD CONSTRAINT moments_personal_check
    CHECK (couple_id IS NOT NULL OR (type IN ('MOMENT', 'CUSTOM') AND place_id IS NULL));
CREATE INDEX ix_moments_personal ON moments (created_by, occurs_on) WHERE couple_id IS NULL;

ALTER TABLE reminders ALTER COLUMN couple_id DROP NOT NULL;

-- ===== Ảnh cho món yêu thích =====
ALTER TABLE preferences ADD COLUMN image_media_id uuid REFERENCES media (id) ON DELETE SET NULL;

-- ===== Lời nhắn =====
CREATE TABLE love_notes (
    id                uuid PRIMARY KEY,
    couple_id         uuid        NOT NULL REFERENCES couples (id),
    author_id         uuid        NOT NULL REFERENCES users (id),
    kind              text        NOT NULL CHECK (kind IN ('TEXT', 'DRAWING')),
    text              text,
    drawing_media_id  uuid REFERENCES media (id) ON DELETE CASCADE,
    seen_at           timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CHECK ((kind = 'TEXT' AND text IS NOT NULL) OR (kind = 'DRAWING' AND drawing_media_id IS NOT NULL))
);
CREATE INDEX ix_love_notes_couple ON love_notes (couple_id, created_at DESC);

-- ===== Hộp thông báo =====
CREATE TABLE notifications (
    id          uuid PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind        text        NOT NULL,
    title       text        NOT NULL,
    body        text        NOT NULL,
    deep_link   text,
    read_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX ix_notifications_unread ON notifications (user_id) WHERE read_at IS NULL;

-- ===== Lời mời ghép đôi theo ID =====
CREATE TABLE pair_requests (
    id            uuid PRIMARY KEY,
    requester_id  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    target_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status        text        NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    expires_at    timestamptz NOT NULL,
    responded_at  timestamptz,
    CHECK (requester_id <> target_id)
);
CREATE UNIQUE INDEX ux_pair_requests_pending ON pair_requests (requester_id, target_id) WHERE status = 'PENDING';
CREATE INDEX ix_pair_requests_target ON pair_requests (target_id) WHERE status = 'PENDING';

-- ===== Cặp đôi & người dùng =====
CREATE TABLE couples (
    id                 uuid PRIMARY KEY,
    status             text        NOT NULL CHECK (status IN ('ACTIVE', 'ENDED')),
    started_dating_on  date,
    created_at         timestamptz NOT NULL DEFAULT now(),
    ended_at           timestamptz
);

CREATE TABLE users (
    id                      uuid PRIMARY KEY,
    email                   text        NOT NULL,
    password_hash           text        NOT NULL,
    display_name            text        NOT NULL,
    avatar_media_id         uuid,
    birthday                date,
    timezone                text        NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    identity_verified_hash  text UNIQUE,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_users_email ON users (lower(email));

CREATE TABLE refresh_tokens (
    id          uuid PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  text        NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE user_settings (
    user_id               uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    share_location        boolean NOT NULL DEFAULT true,
    share_cycle           boolean NOT NULL DEFAULT true,
    cycle_length_default  int     NOT NULL DEFAULT 28 CHECK (cycle_length_default BETWEEN 20 AND 45),
    notify_prefs          jsonb   NOT NULL DEFAULT '{}'
);

CREATE TABLE device_tokens (
    id               uuid PRIMARY KEY,
    user_id          uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expo_push_token  text        NOT NULL UNIQUE,
    platform         text        NOT NULL CHECK (platform IN ('ios', 'android')),
    last_seen_at     timestamptz NOT NULL DEFAULT now(),
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_device_tokens_user ON device_tokens (user_id);

CREATE TABLE couple_members (
    couple_id  uuid        NOT NULL REFERENCES couples (id),
    user_id    uuid        NOT NULL REFERENCES users (id),
    joined_at  timestamptz NOT NULL DEFAULT now(),
    left_at    timestamptz,
    PRIMARY KEY (couple_id, user_id)
);
-- Mỗi user chỉ có tối đa 1 cặp đôi đang hoạt động
CREATE UNIQUE INDEX ux_member_active ON couple_members (user_id) WHERE left_at IS NULL;

-- ===== Ảnh =====
CREATE TABLE media (
    id            uuid PRIMARY KEY,
    couple_id     uuid REFERENCES couples (id),          -- NULL = ảnh cá nhân (avatar)
    uploader_id   uuid        NOT NULL REFERENCES users (id),
    object_key    text        NOT NULL UNIQUE,
    content_type  text        NOT NULL,
    size_bytes    bigint,
    width         int,
    height        int,
    filter        text,
    taken_at      timestamptz,
    lat           double precision,
    lng           double precision,
    status        text        NOT NULL CHECK (status IN ('PENDING', 'READY')),
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_media_couple ON media (couple_id);
CREATE INDEX ix_media_pending ON media (created_at) WHERE status = 'PENDING';

ALTER TABLE users
    ADD CONSTRAINT fk_users_avatar FOREIGN KEY (avatar_media_id) REFERENCES media (id) ON DELETE SET NULL;

-- ===== Địa điểm =====
CREATE TABLE places (
    id            uuid PRIMARY KEY,
    couple_id     uuid             NOT NULL REFERENCES couples (id),
    name          text             NOT NULL,
    address       text,
    lat           double precision NOT NULL,
    lng           double precision NOT NULL,
    category      text,
    external_ref  text,
    created_by    uuid             NOT NULL REFERENCES users (id),
    created_at    timestamptz      NOT NULL DEFAULT now(),
    updated_at    timestamptz      NOT NULL DEFAULT now()
);
CREATE INDEX ix_places_couple ON places (couple_id);

-- ===== Kỷ niệm =====
CREATE TABLE moments (
    id               uuid PRIMARY KEY,
    couple_id        uuid        NOT NULL REFERENCES couples (id),
    type             text        NOT NULL CHECK (type IN ('ANNIVERSARY', 'DATE_PLAN', 'GIFT_OCCASION', 'CYCLE', 'CUSTOM')),
    title            text        NOT NULL,
    occurs_on        date        NOT NULL,
    occurs_at        timestamptz,
    recurrence       text        NOT NULL DEFAULT 'NONE' CHECK (recurrence IN ('NONE', 'YEARLY')),
    subject_user_id  uuid REFERENCES users (id),
    place_id         uuid REFERENCES places (id) ON DELETE SET NULL,
    message          text,
    details          jsonb       NOT NULL DEFAULT '{}',
    reminder_config  jsonb,
    created_by       uuid        NOT NULL REFERENCES users (id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_moments_couple_date ON moments (couple_id, occurs_on);
CREATE INDEX ix_moments_subject ON moments (subject_user_id);
CREATE INDEX ix_moments_place ON moments (place_id);

CREATE TABLE moment_media (
    moment_id  uuid NOT NULL REFERENCES moments (id) ON DELETE CASCADE,
    position   int  NOT NULL,
    media_id   uuid NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    PRIMARY KEY (moment_id, position)
);
CREATE INDEX ix_moment_media_media ON moment_media (media_id);

CREATE TABLE cycle_logs (
    id            uuid PRIMARY KEY,
    user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    period_start  date        NOT NULL,
    period_end    date,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, period_start)
);

CREATE TABLE reminders (
    id            uuid PRIMARY KEY,
    couple_id     uuid        NOT NULL REFERENCES couples (id),
    moment_id     uuid        NOT NULL REFERENCES moments (id) ON DELETE CASCADE,
    recipient_id  uuid        NOT NULL REFERENCES users (id),
    fire_at       timestamptz NOT NULL,
    title         text        NOT NULL,
    body          text        NOT NULL,
    deep_link     text,
    status        text        NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED')),
    attempts      int         NOT NULL DEFAULT 0,
    sent_at       timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_reminders_due ON reminders (fire_at) WHERE status = 'PENDING';
CREATE INDEX ix_reminders_moment ON reminders (moment_id);
CREATE INDEX ix_reminders_couple ON reminders (couple_id);

-- ===== Đặc điểm đối phương =====
CREATE TABLE size_entries (
    id               uuid PRIMARY KEY,
    subject_user_id  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind             text        NOT NULL,
    value            text        NOT NULL,
    note             text,
    visibility       text        NOT NULL DEFAULT 'SHARED' CHECK (visibility IN ('SHARED', 'AUTHOR_ONLY')),
    created_by       uuid        NOT NULL REFERENCES users (id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_size_entries_subject ON size_entries (subject_user_id);

CREATE TABLE preferences (
    id               uuid PRIMARY KEY,
    subject_user_id  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category         text        NOT NULL,
    brand            text,
    name             text,
    color            text,
    note             text,
    visibility       text        NOT NULL DEFAULT 'SHARED' CHECK (visibility IN ('SHARED', 'AUTHOR_ONLY')),
    created_by       uuid        NOT NULL REFERENCES users (id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_preferences_subject ON preferences (subject_user_id);

CREATE TABLE preference_links (
    id             uuid PRIMARY KEY,
    preference_id  uuid           NOT NULL REFERENCES preferences (id) ON DELETE CASCADE,
    url            text           NOT NULL,
    label          text,
    price          numeric(12, 0),
    created_at     timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX ix_preference_links_pref ON preference_links (preference_id);

-- ===== Vị trí =====
CREATE TABLE user_locations (
    user_id     uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    lat         double precision NOT NULL,
    lng         double precision NOT NULL,
    accuracy_m  real,
    updated_at  timestamptz      NOT NULL
);

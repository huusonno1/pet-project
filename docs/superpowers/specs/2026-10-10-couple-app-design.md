# Couple App — Tài liệu thiết kế & yêu cầu tính năng

- **Ngày tạo:** 2026-10-10
- **Trạng thái:** Draft — chờ review
- **Tài liệu sống:** các yêu cầu có thể thêm/sửa/bớt; mỗi thay đổi lớn ghi vào mục [Lịch sử thay đổi](#12-lịch-sử-thay-đổi).

---

## 1. Mục tiêu & bối cảnh

App dành cho các cặp đôi để lưu giữ kỷ niệm, nhớ các ngày quan trọng, hiểu sở thích của nhau và quan tâm nhau đúng lúc.

- **Người dùng đầu tiên:** tác giả (Android) và người yêu (iPhone). App **bắt buộc chạy trên cả iOS và Android**.
- **Định hướng:** dùng riêng trước, **có thể phát hành công khai sau** → kiến trúc phải hỗ trợ nhiều cặp đôi và cô lập dữ liệu giữa các cặp ngay từ đầu.
- **Tiêu chí thành công GĐ1:** hai người cài được app trên máy thật (Android + iPhone qua TestFlight), ghép đôi, tạo kỷ niệm có ảnh, nhận thông báo nhắc đúng người — đúng thời điểm, xem khoảng cách và ghi chú đặc điểm của nhau.

## 2. Phạm vi theo giai đoạn

| Giai đoạn | Tính năng |
|---|---|
| **GĐ1** | Tài khoản & ghép đôi · Kỷ niệm (5 loại, ảnh, filter, địa điểm, lời nhắn) · Nhắc nhở/thông báo · Đặc điểm đối phương · Khoảng cách yêu xa |
| **GĐ2** | Bản đồ địa điểm hẹn hò + timeline · Ghi chú / vẽ tay gửi đối phương (qua push notification) |
| **GĐ3** | Nhắn tin cặp đôi · Gợi ý quán ăn/địa điểm chơi · Gợi ý lịch trình & ước tính chi phí du lịch · Xác thực VNeID |
| **Tạm hoãn** | Widget màn hình chính hiển thị ghi chú/vẽ tay (xem §4.7) |

Lưu ý: schema DB (§6) được thiết kế cho cả GĐ1 và GĐ2 ngay từ đầu; bảng của GĐ2 có thể tạo migration khi bắt đầu GĐ2.

## 3. Công nghệ

| Thành phần | Lựa chọn |
|---|---|
| Mobile | React Native + **Expo** (TypeScript), Expo Router, TanStack Query, build iOS/Android qua **EAS Build** (không cần máy Mac) |
| Camera & filter | `expo-camera`, `expo-image-picker`, `@shopify/react-native-skia` (color matrix filter) |
| Bản đồ (GĐ2) | `react-native-maps` (Google Maps trên Android, Apple Maps trên iOS) |
| Vị trí | `expo-location` (chỉ foreground ở GĐ1) |
| Backend | **Java 21, Spring Boot 3**, Spring Security (JWT), Spring Data JPA, Flyway |
| Database | **PostgreSQL** |
| Lưu ảnh | **MinIO** (S3-compatible) qua AWS SDK v2 với endpoint cấu hình được → chuyển sang AWS S3 chỉ bằng đổi config |
| Push notification | **Expo Push Service** → FCM (Android) / APNs (iOS) |
| Triển khai | Docker / docker-compose (backend + Postgres + MinIO), VPS hoặc Railway |
| Test | JUnit 5, Testcontainers (Postgres, MinIO), Jest + React Native Testing Library |

### 3.1 Chi phí push notification

- iOS **bắt buộc** đi qua APNs nếu muốn nhận thông báo khi app đang đóng; mọi dịch vụ (OneSignal, Pusher, Expo…) đều bọc APNs/FCM. Giải pháp tự host (ntfy, WebSocket) chỉ dùng được trên Android.
- FCM, APNs, Expo Push: **miễn phí, không giới hạn số tin**.
- Chi phí bắt buộc duy nhất: **Apple Developer Program 99$/năm** (cần cho cả TestFlight lẫn App Store).
- Lối thoát: nếu bỏ Expo, backend gọi thẳng FCM HTTP v1 (FCM gửi được tới iOS qua APNs) — vẫn miễn phí.

## 4. Yêu cầu tính năng

### 4.1 Tài khoản & ghép đôi (GĐ1)

- Đăng ký / đăng nhập bằng email + mật khẩu. JWT: access token 15 phút, refresh token 30 ngày (lưu hash trong DB, xoay vòng khi refresh).
- **Ghép đôi bằng mã mời:**
  - Người A tạo mã mời 8 ký tự (chữ in hoa + số, bỏ ký tự dễ nhầm như `0/O`, `1/I`), hết hạn sau 24h, dùng một lần.
  - Người B nhập mã → hai người trở thành cặp đôi.
  - Người **đã có cặp đôi ACTIVE** không được tạo mã và không được nhập mã.
  - Không thể nhập mã do chính mình tạo.
- Khi ghép đôi, có thể nhập **ngày bắt đầu yêu** → tự tạo một kỷ niệm `ANNIVERSARY` "Ngày yêu nhau".
- Kết thúc cặp đôi (`ENDED`): cả hai được ghép đôi lại với người khác; dữ liệu cũ giữ nguyên nhưng không truy cập được qua cặp mới. (Chính sách xoá dữ liệu khi chia tay: quyết định trước khi phát hành công khai.)
- **Mở rộng sau (GĐ3):** xác thực VNeID để đảm bảo mỗi người chỉ có một tài khoản — lưu hash định danh vào `users.identity_verified_hash` (UNIQUE).

### 4.2 Khoảng cách yêu xa (GĐ1)

- Màn hình chính hiển thị khoảng cách (km) giữa hai người và thời điểm cập nhật vị trí cuối của mỗi người.
- Yêu cầu bật quyền định vị; nếu chưa cấp quyền, hiển thị hướng dẫn bật.
- Vị trí được gửi lên khi mở app hoặc app trở lại foreground (không theo dõi nền ở GĐ1).
- Mỗi người có thể **tắt chia sẻ vị trí** → xoá vị trí đã lưu; người kia thấy "Chưa bật định vị".
- Backend chỉ lưu **vị trí mới nhất**, không lưu lịch sử. Khoảng cách tính bằng công thức haversine.
- Chỉ trả về khoảng cách và thời điểm cập nhật cho đối phương, không trả toạ độ chính xác.

### 4.3 Kỷ niệm (GĐ1)

Người dùng tạo các kỷ niệm chung của cặp đôi. Mỗi kỷ niệm có:

- Tiêu đề, ngày (và giờ nếu có), lời nhắn/ghi chú vài dòng tại thời điểm đó.
- **Ảnh:** chọn từ thư viện hoặc **chụp trực tiếp, có hoặc không có filter** (bộ filter ban đầu: Gốc, Ấm, Lạnh, Vintage, Đen trắng). Nhiều ảnh, sắp xếp được thứ tự.
- **Địa điểm** tại thời điểm kỷ niệm (chọn trên bản đồ hoặc dùng vị trí hiện tại) → lưu vào bảng `places` dùng chung với tính năng Địa điểm hẹn hò.
- **Nhắc nhở** theo quy tắc của từng loại.

#### Các loại kỷ niệm

| Loại | Mô tả | Người nhận nhắc & thời điểm |
|---|---|---|
| `ANNIVERSARY` | Ngày yêu nhau, kỷ niệm quan trọng | **Cả hai.** Mốc 100, 200, 300, 365, 500, 1000, 1500, 2000… ngày (sau 1000 thì mỗi 500 ngày) và mỗi năm tròn. Nhắc trước 3 ngày và đúng ngày lúc 08:00. |
| `DATE_PLAN` | Lịch hẹn sắp tới | **Cả hai.** Trước 1 ngày (20:00) và trước 2 giờ. |
| `GIFT_OCCASION` | Sinh nhật, 14/2, 8/3, 20/10, Giáng sinh… | **Chỉ người tặng** (đối phương của `subject_user_id`). Trước 7 ngày và trước 1 ngày; thông báo kèm link mở mục "Đặc điểm đối phương" của người nhận quà. Lặp lại hằng năm. |
| `CYCLE` | Chu kỳ kinh nguyệt | **Chủ thể:** "Chu kỳ dự kiến bắt đầu khoảng ngày X" (trước 2 ngày). **Đối phương:** "Khoảng 2 ngày nữa là tới ngày của [tên], nhớ quan tâm nhé 💗" (trước 2 ngày) và nhắc nhẹ vào ngày dự kiến. |
| `CUSTOM` | Kỷ niệm tự do | Người tạo tự chọn: ai nhận (mình / đối phương / cả hai), trước bao nhiêu ngày, có lặp hằng năm không. |

- Nhắc nhở dựa trên **vai trò (chủ thể / đối phương)**, không dựa trên giới tính.
- Gợi ý sẵn các dịp tặng quà phổ biến ở VN (14/2, 8/3, 20/10, 24/12, sinh nhật lấy từ hồ sơ) khi ghép đôi; người dùng bật/tắt từng dịp.

#### Chu kỳ (`CYCLE`) chi tiết

- Chủ thể ghi ngày bắt đầu (và ngày kết thúc nếu muốn) của mỗi kỳ vào `cycle_logs`.
- Dự đoán kỳ tiếp theo = ngày bắt đầu gần nhất + trung bình độ dài 3–6 chu kỳ gần nhất; nếu chưa đủ 2 kỳ thì mặc định 28 ngày (chủ thể chỉnh được).
- Chủ thể có thể **tắt chia sẻ** cho đối phương → đối phương không nhận nhắc và không thấy dữ liệu chu kỳ.
- Dữ liệu chu kỳ là dữ liệu nhạy cảm: chỉ trả về cho chủ thể; đối phương chỉ thấy "ngày dự kiến" nếu được chia sẻ.

### 4.4 Đặc điểm đối phương (GĐ1)

Ghi chú về cơ thể và sở thích của mỗi người để chọn quà dễ hơn.

- **Size:** áo, quần, giày, nhẫn (ngón tay), vòng tay, vòng cổ, áo ngực… — mỗi mục gồm giá trị + ghi chú (VD: "Áo M, form rộng thì S"). Danh sách loại size mở rộng được.
- **Sở thích / sản phẩm yêu thích:** theo danh mục (túi, son, nước hoa, bàn phím, đồ ăn, màu sắc, hoa…). Mỗi mục gồm hãng, tên sản phẩm, màu, ghi chú và **nhiều link mua hàng** (Shopee, Lazada, Tiki, website hãng…) kèm giá tham khảo.
- Cả **bản thân lẫn đối phương** đều ghi được về một người (`subject_user_id` vs `created_by`).
- **Chế độ bí mật (`AUTHOR_ONLY`):** người tặng ghi chú riêng (VD: "đã mua cái túi này, tặng sinh nhật") mà chủ thể không thấy — giữ bất ngờ.
- Mở link mua hàng bằng trình duyệt hệ thống / app sàn TMĐT.

### 4.5 Nhắc nhở & thông báo (GĐ1)

- App đăng ký Expo push token khi đăng nhập; mỗi user có thể có nhiều thiết bị.
- Nhắc nhở được **tính trước** thành các dòng trong bảng `reminders` (§7.3).
- Người dùng chọn múi giờ (mặc định `Asia/Ho_Chi_Minh`); giờ gửi tính theo múi giờ người nhận.
- Bấm vào thông báo → deep link tới đúng màn hình (kỷ niệm, đặc điểm đối phương, ghi chú…).
- Cài đặt: bật/tắt nhắc theo từng loại kỷ niệm.

### 4.6 Địa điểm hẹn hò (GĐ2)

- **Bản đồ** hiển thị các địa điểm cặp đôi đã đến (pin theo danh mục: ăn uống, cafe, du lịch, vui chơi…).
- Mỗi địa điểm có **nhiều lần ghé** (`visits`): thời gian, ghi chú, ảnh riêng.
- **Timeline** (dạng dòng thời gian) liệt kê các lần ghé theo thứ tự thời gian. (Dạng mindmap: cân nhắc lại khi làm GĐ2.)
- Kỷ niệm có địa điểm sẽ tự xuất hiện trên bản đồ (dùng chung `places`); một lần ghé có thể liên kết với một kỷ niệm.
- **GĐ3:** khi chọn địa điểm du lịch mới → gợi ý điểm nên đi, ước tính chi phí.

### 4.7 Ghi chú / vẽ tay gửi đối phương (GĐ2)

- Người dùng viết ghi chú ngắn hoặc **vẽ tay** trên màn hình (canvas Skia, chọn màu/nét).
- Gửi → đối phương nhận **push notification** (kèm ảnh nét vẽ nếu thiết bị hỗ trợ); bấm vào mở app xem. Đánh dấu đã xem (`seen_at`).
- Màn hình lịch sử ghi chú của cặp đôi.

> **⏸ TẠM HOÃN — Widget màn hình chính (chưa làm)**
> Mục tiêu: ghi chú/vẽ tay mới nhất hiện thẳng trên màn hình chính điện thoại đối phương mà không cần mở app (giống Locket).
> Hướng triển khai dự kiến: iOS dùng **WidgetKit (Swift)** qua Expo config plugin (VD `@bacons/apple-targets`); Android dùng **Jetpack Glance / AppWidget** (hoặc `react-native-android-widget`). Widget đọc ghi chú mới nhất qua endpoint `GET /love-notes/latest`; khi có ghi chú mới, push "silent" để widget refresh.
> Lý do hoãn: cần code native riêng cho từng nền tảng, độ phức tạp cao nhất dự án.

### 4.8 Ngoài phạm vi hiện tại (GĐ3)

- Nhắn tin cặp đôi (realtime).
- Gợi ý quán ăn, địa điểm chơi.
- Gợi ý lịch trình & ước tính chi phí du lịch.
- Xác thực VNeID.
- Đăng nhập Google / Apple (lưu ý: nếu có Google Sign-In thì App Store bắt buộc có Sign in with Apple).

## 5. Kiến trúc

```
┌─────────────────────┐        ┌──────────────────────────┐
│ App React Native    │ HTTPS  │ Spring Boot API          │
│ (Expo, TypeScript)  │──JSON─▶│  auth · couple · moment  │
│ Android + iOS       │        │  cycle · trait · place   │
└──────┬──────────────┘        │  media · location        │
       │ PUT/GET ảnh trực tiếp │  love-note · notification│
       │ (presigned URL)       └───────────┬──────────────┘
       ▼                                   │
┌─────────────────────┐   ký URL           │
│ MinIO (→ AWS S3)    │◀───────────────────┤
└─────────────────────┘                    │
┌─────────────────────┐   gửi push         │
│ Expo Push → FCM/APNs│◀───────────────────┤
└─────────────────────┘                    ▼
                                    ┌──────────────┐
                                    │ PostgreSQL   │
                                    └──────────────┘
```

### 5.1 Cấu trúc repo (monorepo)

```
pet-project/
├── mobile/      # Expo app (TypeScript)
├── backend/     # Spring Boot (Java 21)
├── docs/        # spec, plan
└── docker-compose.yml   # Postgres + MinIO (+ backend) cho dev
```

### 5.2 Backend: chia module theo tính năng

Mỗi package tự chứa entity, repository, service, controller, DTO:
`auth`, `couple`, `moment` (gồm `handler/` cho từng loại), `cycle`, `trait`, `place`, `media`, `location`, `lovenote`, `notification`, `common` (lỗi, bảo mật, cấu hình).

Module chỉ giao tiếp với nhau qua service interface, không truy cập repository của module khác.

### 5.3 Nguyên tắc

- **Mọi dữ liệu thuộc về một `couple`** (trừ dữ liệu cá nhân như `cycle_logs`, `user_locations`). `couple_id` luôn lấy từ user đang đăng nhập, **không bao giờ nhận từ client**.
- Bucket MinIO **private**; client chỉ truy cập ảnh qua presigned URL ngắn hạn (PUT 10 phút, GET 1 giờ).
- Thời gian lưu dạng `timestamptz` (UTC); ngày lịch (`occurs_on`, `period_start`) dạng `date`.

## 6. Thiết kế database

PostgreSQL, migration bằng Flyway. Khoá chính `uuid` (sinh ở backend). Mọi bảng có `created_at`; bảng sửa được có `updated_at`.

### 6.1 Tài khoản & cặp đôi

```sql
users (
  id                      uuid PK,
  email                   citext UNIQUE NOT NULL,
  password_hash           text NOT NULL,
  display_name            text NOT NULL,
  avatar_media_id         uuid NULL REFERENCES media(id),
  birthday                date NULL,
  timezone                text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  identity_verified_hash  text UNIQUE NULL,      -- VNeID (GĐ3)
  created_at, updated_at
)

refresh_tokens (
  id uuid PK, user_id uuid FK users, token_hash text UNIQUE,
  expires_at timestamptz, revoked_at timestamptz NULL, created_at
)

couples (
  id                 uuid PK,
  status             text NOT NULL CHECK (status IN ('ACTIVE','ENDED')),
  started_dating_on  date NULL,
  created_at, ended_at timestamptz NULL
)

couple_members (
  couple_id  uuid FK couples,
  user_id    uuid FK users,
  joined_at  timestamptz NOT NULL,
  left_at    timestamptz NULL,
  PRIMARY KEY (couple_id, user_id)
)
-- Mỗi user chỉ có tối đa 1 cặp đôi đang hoạt động:
CREATE UNIQUE INDEX ux_member_active ON couple_members(user_id) WHERE left_at IS NULL;

invite_codes (
  code        text PK,
  inviter_id  uuid FK users,
  expires_at  timestamptz NOT NULL,
  used_by     uuid NULL FK users,
  used_at     timestamptz NULL,
  created_at
)

user_settings (
  user_id uuid PK FK users,
  share_location boolean DEFAULT true,
  share_cycle    boolean DEFAULT true,
  notify_prefs   jsonb   DEFAULT '{}'   -- bật/tắt theo loại kỷ niệm
)

device_tokens (
  id uuid PK, user_id uuid FK users,
  expo_push_token text UNIQUE NOT NULL,
  platform text CHECK (platform IN ('ios','android')),
  last_seen_at timestamptz, created_at
)
```

### 6.2 Ảnh

```sql
media (
  id            uuid PK,
  couple_id     uuid NULL FK couples,        -- NULL = ảnh cá nhân (avatar), up được trước khi ghép đôi
  uploader_id   uuid FK users,
  object_key    text UNIQUE NOT NULL,        -- couples/{coupleId}/{yyyy}/{mm}/{uuid}.jpg | users/{userId}/avatar/{uuid}.jpg
  content_type  text NOT NULL,
  size_bytes    bigint,
  width int, height int,
  filter        text NULL,                   -- tên filter đã áp
  taken_at      timestamptz NULL,
  lat double precision NULL, lng double precision NULL,
  status        text CHECK (status IN ('PENDING','READY')),
  created_at
)
```

`users.avatar_media_id` ↔ `media.uploader_id` tham chiếu vòng → FK `users.avatar_media_id` được thêm bằng `ALTER TABLE` sau khi tạo bảng `media`.

Ảnh gắn vào đối tượng qua bảng liên kết (`moment_media`, `visit_media`) thay vì cột polymorphic, để giữ được khoá ngoại.

### 6.3 Kỷ niệm & nhắc nhở

```sql
moments (
  id               uuid PK,
  couple_id        uuid FK couples NOT NULL,
  type             text NOT NULL CHECK (type IN
                     ('ANNIVERSARY','DATE_PLAN','GIFT_OCCASION','CYCLE','CUSTOM')),
  title            text NOT NULL,
  occurs_on        date NOT NULL,
  occurs_at        timestamptz NULL,          -- có giờ cụ thể (DATE_PLAN)
  recurrence       text NOT NULL DEFAULT 'NONE' CHECK (recurrence IN ('NONE','YEARLY')),
  subject_user_id  uuid NULL FK users,        -- người được nhắc tới (sinh nhật ai, chu kỳ ai)
  place_id         uuid NULL FK places,
  message          text NULL,                 -- lời nhắn tại thời điểm kỷ niệm
  details          jsonb NOT NULL DEFAULT '{}', -- dữ liệu riêng theo type, handler validate
  created_by       uuid FK users,
  created_at, updated_at
)
CREATE INDEX ix_moments_couple_date ON moments(couple_id, occurs_on);

moment_media (
  moment_id uuid FK moments ON DELETE CASCADE,
  media_id  uuid FK media,
  position  int NOT NULL,
  PRIMARY KEY (moment_id, media_id)
)

cycle_logs (
  id uuid PK, user_id uuid FK users,
  period_start date NOT NULL, period_end date NULL,
  created_at
)

reminders (
  id            uuid PK,
  couple_id     uuid FK couples,
  moment_id     uuid FK moments ON DELETE CASCADE,
  recipient_id  uuid FK users,
  fire_at       timestamptz NOT NULL,
  title         text NOT NULL,
  body          text NOT NULL,
  deep_link     text NULL,
  status        text NOT NULL CHECK (status IN ('PENDING','SENT','FAILED','CANCELLED')),
  attempts      int NOT NULL DEFAULT 0,
  sent_at       timestamptz NULL,
  created_at
)
CREATE INDEX ix_reminders_due ON reminders(fire_at) WHERE status = 'PENDING';
```

Ví dụ `details` theo loại:

| type | `details` |
|---|---|
| `ANNIVERSARY` | `{"milestones": true, "yearly": true}` |
| `DATE_PLAN` | `{}` |
| `GIFT_OCCASION` | `{"occasion": "BIRTHDAY" \| "VALENTINE" \| "WOMENS_DAY_8_3" \| "WOMENS_DAY_20_10" \| "CHRISTMAS" \| "OTHER"}` |
| `CYCLE` | `{"defaultCycleLength": 28}` |
| `CUSTOM` | `{"notify": "SELF" \| "PARTNER" \| "BOTH", "daysBefore": [3, 0]}` |

`CYCLE`: mỗi người có tối đa một moment `CYCLE` (chủ thể = `subject_user_id`); `occurs_on` là ngày dự kiến kỳ tiếp theo, được tính lại mỗi khi có `cycle_logs` mới.

### 6.4 Đặc điểm đối phương

```sql
size_entries (
  id               uuid PK,
  subject_user_id  uuid FK users NOT NULL,
  kind             text NOT NULL,     -- SHIRT, PANTS, SHOE, RING, BRACELET, NECKLACE, BRA, ...
  value            text NOT NULL,
  note             text NULL,
  visibility       text NOT NULL DEFAULT 'SHARED' CHECK (visibility IN ('SHARED','AUTHOR_ONLY')),
  created_by       uuid FK users,
  created_at, updated_at
)

preferences (
  id               uuid PK,
  subject_user_id  uuid FK users NOT NULL,
  category         text NOT NULL,     -- BAG, LIPSTICK, PERFUME, KEYBOARD, FOOD, COLOR, FLOWER, ...
  brand            text NULL,
  name             text NULL,
  color            text NULL,
  note             text NULL,
  visibility       text NOT NULL DEFAULT 'SHARED' CHECK (visibility IN ('SHARED','AUTHOR_ONLY')),
  created_by       uuid FK users,
  created_at, updated_at
)

preference_links (
  id             uuid PK,
  preference_id  uuid FK preferences ON DELETE CASCADE,
  url            text NOT NULL,
  label          text NULL,          -- "Shopee", "Website hãng"
  price          numeric(12,0) NULL, -- VND
  created_at
)
```

`kind` / `category` là `text` (không phải enum DB) để thêm loại mới không cần migration; danh sách gợi ý nằm ở backend.

Quyền xem: chỉ thành viên của cặp đôi ACTIVE chứa `subject_user_id` mới xem được; mục `AUTHOR_ONLY` chỉ trả cho `created_by`.

### 6.5 Vị trí

```sql
user_locations (
  user_id     uuid PK FK users,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  accuracy_m  real NULL,
  updated_at  timestamptz NOT NULL
)
```

### 6.6 Địa điểm hẹn hò (GĐ2 — `places` dùng từ GĐ1 cho kỷ niệm)

```sql
places (
  id            uuid PK,
  couple_id     uuid FK couples NOT NULL,
  name          text NOT NULL,
  address       text NULL,
  lat           double precision NOT NULL,
  lng           double precision NOT NULL,
  category      text NULL,      -- FOOD, CAFE, TRAVEL, ENTERTAINMENT, ...
  external_ref  text NULL,      -- id từ Google Places/OSM nếu có
  created_by    uuid FK users,
  created_at, updated_at
)

visits (
  id          uuid PK,
  place_id    uuid FK places ON DELETE CASCADE,
  visited_at  timestamptz NOT NULL,
  note        text NULL,
  moment_id   uuid NULL FK moments,
  created_by  uuid FK users,
  created_at, updated_at
)

visit_media (
  visit_id uuid FK visits ON DELETE CASCADE,
  media_id uuid FK media,
  position int NOT NULL,
  PRIMARY KEY (visit_id, media_id)
)
```

### 6.7 Ghi chú / vẽ tay (GĐ2)

```sql
love_notes (
  id                uuid PK,
  couple_id         uuid FK couples NOT NULL,
  author_id         uuid FK users,
  kind              text CHECK (kind IN ('TEXT','DRAWING')),
  text              text NULL,
  drawing_media_id  uuid NULL FK media,
  seen_at           timestamptz NULL,
  created_at
)
```

## 7. Luồng xử lý chính

### 7.1 Ghép đôi

1. A: `POST /api/couples/invites` → kiểm tra A chưa có cặp ACTIVE → sinh mã, lưu `invite_codes`.
2. B: `POST /api/couples/join {code, startedDatingOn?}` → trong **một transaction**:
   - Khoá dòng mã (`SELECT … FOR UPDATE`); kiểm tra chưa dùng, chưa hết hạn, `inviter_id ≠ B`.
   - Kiểm tra cả A và B chưa có cặp ACTIVE.
   - Tạo `couples` + 2 `couple_members`, đánh dấu mã đã dùng, tạo moment `ANNIVERSARY` nếu có ngày.
   - Unique index `ux_member_active` là chốt chặn cuối khi có request song song.
3. Push cho A: "[B] đã ghép đôi với bạn 💞".

### 7.2 Upload ảnh

1. `POST /api/media/upload-url {contentType, size}` → tạo `media` (PENDING), trả presigned PUT URL.
2. App upload trực tiếp lên MinIO (ảnh đã nén ≤ 2048px cạnh dài, đã áp filter nếu có).
3. `POST /api/media/{id}/confirm` → backend kiểm tra object tồn tại (HEAD) → `READY`.
4. Gắn vào moment/visit khi tạo/sửa.
5. Xem: API trả presigned GET URL trong DTO.

### 7.3 Nhắc nhở (Strategy pattern)

```java
interface MomentTypeHandler {
    MomentType type();
    void validate(Moment moment);                    // kiểm tra details, subject...
    List<ReminderPlan> planReminders(Moment moment,  // ai nhận, lúc nào, nội dung gì
                                     CoupleContext ctx,
                                     Instant horizon);
}
```

- `MomentService` chọn handler theo `type` (Spring inject `Map<MomentType, MomentTypeHandler>`).
- Khi tạo/sửa moment: huỷ (`CANCELLED`) các reminder PENDING của moment → sinh lại trong khoảng `horizon` (mặc định 400 ngày tới).
- **Scheduler** (`@Scheduled` mỗi phút):
  1. `SELECT … FROM reminders WHERE status='PENDING' AND fire_at <= now() ORDER BY fire_at LIMIT 100 FOR UPDATE SKIP LOCKED` → an toàn khi chạy nhiều instance.
  2. Gửi qua Expo Push tới mọi `device_tokens` của người nhận; kiểm tra `notify_prefs`.
  3. Thành công → `SENT`; lỗi → `attempts++`, thử lại tối đa 3 lần rồi `FAILED`.
- **Job hằng ngày:** với moment lặp lại (YEARLY, mốc ngày, CYCLE), bổ sung reminder để luôn phủ đủ `horizon`.
- Thêm loại kỷ niệm mới = thêm một class handler; scheduler không đổi.

### 7.4 Chu kỳ

1. Chủ thể ghi `cycle_logs` → `CycleService` tính ngày dự kiến kỳ tới → cập nhật `occurs_on` của moment `CYCLE` của chủ thể → `CycleHandler` sinh lại reminder.
2. Nếu `share_cycle = false`: chỉ sinh reminder cho chủ thể.

### 7.5 Khoảng cách

1. App lấy vị trí (foreground) → `PUT /api/me/location {lat, lng, accuracy}`.
2. `GET /api/couples/distance` → `{distanceKm, me: {updatedAt}, partner: {updatedAt}}` hoặc `partner: null` nếu đối phương tắt chia sẻ/chưa có vị trí.

### 7.6 Ghi chú / vẽ tay (GĐ2)

1. Vẽ trên canvas Skia → xuất PNG → upload như §7.2.
2. `POST /api/love-notes {kind, text?, drawingMediaId?}` → push ngay cho đối phương (kèm URL ảnh để hiển thị rich notification).
3. Mở xem → `POST /api/love-notes/{id}/seen`.

## 8. API (tóm tắt)

| Nhóm | Endpoint |
|---|---|
| Auth | `POST /api/auth/register`, `/login`, `/refresh`, `/logout` |
| Me | `GET/PATCH /api/me`, `PUT /api/me/settings`, `PUT/DELETE /api/me/location`, `POST/DELETE /api/me/devices` |
| Couple | `POST /api/couples/invites`, `POST /api/couples/join`, `GET /api/couples/me`, `POST /api/couples/me/end`, `GET /api/couples/distance` |
| Moment | `GET/POST /api/moments`, `GET/PATCH/DELETE /api/moments/{id}` (lọc theo `type`, khoảng ngày) |
| Cycle | `GET/POST /api/cycles/logs`, `DELETE /api/cycles/logs/{id}`, `GET /api/cycles/prediction` |
| Trait | `GET /api/traits/{userId}`, `POST/PATCH/DELETE /api/traits/sizes/{id}`, `POST/PATCH/DELETE /api/traits/preferences/{id}` (kèm links) |
| Media | `POST /api/media/upload-url`, `POST /api/media/{id}/confirm`, `DELETE /api/media/{id}` |
| Place (GĐ2) | `GET/POST /api/places`, `PATCH/DELETE /api/places/{id}`, `POST /api/places/{id}/visits`, `PATCH/DELETE /api/visits/{id}` |
| Love note (GĐ2) | `GET/POST /api/love-notes`, `POST /api/love-notes/{id}/seen`, `GET /api/love-notes/latest` |

Các endpoint cần cặp đôi (moment, trait, place, love-note, distance) trả `409 COUPLE_REQUIRED` nếu user chưa ghép đôi.

## 9. Xử lý lỗi

- Mọi lỗi trả **RFC 7807 `ProblemDetail`** kèm trường `code`. App map `code` → thông báo tiếng Việt.
- Mã lỗi chính: `VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `COUPLE_REQUIRED`, `COUPLE_ALREADY_PAIRED`, `INVITE_INVALID`, `INVITE_EXPIRED`, `INVITE_SELF`, `MEDIA_NOT_UPLOADED`, `LOCATION_NOT_SHARED`.
- Truy cập dữ liệu của cặp đôi khác → trả `404` (không tiết lộ sự tồn tại).
- Push: Expo trả `DeviceNotRegistered` → xoá token; lỗi tạm thời → retry (§7.3).
- Job dọn dẹp hằng ngày: xoá `media` PENDING quá 24h (cả object trên MinIO), xoá `invite_codes` hết hạn quá 7 ngày.
- Mobile: lỗi mạng → TanStack Query retry + hiển thị trạng thái offline; upload ảnh lỗi → cho phép thử lại từng ảnh.

## 10. Kiểm thử

- **Backend unit test:** từng `MomentTypeHandler` (tính mốc 100/1000 ngày, năm nhuận, sinh nhật 29/2, chọn đúng người nhận theo vai trò, `share_cycle=false`), thuật toán dự đoán chu kỳ, haversine, sinh mã mời.
- **Backend integration test (Testcontainers Postgres + MinIO):** ghép đôi (gồm 2 request song song), cô lập dữ liệu giữa hai cặp đôi, quyền `AUTHOR_ONLY`, luồng upload presigned, scheduler (`SKIP LOCKED`, retry). Expo Push được mock.
- **Mobile:** Jest + React Native Testing Library cho form và logic hiển thị chính; test thủ công trên Android thật + iPhone thật qua development build/TestFlight.

## 11. Vấn đề mở (quyết định sau)

- Chính sách dữ liệu khi cặp đôi chia tay (xoá hay giữ, ai giữ ảnh) — cần trước khi phát hành công khai.
- Dạng hiển thị "mindmap" cho địa điểm hẹn hò — chốt khi làm GĐ2.
- Nguồn dữ liệu gợi ý địa điểm (Google Places / OSM / tự xây) — GĐ3.
- Mã hoá dữ liệu chu kỳ ở mức cột — cân nhắc trước khi phát hành công khai.

## 12. Lịch sử thay đổi

| Ngày | Thay đổi |
|---|---|
| 2026-10-10 | Bản đầu tiên. |

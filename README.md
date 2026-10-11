# Couple App

App cho các cặp đôi: kỷ niệm, nhắc nhở, đặc điểm của nhau, khoảng cách yêu xa.
Thiết kế: `docs/superpowers/specs/2026-10-10-couple-app-design.md`.

## Cấu trúc

- `backend/` — Spring Boot 3.5 (Java 21)
- `mobile/` — Expo (React Native, TypeScript), chạy Android + iOS
- `docker-compose.yml` — PostgreSQL, Redis, MinIO cho môi trường dev

## Yêu cầu

- JDK 21, Docker (+ Docker Compose), Node.js 20+

## Chạy dev

```bash
docker compose up -d                 # Postgres :5432, Redis :6379, MinIO :9000 (console :9001)
cd backend && ./mvnw spring-boot:run # API :8080
cd mobile && npx expo start          # quét QR bằng Expo Go / development build
```

Khi test trên điện thoại thật, đặt `APP_STORAGE_PUBLIC_ENDPOINT=http://<IP-LAN-máy-dev>:9000`
để URL ảnh presigned truy cập được từ điện thoại.

## Test

```bash
cd backend && ./mvnw test            # cần Docker (Testcontainers)
```

## Mobile (Expo)

```bash
cd mobile
cp .env.example .env        # sửa EXPO_PUBLIC_API_URL thành http://<IP-LAN-máy-dev>:8080
npm install
npx expo start              # quét QR bằng Expo Go
npm test                    # unit/screen tests
```

Chạy backend cho điện thoại thật: `APP_STORAGE_PUBLIC_ENDPOINT=http://<IP-LAN>:9000 ./mvnw spring-boot:run`
(để URL ảnh presigned trỏ về IP mà điện thoại truy cập được).

**Expo Go** chạy được mọi thứ trừ **push notification trên Android**. Để nhận push cần development build:

```bash
npx eas-cli@latest login
npx eas-cli@latest init                      # ghi extra.eas.projectId vào app.json
npx eas-cli@latest credentials               # Android: thêm FCM V1 service account (Firebase)
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest device:create             # iOS: đăng ký iPhone (cần Apple Developer 99$/năm)
npx eas-cli@latest build --profile development --platform ios
npx expo start --dev-client
```

## API GĐ1 (tóm tắt)

Mọi endpoint (trừ `/api/auth/**`) cần header `Authorization: Bearer <accessToken>`. Lỗi trả dạng RFC 7807 kèm `code`.

| Nhóm | Endpoint |
|---|---|
| Auth | `POST /api/auth/register`, `/login`, `/refresh`, `/logout` |
| Me | `GET/PATCH /api/me`, `GET/PUT /api/me/settings`, `PUT/DELETE /api/me/location`, `POST/DELETE /api/me/devices` |
| Couple | `POST /api/couples/invites`, `POST /api/couples/join`, `GET /api/couples/me`, `POST /api/couples/me/end`, `GET /api/couples/distance` |
| Media | `POST /api/media/upload-url` → PUT file lên `uploadUrl` → `POST /api/media/{id}/confirm`; `DELETE /api/media/{id}` |
| Moment | `GET/POST /api/moments`, `GET/PATCH/DELETE /api/moments/{id}`, `PUT /api/moments/{id}/reminder-config`, `GET /api/moments/{id}/reminders` |
| Cycle | `GET/POST /api/cycles/logs`, `DELETE /api/cycles/logs/{id}`, `GET /api/cycles/prediction?userId=`, `PUT /api/cycles/default-length` |
| Trait | `GET /api/traits/catalog`, `GET /api/traits/{userId}`, `POST/PATCH/DELETE /api/traits/sizes[/{id}]`, `POST/PATCH/DELETE /api/traits/preferences[/{id}]` |
| Users | `GET /api/users/lookup?handle=` |
| Couple (lời mời theo ID) | `POST/GET /api/couples/requests`, `POST /api/couples/requests/{id}/accept`, `POST /api/couples/requests/{id}/decline`, `DELETE /api/couples/requests/{id}` |
| Notifications | `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all` |
| Love note | `GET/POST /api/love-notes`, `POST /api/love-notes/{id}/seen`, `GET /api/love-notes/latest` |

Ghi chú UI v2: `PATCH /api/me` nhận `handle`; `GET/PUT /api/me/settings` có `discoverable`, `cycleTracking`; `POST /api/moments` nhận `type: MOMENT`, `recurrence: WEEKLY|MONTHLY`, `notifyPartner`; `MomentResponse.personal`.

Chi tiết nghiệp vụ: `docs/superpowers/specs/2026-10-10-couple-app-design.md`.

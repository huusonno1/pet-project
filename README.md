# Couple App

App cho các cặp đôi: kỷ niệm, nhắc nhở, đặc điểm của nhau, khoảng cách yêu xa.
Thiết kế: `docs/superpowers/specs/2026-10-10-couple-app-design.md`.

## Quy tắc Git

Git Flow + Conventional Commits, bắt buộc cho cả người và AI: **`docs/GIT_FLOW.md`**.
Sau khi clone, bật hook kiểm tra: `git config core.hooksPath .githooks`.

## Cấu trúc

- `backend/` — Spring Boot 3.5 (Java 21)
- `mobile/` — Expo (React Native, TypeScript), chạy Android + iOS
- `docker-compose.yml` — PostgreSQL, Redis, MinIO cho môi trường dev

## Yêu cầu

- JDK 21, Docker (+ Docker Compose), Node.js 20+

## Chạy dev (test trên điện thoại thật)

Mở 2 terminal ở thư mục gốc dự án. Máy tính và 2 điện thoại phải **cùng Wi-Fi**.

```bash
# Terminal 1 — backend: bật Docker (Postgres/Redis/MinIO) + API :8080
./backend/dev.sh

# Terminal 2 — mobile: Expo, quét QR bằng Expo Go
./mobile/dev.sh
```

- Hai script tự lấy IP LAN hiện tại (IP đổi khi đổi Wi-Fi, không cần sửa `.env`). Sai IP thì ép: `LAN_IP=192.168.x.x ./backend/dev.sh`.
- `backend/dev.sh` tự dùng JDK 21 ở `~/.jdks/temurin-21` (java mặc định của máy là 17) và đặt
  `APP_STORAGE_PUBLIC_ENDPOINT=http://<IP-LAN>:9000` — chạy `./mvnw spring-boot:run` trơn thì URL ảnh là localhost → điện thoại tải ảnh lỗi.
- Đợi Terminal 1 in `Started CoupleApplication` rồi mới mở app. Sửa code mobile thì app tự reload; muốn reload tay: lắc máy → Reload (hoặc bấm `r` ở Terminal 2).
- **Android:** Expo Go → Scan QR. **iPhone:** Camera quét QR; Expo Go phải đăng nhập cùng tài khoản với `npx expo login` trên máy.
- Tài khoản test (đã ghép đôi sẵn): `lan@test.vn` / `minh@test.vn`, mật khẩu `password123`.
- Dừng: `Ctrl+C` ở cả 2 terminal, rồi `docker compose stop` (giữ dữ liệu). `docker compose down -v` sẽ **xoá sạch DB**.

## Test

```bash
cd backend && ./mvnw test            # cần Docker (Testcontainers)
```

## Mobile (Expo)

```bash
cd mobile
npm install                 # lần đầu
./dev.sh                    # = Terminal 2 ở trên
npm test                    # unit/screen tests
```

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

### Giao diện (UI v2)

Thiết kế: `docs/design/mock-v2/` (bản sống: canvas "Couple App · Mock v2"). Tab: Trang chủ · Nhật ký · + · Người ấy · Tôi.

- Chưa ghép đôi vẫn dùng được: Nhật ký/Khoảnh khắc riêng, nhắc tự đặt, chu kỳ. Ghép đôi bằng mã mời, nhập mã hoặc tìm theo ID.
- Nút + mở camera; chụp/chọn ảnh → hiệu ứng → lưu thành **Khoảnh khắc** (không nhắc) hoặc **mốc cần nhớ** (có nhắc, lặp tuần/tháng/năm).
- Đăng nhập Apple/Google/Facebook: mới có nút, bấm báo "Sắp ra mắt" (backend chưa hỗ trợ).
- Hiệu ứng "Tai thỏ" đặt cố định, chưa nhận diện khuôn mặt.

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

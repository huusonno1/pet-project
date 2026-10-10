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

#!/usr/bin/env bash
# Terminal 1 — bật Postgres/Redis/MinIO rồi chạy API :8080 cho điện thoại thật.
# URL ảnh presigned trỏ về IP LAN (không phải localhost) để điện thoại tải ảnh lên được.
set -euo pipefail
cd "$(dirname "$0")"
IP="${LAN_IP:-$(hostname -I | awk '{print $1}')}"
if [ -z "${JAVA_HOME:-}" ] && [ -d "$HOME/.jdks/temurin-21" ]; then
  export JAVA_HOME="$HOME/.jdks/temurin-21"   # java mặc định của máy là 17, backend cần 21
fi
docker compose -f ../docker-compose.yml up -d
echo "API: http://$IP:8080 · MinIO public endpoint: http://$IP:9000"
APP_STORAGE_PUBLIC_ENDPOINT="http://$IP:9000" exec ./mvnw spring-boot:run

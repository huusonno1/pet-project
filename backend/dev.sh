#!/usr/bin/env bash
# Chạy backend cho điện thoại thật: URL ảnh presigned trỏ về IP LAN thay vì localhost.
set -euo pipefail
cd "$(dirname "$0")"
IP="${LAN_IP:-$(hostname -I | awk '{print $1}')}"
echo "MinIO public endpoint: http://$IP:9000"
APP_STORAGE_PUBLIC_ENDPOINT="http://$IP:9000" exec ./mvnw spring-boot:run

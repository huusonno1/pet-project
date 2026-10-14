#!/usr/bin/env bash
# Terminal 2 — chạy Expo cho Expo Go, API trỏ về IP LAN hiện tại (IP đổi theo Wi-Fi nên không cố định trong .env).
set -euo pipefail
cd "$(dirname "$0")"
IP="${LAN_IP:-$(hostname -I | awk '{print $1}')}"
echo "EXPO_PUBLIC_API_URL=http://$IP:8080"
EXPO_PUBLIC_API_URL="http://$IP:8080" exec npx expo start --go --clear "$@"

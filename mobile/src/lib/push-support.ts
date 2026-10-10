/**
 * Expo Go trên Android (SDK 53+) đã bỏ push từ xa và ném lỗi ngay khi import `expo-notifications`.
 * `environment` là `Constants.executionEnvironment` ('storeClient' = Expo Go).
 */
export function isPushSupported(os: string, environment: string | undefined): boolean {
  return !(os === 'android' && environment === 'storeClient');
}

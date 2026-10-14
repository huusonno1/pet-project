import { Alert } from 'react-native';

const LABELS = { apple: 'Apple', google: 'Google', facebook: 'Facebook' } as const;

/** Backend chưa hỗ trợ đăng nhập mạng xã hội (spec §12.1) — chỉ báo cho người dùng. */
export function socialComingSoon(provider: keyof typeof LABELS) {
  Alert.alert('Sắp ra mắt', `Đăng nhập bằng ${LABELS[provider]} sẽ có trong bản cập nhật tới. Hiện bạn dùng email và mật khẩu nhé.`);
}

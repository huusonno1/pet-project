import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useAnimatedStyle } from 'react-native-reanimated';

/**
 * paddingBottom = đúng chiều cao bàn phím, chạy theo animation của bàn phím.
 * Dùng cho view chạm đáy màn hình vật lý (Modal, màn stack — app edge-to-edge); khi đó không cần đo
 * vị trí view — phép đo của KeyboardAvoidingView lệch đúng bằng thanh điều hướng Android nên để hở khe.
 */
export function useKeyboardInset() {
  const { height } = useReanimatedKeyboardAnimation(); // 0 → -chiều cao bàn phím
  return useAnimatedStyle(() => ({ paddingBottom: Math.max(0, -height.value) }));
}

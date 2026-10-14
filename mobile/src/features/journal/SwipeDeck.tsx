import { useLayoutEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

export type DeckCard = { key: string; node: React.ReactNode };

type Props = {
  width: number;
  height: number;
  card: DeckCard;
  prevCard: DeckCard | null;
  nextCard: DeckCard | null;
  onPrev: () => void;
  onNext: () => void;
};

const SWIPE_VELOCITY = 800;

/**
 * Thẻ vuốt kiểu Tinder: kéo theo ngón tay, nghiêng nhẹ; quá 1/4 bề ngang (hoặc vuốt nhanh) thì bay ra
 * và chuyển — trái = tiếp theo, phải = trước đó. Thẻ kế tiếp nằm sau, phóng to dần khi kéo.
 *
 * Mỗi thẻ giữ nguyên `key` khi đổi vai (sau → trên cùng) nên ảnh đã tải sẵn không bị dựng lại — tránh
 * nháy/giật lúc chuyển. Vị trí được trả về 0 trong useLayoutEffect (trước khi vẽ) cùng lúc đổi vai.
 */
export function SwipeDeck({ width, height, card, prevCard, nextCard, onPrev, onNext }: Props) {
  const tx = useSharedValue(0);
  const canNext = nextCard !== null;
  const canPrev = prevCard !== null;

  useLayoutEffect(() => {
    tx.value = 0;
  }, [card.key, tx]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-16, 16])
        .onUpdate((e) => {
          const blocked = (e.translationX < 0 && !canNext) || (e.translationX > 0 && !canPrev);
          tx.value = blocked ? e.translationX * 0.15 : e.translationX;
        })
        .onEnd((e) => {
          const far = Math.abs(tx.value) > width * 0.25 || Math.abs(e.velocityX) > SWIPE_VELOCITY;
          if (far && tx.value < 0 && canNext) {
            tx.value = withTiming(-width * 1.4, { duration: 200 }, (done) => done && runOnJS(onNext)());
          } else if (far && tx.value > 0 && canPrev) {
            tx.value = withTiming(width * 1.4, { duration: 200 }, (done) => done && runOnJS(onPrev)());
          } else {
            tx.value = withSpring(0, { damping: 18, stiffness: 220 });
          }
        }),
    [width, canNext, canPrev, onNext, onPrev, tx],
  );

  const topStyle = useAnimatedStyle(() => ({
    opacity: 1,
    transform: [{ translateX: tx.value }, { rotate: `${interpolate(tx.value, [-width, width], [-12, 12])}deg` }, { scale: 1 }],
  }));
  // Thẻ phía sau theo hướng kéo: kéo trái hiện thẻ tiếp theo, kéo phải hiện thẻ trước.
  const nextStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, -tx.value / (width * 0.5)));
    return { opacity: tx.value < 0 ? 1 : 0, transform: [{ translateX: 0 }, { rotate: '0deg' }, { scale: 0.92 + 0.08 * t }] };
  });
  const prevStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, tx.value / (width * 0.5)));
    return { opacity: tx.value > 0 ? 1 : 0, transform: [{ translateX: 0 }, { rotate: '0deg' }, { scale: 0.92 + 0.08 * t }] };
  });

  // Thứ tự vẽ: thẻ sau trước, thẻ trên cùng cuối cùng.
  const layers = [
    nextCard && { ...nextCard, style: nextStyle },
    prevCard && { ...prevCard, style: prevStyle },
    { ...card, style: topStyle },
  ].filter((l): l is DeckCard & { style: typeof topStyle } => !!l);

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width, height }}>
        {layers.map((l) => (
          <Animated.View key={l.key} style={[StyleSheet.absoluteFill, l.style]}>{l.node}</Animated.View>
        ))}
      </View>
    </GestureDetector>
  );
}

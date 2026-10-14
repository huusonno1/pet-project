import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

type Props = {
  width: number;
  height: number;
  /** Đổi khi thẻ trên cùng đổi nội dung — để đưa thẻ về giữa. */
  cardKey: string;
  card: React.ReactNode;
  prevCard: React.ReactNode | null;
  nextCard: React.ReactNode | null;
  onPrev: () => void;
  onNext: () => void;
};

const SWIPE_VELOCITY = 800;

/**
 * Thẻ vuốt kiểu Tinder: kéo theo ngón tay, nghiêng nhẹ; quá 1/4 bề ngang (hoặc vuốt nhanh) thì bay ra
 * và chuyển — trái = tiếp theo, phải = trước đó. Thẻ kế tiếp nằm sau, phóng to dần khi kéo.
 */
export function SwipeDeck({ width, height, cardKey, card, prevCard, nextCard, onPrev, onNext }: Props) {
  const tx = useSharedValue(0);
  const canNext = nextCard !== null;
  const canPrev = prevCard !== null;

  useEffect(() => {
    tx.value = 0;
  }, [cardKey, tx]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      const blocked = (e.translationX < 0 && !canNext) || (e.translationX > 0 && !canPrev);
      tx.value = blocked ? e.translationX * 0.15 : e.translationX;
    })
    .onEnd((e) => {
      const far = Math.abs(tx.value) > width * 0.25 || Math.abs(e.velocityX) > SWIPE_VELOCITY;
      if (far && tx.value < 0 && canNext) {
        tx.value = withTiming(-width * 1.4, { duration: 200 }, () => runOnJS(onNext)());
      } else if (far && tx.value > 0 && canPrev) {
        tx.value = withTiming(width * 1.4, { duration: 200 }, () => runOnJS(onPrev)());
      } else {
        tx.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const top = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { rotate: `${interpolate(tx.value, [-width, width], [-12, 12])}deg` }],
  }));
  // Thẻ phía sau theo hướng kéo: kéo trái hiện thẻ tiếp theo, kéo phải hiện thẻ trước.
  const nextStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, -tx.value / (width * 0.5)));
    return { opacity: tx.value < 0 ? 1 : 0, transform: [{ scale: 0.92 + 0.08 * t }] };
  });
  const prevStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, tx.value / (width * 0.5)));
    return { opacity: tx.value > 0 ? 1 : 0, transform: [{ scale: 0.92 + 0.08 * t }] };
  });

  return (
    <View style={{ width, height }}>
      {nextCard ? <Animated.View style={[StyleSheet.absoluteFill, nextStyle]}>{nextCard}</Animated.View> : null}
      {prevCard ? <Animated.View style={[StyleSheet.absoluteFill, prevStyle]}>{prevCard}</Animated.View> : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={[StyleSheet.absoluteFill, top]}>{card}</Animated.View>
      </GestureDetector>
    </View>
  );
}

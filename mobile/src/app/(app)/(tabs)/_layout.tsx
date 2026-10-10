import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { colors } from '@/ui/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color} size={size} />;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerTintColor: colors.text }}>
      <Tabs.Screen name="index" options={{ title: 'Trang chủ', tabBarIcon: tabIcon('heart') }} />
    </Tabs>
  );
}

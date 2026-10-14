import { useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar, TabName } from '@/ui/TabBar';

export default function TabsLayout() {
  const client = useQueryClient();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <TabBar active={state.routes[state.index].name} onSelect={(name: TabName) => {
            // Chuyển tab → lấy lại dữ liệu đã cũ để thấy ngay thay đổi của người kia.
            client.refetchQueries({ type: 'active', stale: true });
            navigation.navigate(name);
          }} />
      )}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="journal" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="partner" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}

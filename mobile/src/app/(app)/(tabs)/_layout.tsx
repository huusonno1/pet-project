import { Tabs } from 'expo-router/js-tabs';

import { TabBar, TabName } from '@/ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <TabBar active={state.routes[state.index].name} onSelect={(name: TabName) => navigation.navigate(name)} />
      )}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="journal" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="partner" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}

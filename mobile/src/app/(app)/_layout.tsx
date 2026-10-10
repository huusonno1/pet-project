import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useCouple } from '@/features/couple/api';
import { errorMessage } from '@/lib/api/client';
import { Button } from '@/ui/Button';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { colors } from '@/ui/theme';

export default function AppLayout() {
  const couple = useCouple();

  if (couple.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (couple.isError) {
    return (
      <Screen>
        <ErrorText message={errorMessage(couple.error)} />
        <Button title="Thử lại" onPress={() => couple.refetch()} />
      </Screen>
    );
  }

  const paired = couple.data !== null;
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary }}>
      <Stack.Protected guard={paired}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="moments/new" options={{ title: 'Kỷ niệm mới' }} />
        <Stack.Screen name="moments/[id]/index" options={{ title: 'Kỷ niệm' }} />
        <Stack.Screen name="moments/[id]/edit" options={{ title: 'Sửa kỷ niệm' }} />
      </Stack.Protected>
      <Stack.Protected guard={!paired}>
        <Stack.Screen name="pair" options={{ title: 'Ghép đôi' }} />
      </Stack.Protected>
    </Stack>
  );
}

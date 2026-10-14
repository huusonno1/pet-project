import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useCouple } from '@/features/couple/api';
import { GenderPromptSheet } from '@/features/me/GenderPromptSheet';
import { errorMessage } from '@/lib/api/client';
import { useLiveSync } from '@/lib/use-live-sync';
import { useOnboardingRedirect } from '@/lib/use-onboarding';
import { useNotificationRouting, usePushRegistration } from '@/lib/use-push';
import { Button } from '@/ui/Button';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { colors } from '@/ui/theme';

export default function AppLayout() {
  const couple = useCouple();
  usePushRegistration();
  useNotificationRouting();
  useLiveSync();
  useOnboardingRedirect(couple.isSuccess ? couple.data !== null : undefined);

  if (couple.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.roseStrong} />
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
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <GenderPromptSheet />
    </>
  );
}

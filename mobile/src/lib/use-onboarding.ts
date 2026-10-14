import { router } from 'expo-router';
import { useEffect } from 'react';

import { useSession } from '@/lib/auth/session';

/** Vừa đăng ký và chưa có cặp → mở màn ghép đôi một lần (A2 → A3 trong mock). */
export function useOnboardingRedirect(paired: boolean | undefined) {
  const { onboarding, finishOnboarding } = useSession();
  useEffect(() => {
    if (!onboarding || paired === undefined) return;
    finishOnboarding();
    if (!paired) router.push('/pair');
  }, [onboarding, paired, finishOnboarding]);
}

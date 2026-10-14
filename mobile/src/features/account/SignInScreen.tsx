import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { errorMessage } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { SocialButton } from '@/ui/SocialButton';
import { TextField } from '@/ui/TextField';
import { colors } from '@/ui/theme';
import { TopBar } from '@/ui/TopBar';

import { socialComingSoon } from './social';
import { OrDivider } from './SignUpScreen';

export default function SignInScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen gap={12}>
      <TopBar />
      <View style={{ gap: 6, marginBottom: 4 }}>
        <AppText variant="display">Chào mừng trở lại</AppText>
        <AppText color={colors.textMuted}>Đăng nhập để xem người ấy có gì mới.</AppText>
      </View>
      <SocialButton provider="apple" onPress={() => socialComingSoon('apple')} />
      <SocialButton provider="google" onPress={() => socialComingSoon('google')} />
      <SocialButton provider="facebook" onPress={() => socialComingSoon('facebook')} />
      <OrDivider label="hoặc" />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextField label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry />
      <Pressable accessibilityRole="button" style={{ alignSelf: 'flex-end' }}
        onPress={() => Alert.alert('Quên mật khẩu?', 'Tính năng đặt lại mật khẩu sắp ra mắt.')}>
        <AppText variant="captionStrong" color={colors.roseStrong}>Quên mật khẩu?</AppText>
      </Pressable>
      <ErrorText message={error} />
      <Button title="Đăng nhập" onPress={submit} loading={loading} />
    </Screen>
  );
}

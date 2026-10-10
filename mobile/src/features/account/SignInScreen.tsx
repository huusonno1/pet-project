import { router } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { Button } from '@/ui/Button';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { Title } from '@/ui/Title';

export default function SignInScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Nhập email và mật khẩu');
      return;
    }
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
    <Screen>
      <Title>Đăng nhập 💞</Title>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextField label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      <ErrorText message={error} />
      <Button title="Đăng nhập" onPress={submit} loading={loading} />
      <Button title="Chưa có tài khoản? Đăng ký" variant="secondary" onPress={() => router.push('/sign-up')} />
    </Screen>
  );
}

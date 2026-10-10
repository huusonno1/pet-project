import { router } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { Button } from '@/ui/Button';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { Title } from '@/ui/Title';

export function validateSignUp(name: string, email: string, password: string, confirm: string): string | null {
  if (!name.trim()) return 'Nhập tên hiển thị';
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Email không hợp lệ';
  if (password.length < 8) return 'Mật khẩu tối thiểu 8 ký tự';
  if (password !== confirm) return 'Mật khẩu nhập lại không khớp';
  return null;
}

export default function SignUpScreen() {
  const { signUp } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const problem = validateSignUp(name, email, password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signUp(email.trim(), password, name.trim());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>Tạo tài khoản</Title>
      <TextField label="Tên hiển thị" value={name} onChangeText={setName} />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextField label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry />
      <TextField label="Nhập lại mật khẩu" value={confirm} onChangeText={setConfirm} secureTextEntry />
      <ErrorText message={error} />
      <Button title="Tạo tài khoản" onPress={submit} loading={loading} />
      <Button title="Đã có tài khoản? Đăng nhập" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

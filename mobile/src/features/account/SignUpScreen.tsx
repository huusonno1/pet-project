import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '@/lib/api/client';
import type { Gender } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { SocialButton } from '@/ui/SocialButton';
import { TextField } from '@/ui/TextField';
import { colors } from '@/ui/theme';
import { TopBar } from '@/ui/TopBar';

import { GenderPicker } from './GenderPicker';
import { socialComingSoon } from './social';

export function validateSignUp(name: string, email: string, password: string, gender: Gender | null): string | null {
  if (!name.trim()) return 'Nhập tên hiển thị';
  if (!gender) return 'Chọn giới tính';
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Email không hợp lệ';
  if (password.length < 8) return 'Mật khẩu tối thiểu 8 ký tự';
  return null;
}

export function OrDivider({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
      <AppText variant="caption" color={colors.textMuted}>{label}</AppText>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
    </View>
  );
}

export default function SignUpScreen() {
  const { signUp } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const problem = validateSignUp(name, email, password, gender);
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signUp(email.trim(), password, name.trim(), gender!);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen gap={12}>
      <TopBar right={<AppText variant="caption" color={colors.textMuted}>Bước 1/2</AppText>} />
      <View style={{ gap: 6, marginBottom: 4 }}>
        <AppText variant="display">Tạo tài khoản</AppText>
        <AppText color={colors.textMuted}>Đăng ký nhanh bằng tài khoản có sẵn.</AppText>
      </View>
      <SocialButton provider="apple" onPress={() => socialComingSoon('apple')} />
      <SocialButton provider="google" onPress={() => socialComingSoon('google')} />
      <SocialButton provider="facebook" onPress={() => socialComingSoon('facebook')} />
      <OrDivider label="hoặc dùng email" />
      <TextField label="Tên hiển thị" value={name} onChangeText={setName} />
      <GenderPicker value={gender} onChange={setGender} />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextField label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry />
      <ErrorText message={error} />
      <Button title="Tạo tài khoản" onPress={submit} loading={loading} />
    </Screen>
  );
}

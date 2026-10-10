import { useState } from 'react';
import { Share, StyleSheet, Text } from 'react-native';

import { errorMessage } from '@/lib/api/client';
import type { Invite } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session';
import { formatTime } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DateField } from '@/ui/DateField';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { useCouple, useCreateInvite, useJoinCouple } from './api';

export default function PairScreen() {
  const { signOut } = useSession();
  const [invite, setInvite] = useState<Invite | null>(null);
  // Đang chờ người ấy nhập mã → hỏi lại server mỗi 5 giây
  useCouple(invite ? 5000 : undefined);
  const createInvite = useCreateInvite();
  const join = useJoinCouple();
  const [code, setCode] = useState('');
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  async function onCreate() {
    setError(null);
    try {
      setInvite(await createInvite.mutateAsync());
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onJoin() {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError('Nhập mã mời');
      return;
    }
    setError(null);
    try {
      await join.mutateAsync(startedOn ? { code: normalized, startedDatingOn: startedOn } : { code: normalized });
      setJoined(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen>
      <Title>Ghép đôi với người ấy</Title>
      <Card>
        <Text style={styles.heading}>Bạn mời người ấy</Text>
        {invite ? (
          <>
            <Text style={styles.code} selectable>
              {invite.code}
            </Text>
            <Text style={styles.muted}>Hết hạn lúc {formatTime(invite.expiresAt)}</Text>
            <Text style={styles.muted}>Đang chờ người ấy nhập mã…</Text>
            <Button
              title="Gửi mã cho người ấy"
              variant="secondary"
              onPress={() => Share.share({ message: `Mã ghép đôi Couple App của mình: ${invite.code}` })}
            />
          </>
        ) : (
          <Button title="Tạo mã mời" onPress={onCreate} loading={createInvite.isPending} />
        )}
      </Card>
      <Card>
        <Text style={styles.heading}>Người ấy đã gửi mã cho bạn?</Text>
        <TextField label="Mã mời của người ấy" value={code} onChangeText={setCode} autoCapitalize="characters" />
        <DateField label="Ngày bắt đầu yêu (không bắt buộc)" value={startedOn} onChange={setStartedOn} />
        <Button title="Ghép đôi" onPress={onJoin} loading={join.isPending} />
      </Card>
      <ErrorText message={error} />
      {joined && <Text style={styles.success}>Ghép đôi thành công 💞</Text>}
      <Button title="Đăng xuất" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontWeight: '600', fontSize: 16, marginBottom: spacing.sm, color: colors.text },
  code: { fontSize: 32, fontWeight: '800', letterSpacing: 4, color: colors.primary, textAlign: 'center' },
  muted: { color: colors.muted, textAlign: 'center', marginTop: spacing.xs },
  success: { color: colors.success, fontWeight: '600', textAlign: 'center', marginVertical: spacing.md },
});

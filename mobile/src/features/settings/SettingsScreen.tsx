import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { useMe, useSettings, useUpdateMe, useUpdateSettings } from '@/features/account/api';
import { useCouple, useEndCouple } from '@/features/couple/api';
import { uploadImage } from '@/features/media/upload';
import { apiFetch, errorMessage } from '@/lib/api/client';
import type { MomentType } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session';
import { formatDate } from '@/lib/format';
import { getLastPushToken } from '@/lib/push';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DateField } from '@/ui/DateField';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

const NOTIFY_LABELS: { type: MomentType; label: string }[] = [
  { type: 'ANNIVERSARY', label: 'Nhắc kỷ niệm' },
  { type: 'DATE_PLAN', label: 'Nhắc lịch hẹn' },
  { type: 'GIFT_OCCASION', label: 'Nhắc dịp tặng quà' },
  { type: 'CYCLE', label: 'Nhắc chu kỳ' },
  { type: 'CUSTOM', label: 'Nhắc khác' },
];

export default function SettingsScreen() {
  const { signOut } = useSession();
  const me = useMe();
  const updateMe = useUpdateMe();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const couple = useCouple();
  const endCouple = useEndCouple();
  const [name, setName] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = name ?? me.data?.displayName ?? '';
  const birthdayValue = birthday ?? me.data?.birthday ?? null;

  async function saveProfile() {
    setError(null);
    const body: { displayName?: string; birthday?: string } = {};
    if (name !== null && name.trim()) body.displayName = name.trim();
    if (birthday !== null) body.birthday = birthday;
    try {
      await updateMe.mutateAsync(body);
      setName(null);
      setBirthday(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function changeAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled) return;
    setUploading(true);
    setError(null);
    try {
      const media = await uploadImage(result.assets[0].uri, { purpose: 'AVATAR' });
      await updateMe.mutateAsync({ avatarMediaId: media.id });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  function confirmEndCouple() {
    Alert.alert('Kết thúc cặp đôi?', 'Hai bạn sẽ không còn xem chung kỷ niệm, nhắc nhở sắp tới bị huỷ.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Kết thúc', style: 'destructive', onPress: () => endCouple.mutate() },
    ]);
  }

  async function handleSignOut() {
    const token = getLastPushToken();
    if (token) {
      await apiFetch(`/api/me/devices?token=${encodeURIComponent(token)}`, { method: 'DELETE' }).catch(() => undefined);
    }
    await signOut();
  }

  const prefs = settings.data?.notifyPrefs ?? {};

  return (
    <Screen>
      <Card>
        <Title>Hồ sơ</Title>
        <View style={styles.avatarRow}>
          {me.data?.avatarUrl ? (
            <Image source={{ uri: me.data.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Text style={styles.avatarLetter}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Button title="Đổi ảnh đại diện" variant="secondary" onPress={changeAvatar} loading={uploading} />
          </View>
        </View>
        <TextField label="Tên hiển thị" value={displayName} onChangeText={setName} />
        <DateField label="Sinh nhật" value={birthdayValue} onChange={setBirthday} />
        <Button title="Lưu hồ sơ" onPress={saveProfile} loading={updateMe.isPending && !uploading} />
        <ErrorText message={error} />
      </Card>

      <Card>
        <Title>Quyền riêng tư</Title>
        <SettingSwitch
          label="Chia sẻ vị trí"
          value={settings.data?.shareLocation ?? true}
          onChange={(shareLocation) => updateSettings.mutate({ shareLocation })}
        />
        <SettingSwitch
          label="Chia sẻ chu kỳ với người ấy"
          value={settings.data?.shareCycle ?? true}
          onChange={(shareCycle) => updateSettings.mutate({ shareCycle })}
        />
      </Card>

      <Card>
        <Title>Thông báo</Title>
        {NOTIFY_LABELS.map(({ type, label }) => (
          <SettingSwitch
            key={type}
            label={label}
            value={prefs[type] ?? true}
            onChange={(value) => updateSettings.mutate({ notifyPrefs: { [type]: value } })}
          />
        ))}
      </Card>

      {couple.data && (
        <Card>
          <Title>Cặp đôi</Title>
          <Text style={styles.text}>Đang yêu {couple.data.partner.displayName} 💞</Text>
          {couple.data.startedDatingOn && (
            <Text style={styles.muted}>Từ {formatDate(couple.data.startedDatingOn)}</Text>
          )}
          <Button title="Kết thúc cặp đôi" variant="danger" onPress={confirmEndCouple} loading={endCouple.isPending} />
        </Card>
      )}

      <Button title="Đăng xuất" variant="secondary" onPress={handleSignOut} />
    </Screen>
  );
}

function SettingSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.text}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarEmpty: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontSize: 26, fontWeight: '700' },
  text: { color: colors.text, flex: 1 },
  muted: { color: colors.muted, marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
});

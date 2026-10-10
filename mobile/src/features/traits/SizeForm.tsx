import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { errorMessage } from '@/lib/api/client';
import type { CatalogItem, SizeEntry } from '@/lib/api/types';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { useDeleteSize, useSaveSize } from './api';

type Props = { subjectUserId: string; meId: string; kinds: CatalogItem[]; initial?: SizeEntry; onClose: () => void };

export function SizeForm({ subjectUserId, meId, kinds, initial, onClose }: Props) {
  const save = useSaveSize(subjectUserId);
  const remove = useDeleteSize(subjectUserId);
  const [kind, setKind] = useState(initial?.kind ?? '');
  const [value, setValue] = useState(initial?.value ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [secret, setSecret] = useState(initial?.visibility === 'AUTHOR_ONLY');
  const [error, setError] = useState<string | null>(null);
  const canSetSecret = subjectUserId !== meId && (!initial || initial.createdBy === meId);

  async function submit() {
    if (!kind || !value.trim()) {
      setError('Chọn loại và nhập size');
      return;
    }
    const body: Record<string, unknown> = { kind, value: value.trim(), note: note.trim() };
    if (canSetSecret) body.visibility = secret ? 'AUTHOR_ONLY' : 'SHARED';
    if (!initial) body.subjectUserId = subjectUserId;
    try {
      await save.mutateAsync({ id: initial?.id, body });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen>
      <Title>{initial ? 'Sửa size' : 'Thêm size'}</Title>
      <View style={styles.chips}>
        {kinds.map((k) => (
          <Chip key={k.code} label={k.label} selected={kind === k.code} onPress={() => setKind(k.code)} />
        ))}
      </View>
      <TextField label="Size" value={value} onChangeText={setValue} />
      <TextField label="Ghi chú" value={note} onChangeText={setNote} />
      {canSetSecret && (
        <View style={styles.switchRow}>
          <Text style={styles.text}>Giữ bí mật (chỉ mình tôi thấy)</Text>
          <Switch
            accessibilityLabel="Giữ bí mật (chỉ mình tôi thấy)"
            value={secret}
            onValueChange={setSecret}
            trackColor={{ true: colors.primary }}
          />
        </View>
      )}
      <ErrorText message={error} />
      <Button title="Lưu size" onPress={submit} loading={save.isPending} />
      {initial && (
        <Button
          title="Xoá"
          variant="danger"
          onPress={async () => {
            await remove.mutateAsync(initial.id);
            onClose();
          }}
        />
      )}
      <Button title="Đóng" variant="secondary" onPress={onClose} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  text: { color: colors.text, flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
});

import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useCatalog, useDeleteSize, useSaveSize } from '@/features/traits/api';
import { errorMessage } from '@/lib/api/client';
import type { SizeEntry } from '@/lib/api/types';
import { AppText } from '@/ui/AppText';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ErrorText } from '@/ui/ErrorText';
import { IconCircle } from '@/ui/IconCircle';
import { Sheet } from '@/ui/Sheet';
import { TextField } from '@/ui/TextField';
import { colors } from '@/ui/theme';
import { Toggle } from '@/ui/Toggle';

const LETTER_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const LETTER_KINDS = ['SHIRT', 'PANTS', 'BRA'];

type Props = { visible: boolean; subjectId: string; subjectName: string; isSelf?: boolean; entry?: SizeEntry | null; onClose: () => void };

export function SecretRow({ value, onChange, name }: { value: boolean; onChange: (v: boolean) => void; name: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.lavender }}>
      <IconCircle name="lock" bg={colors.surface} color={colors.lavenderInk} size={32} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">Giữ bí mật</AppText>
        <AppText variant="caption" color={colors.textMuted}>Chỉ mình bạn thấy — {name} sẽ không biết</AppText>
      </View>
      <Toggle label="Giữ bí mật" value={value} onValueChange={onChange} />
    </View>
  );
}

export function SizeSheet({ visible, subjectId, subjectName, isSelf, entry, onClose }: Props) {
  const catalog = useCatalog();
  const save = useSaveSize(subjectId);
  const remove = useDeleteSize(subjectId);
  const [kind, setKind] = useState('SHIRT');
  const [letter, setLetter] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const [secret, setSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setKind(entry?.kind ?? 'SHIRT');
    const isLetter = !!entry && LETTER_SIZES.includes(entry.value);
    setLetter(isLetter ? entry!.value : null);
    setCustom(entry && !isLetter ? entry.value : '');
    setNote(entry?.note ?? '');
    setSecret(entry?.visibility === 'AUTHOR_ONLY');
    setError(null);
  }, [visible, entry]);

  async function submit() {
    const value = custom.trim() || letter;
    if (!value) return setError('Chọn hoặc nhập size');
    const body: Record<string, unknown> = { kind, value, note: note.trim() || undefined, visibility: secret ? 'AUTHOR_ONLY' : 'SHARED' };
    if (!entry) body.subjectUserId = subjectId;
    if (body.note === undefined) delete body.note;
    try {
      await save.mutateAsync({ id: entry?.id, body });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={entry ? 'Sửa size' : isSelf ? 'Thêm size của tôi' : `Thêm size cho ${subjectName}`}
      subtitle="Để chọn quà vừa vặn" right={<Avatar name={subjectName} tone={isSelf ? 'rose' : 'lavender'} size={32} />}>
      <AppText variant="micro" color={colors.textMuted}>LOẠI</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(catalog.data?.sizeKinds ?? []).map((k) => <Chip key={k.code} label={k.label} selected={kind === k.code} onPress={() => setKind(k.code)} />)}
      </View>
      {LETTER_KINDS.includes(kind) ? (
        <>
          <AppText variant="micro" color={colors.textMuted}>SIZE</AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {LETTER_SIZES.map((s) => (
              <Pressable key={s} accessibilityRole="button" accessibilityLabel={`Size ${s}`} accessibilityState={{ selected: letter === s }}
                onPress={() => { setLetter(s); setCustom(''); }}
                style={{ flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: letter === s ? colors.roseStrong : colors.line, backgroundColor: letter === s ? colors.roseStrong : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <AppText variant="bodyStrong" color={letter === s ? colors.white : colors.text}>{s}</AppText>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <TextField label="Hoặc nhập size khác" value={custom} onChangeText={setCustom} placeholder="VD: 170/88A, 42.5…" />
      <TextField label="Ghi chú" value={note} onChangeText={setNote} placeholder="Thích form rộng, cổ tròn" />
      {!isSelf ? <SecretRow value={secret} onChange={setSecret} name={subjectName} /> : null}
      <ErrorText message={error} />
      <Button title="Lưu size" onPress={submit} loading={save.isPending} />
      {entry ? <Button title="Xoá" variant="danger" onPress={async () => { await remove.mutateAsync(entry.id); onClose(); }} /> : null}
    </Sheet>
  );
}

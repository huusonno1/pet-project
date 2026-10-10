import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { errorMessage } from '@/lib/api/client';
import type { CatalogItem, Preference } from '@/lib/api/types';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { useDeletePreference, useSavePreference } from './api';
import { LinkDraft, linksFromDrafts } from './editing';

type Props = {
  subjectUserId: string;
  meId: string;
  categories: CatalogItem[];
  initial?: Preference;
  onClose: () => void;
};

export function PreferenceForm({ subjectUserId, meId, categories, initial, onClose }: Props) {
  const save = useSavePreference(subjectUserId);
  const remove = useDeletePreference(subjectUserId);
  const [category, setCategory] = useState(initial?.category ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [links, setLinks] = useState<LinkDraft[]>(
    initial?.links.map((l) => ({ url: l.url, label: l.label ?? '', price: l.price ? String(l.price) : '' })) ?? [],
  );
  const [secret, setSecret] = useState(initial?.visibility === 'AUTHOR_ONLY');
  const [error, setError] = useState<string | null>(null);
  const canSetSecret = subjectUserId !== meId && (!initial || initial.createdBy === meId);

  const updateLink = (index: number, patch: Partial<LinkDraft>) =>
    setLinks((list) => list.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  async function submit() {
    if (!category) {
      setError('Chọn danh mục');
      return;
    }
    const parsed = linksFromDrafts(links);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    const body: Record<string, unknown> = {
      category,
      brand: brand.trim(),
      name: name.trim(),
      color: color.trim(),
      note: note.trim(),
      links: parsed.links,
    };
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
      <Title>{initial ? 'Sửa sở thích' : 'Thêm sở thích'}</Title>
      <View style={styles.chips}>
        {categories.map((c) => (
          <Chip key={c.code} label={c.label} selected={category === c.code} onPress={() => setCategory(c.code)} />
        ))}
      </View>
      <TextField label="Hãng" value={brand} onChangeText={setBrand} />
      <TextField label="Tên sản phẩm" value={name} onChangeText={setName} />
      <TextField label="Màu" value={color} onChangeText={setColor} />
      <TextField label="Ghi chú" value={note} onChangeText={setNote} multiline />

      <Text style={styles.label}>Link mua hàng</Text>
      {links.map((link, index) => (
        <Card key={index}>
          <TextField label={`Link ${index + 1}`} value={link.url} onChangeText={(url) => updateLink(index, { url })} autoCapitalize="none" />
          <TextField label={`Tên link ${index + 1}`} value={link.label} onChangeText={(label) => updateLink(index, { label })} placeholder="Shopee, Lazada…" />
          <TextField label={`Giá ${index + 1} (đ)`} value={link.price} onChangeText={(price) => updateLink(index, { price })} keyboardType="number-pad" />
          <Button title="Bỏ link" variant="secondary" onPress={() => setLinks((list) => list.filter((_, i) => i !== index))} />
        </Card>
      ))}
      {links.length < 10 && (
        <Button title="+ Thêm link" variant="secondary" onPress={() => setLinks((list) => [...list, { url: '', label: '', price: '' }])} />
      )}

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
      <Button title="Lưu sở thích" onPress={submit} loading={save.isPending} />
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
  label: { color: colors.text, fontWeight: '600', marginVertical: spacing.sm },
  text: { color: colors.text, flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
});

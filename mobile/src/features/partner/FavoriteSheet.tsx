import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { uploadImage } from '@/features/media/upload';
import { useCatalog, useDeletePreference, useSavePreference } from '@/features/traits/api';
import { errorMessage } from '@/lib/api/client';
import type { Preference } from '@/lib/api/types';
import { AppText } from '@/ui/AppText';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ErrorText } from '@/ui/ErrorText';
import { Icon } from '@/ui/Icon';
import { PhotoTile } from '@/ui/PhotoTile';
import { Sheet } from '@/ui/Sheet';
import { TextField } from '@/ui/TextField';
import { colors } from '@/ui/theme';

import { storeLabel } from './links';
import { SecretRow } from './SizeSheet';

type Props = { visible: boolean; subjectId: string; subjectName: string; isSelf?: boolean; entry?: Preference | null; onClose: () => void };

export function FavoriteSheet({ visible, subjectId, subjectName, isSelf, entry, onClose }: Props) {
  const catalog = useCatalog();
  const save = useSavePreference(subjectId);
  const remove = useDeletePreference(subjectId);
  const [category, setCategory] = useState('OTHER');
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [links, setLinks] = useState<string[]>(['']);
  const [photo, setPhoto] = useState<string | null>(null);
  const [secret, setSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCategory(entry?.category ?? 'OTHER');
    setBrand(entry?.brand ?? '');
    setName(entry?.name ?? '');
    setLinks(entry?.links.length ? entry.links.map((l) => l.url) : ['']);
    setPhoto(entry?.image?.url ?? null);
    setSecret(entry?.visibility === 'AUTHOR_ONLY');
    setError(null);
  }, [visible, entry]);

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!res.canceled && res.assets?.[0]) setPhoto(res.assets[0].uri);
  }

  async function submit() {
    if (!name.trim() && !brand.trim()) return setError('Nhập tên món hoặc hãng');
    const urls = links.map((l) => l.trim()).filter(Boolean);
    if (urls.some((u) => !/^https?:\/\/\S{3,}$/.test(u))) return setError('Link phải bắt đầu bằng http:// hoặc https://');
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        category,
        brand: brand.trim() || undefined,
        name: name.trim() || undefined,
        visibility: secret ? 'AUTHOR_ONLY' : 'SHARED',
        links: urls.map((url) => ({ url, label: storeLabel(url) })),
      };
      if (!entry) body.subjectUserId = subjectId;
      if (photo && photo !== entry?.image?.url) body.imageMediaId = (await uploadImage(photo, { purpose: 'SHARED' })).id;
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      await save.mutateAsync({ id: entry?.id, body });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const categories = (catalog.data?.preferenceCategories ?? []).filter((c) => c.code !== 'HOBBY');
  return (
    <Sheet visible={visible} onClose={onClose} title={entry ? 'Sửa món thích' : isSelf ? 'Thêm món tôi thích' : `Thêm món ${subjectName} thích`}
      subtitle="Gợi nhớ khi cần chọn quà" right={<Avatar name={subjectName} tone={isSelf ? 'rose' : 'lavender'} size={32} />}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Ảnh món" onPress={pickPhoto}>
          {photo ? <PhotoTile uri={photo} seed="fav" style={{ width: 88, height: 88 }} /> : (
            <View style={{ width: 88, height: 88, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.rose, backgroundColor: colors.roseSoft, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Icon name="camera" size={22} color={colors.roseStrong} />
              <AppText variant="captionStrong" color={colors.roseStrong}>Ảnh món</AppText>
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1, gap: 8 }}>
          <AppText variant="micro" color={colors.textMuted}>DANH MỤC</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {categories.map((c) => <Chip key={c.code} label={c.label} selected={category === c.code} onPress={() => setCategory(c.code)} />)}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><TextField label="Hãng" value={brand} onChangeText={setBrand} placeholder="Keychron" /></View>
        <View style={{ flex: 1 }}><TextField label="Tên món" value={name} onChangeText={setName} placeholder="K2 Pro, switch nâu" /></View>
      </View>
      {links.map((l, i) => (
        <TextField key={i} label={`Link mua hàng ${i + 1}`} value={l} autoCapitalize="none" keyboardType="url" placeholder="https://shopee.vn/…"
          onChangeText={(t) => setLinks(links.map((x, j) => (j === i ? t : x)))} />
      ))}
      {links.length < 10 ? (
        <Pressable accessibilityRole="button" onPress={() => setLinks([...links, ''])}>
          <AppText variant="captionStrong" color={colors.roseStrong}>+ Thêm link khác</AppText>
        </Pressable>
      ) : null}
      {!isSelf ? <SecretRow value={secret} onChange={setSecret} name={subjectName} /> : null}
      <ErrorText message={error} />
      <Button title="Lưu món này" onPress={submit} loading={busy} />
      {entry ? <Button title="Xoá" variant="danger" onPress={async () => { await remove.mutateAsync(entry.id); onClose(); }} /> : null}
    </Sheet>
  );
}

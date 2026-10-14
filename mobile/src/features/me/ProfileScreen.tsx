import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useMe, useUpdateMe } from '@/features/account/api';
import { GenderPicker } from '@/features/account/GenderPicker';
import { useCouple } from '@/features/couple/api';
import { uploadImage } from '@/features/media/upload';
import { FavoriteSheet } from '@/features/partner/FavoriteSheet';
import { SizeSheet } from '@/features/partner/SizeSheet';
import { useCatalog, useTraits } from '@/features/traits/api';
import { catalogLabel } from '@/features/traits/editing';
import { errorMessage } from '@/lib/api/client';
import type { Gender, Preference, SizeEntry } from '@/lib/api/types';
import { formatDate, toIsoDate } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DatePickerSheet } from '@/ui/DatePickerSheet';
import { ErrorText } from '@/ui/ErrorText';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { colors } from '@/ui/theme';
import { TopBar } from '@/ui/TopBar';

export default function ProfileScreen() {
  const me = useMe();
  const couple = useCouple();
  const update = useUpdateMe();
  const traits = useTraits(me.data?.id);
  const catalog = useCatalog();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthday, setBirthday] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sizeSheet, setSizeSheet] = useState<{ entry: SizeEntry | null } | null>(null);
  const [favSheet, setFavSheet] = useState<{ entry: Preference | null } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const partnerName = couple.data?.partner.displayName;

  useEffect(() => {
    if (!me.data) return;
    setName(me.data.displayName);
    setGender(me.data.gender);
    setBirthday(me.data.birthday);
  }, [me.data]);

  async function changeAvatar() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (res.canceled) return;
    setUploading(true);
    setError(null);
    try {
      const media = await uploadImage(res.assets[0].uri, { purpose: 'AVATAR' });
      await update.mutateAsync({ avatarMediaId: media.id });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!name.trim()) return setError('Nhập tên hiển thị');
    setError(null);
    try {
      await update.mutateAsync({ displayName: name.trim(), ...(birthday ? { birthday } : {}), ...(gender && gender !== me.data?.gender ? { gender } : {}) });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const sizes = traits.data?.sizes.filter((s) => s.createdBy === me.data?.id || s.visibility === 'SHARED') ?? [];
  const favorites = traits.data?.preferences ?? [];
  return (
    <Screen bottomPad={40}>
      <TopBar title="Thông tin cá nhân" />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Đổi ảnh đại diện" onPress={changeAvatar} disabled={uploading}>
          <Avatar name={name || '?'} tone="rose" size={84} uri={me.data?.avatarUrl} />
          <View style={{ position: 'absolute', right: -4, bottom: -4, width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.bg, backgroundColor: colors.roseStrong, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="camera" size={15} color={colors.white} />
          </View>
        </Pressable>
        <AppText variant="captionStrong" color={colors.roseStrong}>{uploading ? 'Đang tải ảnh…' : 'Đổi ảnh đại diện'}</AppText>
      </View>
      <TextField label="Tên hiển thị" value={name} onChangeText={setName} />
      {/* ID là định danh duy nhất, hệ thống tự sinh khi đăng ký — chỉ xem và sao chép. */}
      <View style={{ gap: 6 }}>
        <AppText variant="caption" color={colors.textMuted}>ID của bạn (không đổi được)</AppText>
        <View style={{ height: 48, borderRadius: 16, backgroundColor: colors.surfaceMuted, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="bodyStrong">@{me.data?.handle}</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Sao chép ID" hitSlop={8} onPress={() => me.data && Clipboard.setStringAsync(me.data.handle)}>
            <Icon name="copy" size={18} color={colors.roseStrong} />
          </Pressable>
        </View>
      </View>
      <GenderPicker value={gender} onChange={setGender} />
      {me.data?.gender === 'FEMALE' && gender === 'MALE' ? (
        <AppText variant="caption" color={colors.textMuted}>Đổi sang Nam sẽ tắt theo dõi chu kỳ (dữ liệu cũ vẫn được giữ).</AppText>
      ) : null}
      <View style={{ gap: 6 }}>
        <AppText variant="caption" color={colors.textMuted}>Sinh nhật</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={`Sinh nhật ${birthday ? formatDate(birthday) : 'chưa có'}, chạm để đổi`} onPress={() => setPickerOpen(true)}
          style={{ height: 48, borderRadius: 16, borderWidth: 1.5, borderColor: colors.roseStrong, backgroundColor: colors.surface, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText>{birthday ? formatDate(birthday) : 'Chọn ngày sinh'}</AppText>
          <Icon name="calendar" size={18} color={colors.rose} />
        </Pressable>
      </View>
      {partnerName ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.lavender }}>
          <Icon name="eye" size={16} color={colors.lavenderInk} />
          <AppText variant="caption" color={colors.lavenderInk} style={{ flex: 1 }}>Size & món bạn thích dưới đây {partnerName} sẽ thấy ở tab “Người ấy”</AppText>
        </View>
      ) : null}

      <SectionTitle title="Size của tôi" onAdd={() => setSizeSheet({ entry: null })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {sizes.map((s) => <Chip key={s.id} label={`${catalogLabel(catalog.data?.sizeKinds ?? [], s.kind)} ${s.value}`} selected={false} onPress={() => setSizeSheet({ entry: s })} />)}
      </View>
      <SectionTitle title="Món tôi thích" onAdd={() => setFavSheet({ entry: null })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {favorites.map((p) => <Chip key={p.id} label={[p.brand, p.name].filter(Boolean).join(' ') || catalogLabel(catalog.data?.preferenceCategories ?? [], p.category)} selected={false} onPress={() => setFavSheet({ entry: p })} />)}
      </View>

      <ErrorText message={error} />
      <Button title="Lưu thay đổi" onPress={save} loading={update.isPending && !uploading} />

      <DatePickerSheet visible={pickerOpen} title="Chọn ngày sinh" value={birthday ?? '2000-01-01'} quick={false} maxDate={toIsoDate(new Date())}
        onClose={() => setPickerOpen(false)} onConfirm={(d) => { setBirthday(d); setPickerOpen(false); }} />
      {me.data ? (
        <>
          <SizeSheet visible={!!sizeSheet} isSelf subjectId={me.data.id} subjectName={me.data.displayName} entry={sizeSheet?.entry} onClose={() => setSizeSheet(null)} />
          <FavoriteSheet visible={!!favSheet} isSelf subjectId={me.data.id} subjectName={me.data.displayName} entry={favSheet?.entry} onClose={() => setFavSheet(null)} />
        </>
      ) : null}
    </Screen>
  );
}

function SectionTitle({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <AppText variant="h3">{title}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`Thêm vào ${title.toLowerCase()}`} onPress={onAdd}>
        <AppText variant="captionStrong" color={colors.roseStrong}>+ Thêm</AppText>
      </Pressable>
    </View>
  );
}

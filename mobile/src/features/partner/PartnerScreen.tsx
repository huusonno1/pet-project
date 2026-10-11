import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { useMe } from '@/features/account/api';
import { ConnectCard } from '@/features/couple/ConnectCard';
import { useCouple } from '@/features/couple/api';
import { usePrediction } from '@/features/cycle/api';
import { daysUntilBirthday } from '@/features/home/milestone';
import { useCatalog, useTraits } from '@/features/traits/api';
import { canEdit, catalogLabel } from '@/features/traits/editing';
import type { Preference, SizeEntry } from '@/lib/api/types';
import { daysBetween, formatDate } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Avatar } from '@/ui/Avatar';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { IconCircle } from '@/ui/IconCircle';
import { PhotoTile } from '@/ui/PhotoTile';
import { Screen } from '@/ui/Screen';
import { colors } from '@/ui/theme';

import { FavoriteSheet } from './FavoriteSheet';
import { HobbySheet } from './HobbySheet';
import { storeLabel } from './links';
import { SizeSheet } from './SizeSheet';

const CARE_TIPS = ['Túi chườm ấm', 'Trà gừng', 'Socola'];

export default function PartnerScreen() {
  const me = useMe();
  const couple = useCouple();
  const partner = couple.data?.partner;
  const traits = useTraits(partner?.id);
  const catalog = useCatalog();
  const prediction = usePrediction(partner?.id, !!partner);
  const [sizeSheet, setSizeSheet] = useState<{ entry: SizeEntry | null } | null>(null);
  const [favSheet, setFavSheet] = useState<{ entry: Preference | null } | null>(null);
  const [hobbyOpen, setHobbyOpen] = useState(false);

  if (couple.isSuccess && !partner) {
    return <Screen><AppText variant="display">Người ấy</AppText><ConnectCard name={me.data?.displayName ?? 'B'} /></Screen>;
  }
  if (!partner) return <Screen><AppText color={colors.textMuted}>Đang tải…</AppText></Screen>;

  const sizes = traits.data?.sizes ?? [];
  const favorites = (traits.data?.preferences ?? []).filter((p) => p.category !== 'HOBBY');
  const hobbies = (traits.data?.preferences ?? []).filter((p) => p.category === 'HOBBY');
  const birthday = partner.birthday
    ? `Sinh nhật ${formatDate(partner.birthday).slice(0, 5)} · ${daysUntilBirthday(partner.birthday, new Date()) === 0 ? 'hôm nay' : `còn ${daysUntilBirthday(partner.birthday, new Date())} ngày`}`
    : 'Chưa có ngày sinh';
  const cycleDays = prediction.data ? -daysBetween(prediction.data.nextStart, new Date()) : null;
  const meId = me.data?.id ?? '';

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={partner.displayName} tone="lavender" size={56} uri={partner.avatarUrl} />
        <View style={{ gap: 4 }}>
          <AppText variant="display">{partner.displayName}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="gift" size={14} color={colors.peachInk} />
            <AppText variant="caption" color={colors.textMuted}>{birthday}</AppText>
          </View>
        </View>
      </View>

      {cycleDays !== null && cycleDays >= 0 ? (
        <View style={styles.cycle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconCircle name="droplet" bg={colors.surface} color={colors.cycle} size={40} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{cycleDays === 0 ? `Hôm nay có thể là ngày của ${partner.displayName}` : `Khoảng ${cycleDays} ngày nữa là tới ngày của ${partner.displayName}`}</AppText>
              <AppText variant="caption" color={colors.textMuted}>Dự kiến {formatDate(prediction.data!.nextStart).slice(0, 5)} · {partner.displayName} đang chia sẻ với bạn</AppText>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {CARE_TIPS.map((t) => <View key={t} style={styles.tip}><AppText variant="captionStrong">{t}</AppText></View>)}
          </View>
        </View>
      ) : null}

      <Header title="Size" label="Thêm size" onAdd={() => setSizeSheet({ entry: null })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {sizes.length === 0 ? <AppText variant="caption" color={colors.textMuted}>Chưa có size nào.</AppText> : null}
        {sizes.map((s) => (
          <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${catalogLabel(catalog.data?.sizeKinds ?? [], s.kind)} ${s.value}`}
            disabled={!canEdit(s, meId)} onPress={() => setSizeSheet({ entry: s })} style={{ width: '31%' }}>
            <Card style={{ padding: 12, gap: 2 }}>
              <AppText variant="micro" color={colors.textMuted}>{catalogLabel(catalog.data?.sizeKinds ?? [], s.kind).toUpperCase()}</AppText>
              <AppText variant="h2">{s.value}</AppText>
              {s.note ? <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>{s.note}</AppText> : null}
              {s.visibility === 'AUTHOR_ONLY' ? <AppText variant="micro" color={colors.lavenderInk}>BÍ MẬT</AppText> : null}
            </Card>
          </Pressable>
        ))}
      </View>

      <Header title={`Món ${partner.displayName} thích`} label="Thêm món thích" onAdd={() => setFavSheet({ entry: null })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {favorites.length === 0 ? <AppText variant="caption" color={colors.textMuted}>Chưa có món nào.</AppText> : null}
        {favorites.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.name ?? p.brand ?? 'Món thích'} disabled={!canEdit(p, meId)}
            onPress={() => setFavSheet({ entry: p })} style={{ width: '47.5%' }}>
            <Card style={{ padding: 12, gap: 6 }}>
              <PhotoTile uri={p.image?.url} seed={p.id} style={{ height: 92, borderRadius: 16 }}>
                {p.visibility === 'AUTHOR_ONLY' ? (
                  <View style={styles.secret}><Icon name="lock" size={11} color={colors.white} /><AppText variant="micro" color={colors.white} style={{ letterSpacing: 0 }}>BÍ MẬT</AppText></View>
                ) : null}
              </PhotoTile>
              {p.brand ? <AppText variant="micro" color={colors.textMuted}>{p.brand.toUpperCase()}</AppText> : null}
              <AppText variant="bodyStrong" numberOfLines={2}>{p.name ?? catalogLabel(catalog.data?.preferenceCategories ?? [], p.category)}</AppText>
              {p.links[0] ? (
                <Pressable accessibilityRole="link" accessibilityLabel={p.links[0].label ?? storeLabel(p.links[0].url)} onPress={() => Linking.openURL(p.links[0].url)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="link" size={14} color={colors.textMuted} />
                  <AppText variant="caption" color={colors.textMuted}>{p.links[0].label ?? storeLabel(p.links[0].url)}</AppText>
                </Pressable>
              ) : null}
            </Card>
          </Pressable>
        ))}
      </View>

      <AppText variant="h2">Sở thích khác</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {hobbies.map((h) => <Chip key={h.id} label={h.name ?? ''} selected={false} onPress={() => setFavSheet({ entry: h })} />)}
        <Chip label="+ Thêm" selected={false} onPress={() => setHobbyOpen(true)} />
      </View>

      <SizeSheet visible={!!sizeSheet} subjectId={partner.id} subjectName={partner.displayName} entry={sizeSheet?.entry} onClose={() => setSizeSheet(null)} />
      <FavoriteSheet visible={!!favSheet} subjectId={partner.id} subjectName={partner.displayName} entry={favSheet?.entry} onClose={() => setFavSheet(null)} />
      <HobbySheet visible={hobbyOpen} subjectId={partner.id} onClose={() => setHobbyOpen(false)} />
    </Screen>
  );
}

function Header({ title, label, onAdd }: { title: string; label: string; onAdd: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <AppText variant="h2">{title}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onAdd} style={styles.add}>
        <Icon name="plus" size={14} color={colors.roseStrong} />
        <AppText variant="captionStrong" color={colors.roseStrong}>Thêm</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cycle: { padding: 16, gap: 10, borderRadius: 24, backgroundColor: colors.roseSoft },
  tip: { height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.surface, justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingLeft: 10, paddingRight: 12, borderRadius: 999, backgroundColor: colors.roseSoft },
  secret: { position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.text },
});

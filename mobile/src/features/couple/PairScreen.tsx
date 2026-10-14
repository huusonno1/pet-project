import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

import { errorMessage } from '@/lib/api/client';
import type { Invite } from '@/lib/api/types';
import { formatDate, toIsoDate } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DatePickerSheet } from '@/ui/DatePickerSheet';
import { ErrorText } from '@/ui/ErrorText';
import { Icon, IconName } from '@/ui/Icon';
import { IconCircle } from '@/ui/IconCircle';
import { Screen } from '@/ui/Screen';
import { SegmentedTabs } from '@/ui/SegmentedTabs';
import { Sheet } from '@/ui/Sheet';
import { colors, fonts } from '@/ui/theme';
import { TopBar } from '@/ui/TopBar';

import { useCouple, useCreateInvite, useJoinCouple } from './api';
import { countdownLabel, formatInviteCode } from './handle';

type Tab = 'invite' | 'code';

export default function PairScreen() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'code' ? 'code' : 'invite');
  const [laterOpen, setLaterOpen] = useState(false);

  return (
    <Screen gap={16}>
      <TopBar right={
        <Pressable accessibilityRole="button" accessibilityLabel="Để sau" onPress={() => setLaterOpen(true)} hitSlop={8}>
          <AppText variant="bodyStrong" color={colors.roseStrong}>Để sau</AppText>
        </Pressable>
      } />
      <View style={{ gap: 6 }}>
        <AppText variant="display">Kết nối với người ấy</AppText>
        <AppText color={colors.textMuted}>Chọn một cách bên dưới.</AppText>
      </View>
      <SegmentedTabs options={[{ key: 'invite', label: 'Mời người ấy' }, { key: 'code', label: 'Nhập mã' }]} value={tab} onChange={setTab} />
      {tab === 'invite' ? <InvitePanel /> : <CodePanel />}
      <Pressable accessibilityRole="button" onPress={() => router.push('/pair/search')} style={styles.searchLink}>
        <Icon name="search" size={16} color={colors.roseStrong} />
        <AppText variant="captionStrong" color={colors.roseStrong}>Không có mã? Tìm theo ID</AppText>
      </Pressable>
      <LaterSheet visible={laterOpen} onClose={() => setLaterOpen(false)} />
    </Screen>
  );
}

function InvitePanel() {
  const create = useCreateInvite();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const couple = useCouple(invite ? 5000 : undefined); // chờ người ấy nhập mã

  useEffect(() => {
    create.mutateAsync().then(setInvite, (e) => setError(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (invite && couple.data) router.replace('/pair/success');
  }, [invite, couple.data]);

  return (
    <>
      <Card style={{ alignItems: 'center', gap: 14, borderRadius: 28, paddingTop: 22 }}>
        <AppText variant="micro" color={colors.textMuted}>MÃ MỜI CỦA BẠN</AppText>
        <View style={styles.codeBox}>
          <AppText selectable style={styles.code}>{invite ? formatInviteCode(invite.code) : '···· ····'}</AppText>
        </View>
        {invite ? (
          <View style={styles.expiry}>
            <Icon name="clock" size={16} color={colors.peachInk} />
            <AppText variant="captionStrong">Hết hạn sau {countdownLabel(invite.expiresAt, now)}</AppText>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
          <Button title="Sao chép" variant="secondary" compact style={{ flex: 1 }} disabled={!invite}
            onPress={() => invite && Clipboard.setStringAsync(invite.code)} />
          <Button title="Gửi người ấy" compact style={{ flex: 1 }} disabled={!invite}
            onPress={() => invite && Share.share({ message: `Mã ghép đôi Couple App của mình: ${invite.code}` })} />
        </View>
      </Card>
      <ErrorText message={error} />
      <View style={styles.how}>
        {['Gửi mã cho người ấy qua Zalo, Messenger…', 'Người ấy mở app, chọn tab “Nhập mã”', 'Hai bạn tự động được kết nối'].map((t, i) => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.step}><AppText variant="micro" color={colors.white}>{i + 1}</AppText></View>
            <AppText variant="caption">{t}</AppText>
          </View>
        ))}
      </View>
    </>
  );
}

function CodePanel() {
  const join = useJoinCouple();
  const [code, setCode] = useState('');
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    const normalized = code.replace(/\s/g, '').toUpperCase();
    if (!normalized) {
      setError('Nhập mã mời');
      return;
    }
    setError(null);
    try {
      await join.mutateAsync(startedOn ? { code: normalized, startedDatingOn: startedOn } : { code: normalized });
      router.replace('/pair/success');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <Card style={{ borderRadius: 28, gap: 14 }}>
        <AppText variant="h3">Mã người ấy gửi bạn</AppText>
        <TextInput
          accessibilityLabel="Mã người ấy gửi bạn"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          maxLength={9}
          placeholder="XY7K 2M9P"
          placeholderTextColor={colors.roseBorder}
          style={styles.codeInput}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Ngày bắt đầu yêu" onPress={() => setPickerOpen(true)} style={styles.dateRow}>
          <IconCircle name="calendar" bg={colors.surface} color={colors.rose} size={36} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Ngày bắt đầu yêu</AppText>
            <AppText variant="caption" color={colors.textMuted}>{startedOn ? formatDate(startedOn) : 'Chọn ngày (không bắt buộc)'}</AppText>
          </View>
          <Icon name="chevronRight" size={18} color={colors.textMuted} />
        </Pressable>
        <ErrorText message={error} />
        <Button title="Kết nối" onPress={connect} loading={join.isPending} />
      </Card>
      <AppText variant="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
        Mã gồm 8 ký tự, hết hạn sau 1 giờ kể từ khi người ấy tạo.
      </AppText>
      <DatePickerSheet
        visible={pickerOpen}
        title="Ngày hai bạn bắt đầu yêu"
        value={startedOn}
        maxDate={toIsoDate(new Date())}
        onClose={() => setPickerOpen(false)}
        onConfirm={(d) => {
          setStartedOn(d);
          setPickerOpen(false);
        }}
      />
    </>
  );
}

const SOLO_FEATURES: { icon: IconName; bg: string; color: string; label: string }[] = [
  { icon: 'image', bg: colors.lavender, color: colors.lavenderInk, label: 'Nhật ký & khoảnh khắc của riêng bạn' },
  { icon: 'droplet', bg: colors.roseSoft, color: colors.cycle, label: 'Theo dõi chu kỳ (tuỳ chọn)' },
  { icon: 'gift', bg: colors.peachSoft, color: colors.peachInk, label: 'Nhắc sinh nhật, ngày quan trọng' },
];

function LaterSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <IconCircle name="heart" bg={colors.roseSoft} color={colors.rose} size={64} />
        <AppText variant="h2" style={{ textAlign: 'center' }}>Ghép đôi sau cũng được</AppText>
        <AppText color={colors.textMuted} style={{ textAlign: 'center' }}>Chưa có người ấy hay vừa kết thúc? Bạn vẫn dùng được:</AppText>
      </View>
      <Card>
        {SOLO_FEATURES.map((f) => (
          <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconCircle name={f.icon} bg={f.bg} color={f.color} size={32} />
            <AppText variant="bodyStrong" style={{ flex: 1 }}>{f.label}</AppText>
          </View>
        ))}
      </Card>
      <AppText variant="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
        Ghép đôi lúc nào cũng được ở Trang chủ hoặc Tôi. Kỷ niệm riêng vẫn là của bạn — khi ghép đôi, bạn tự chọn có chia sẻ hay không.
      </AppText>
      <Button title="Vào app" onPress={() => { onClose(); router.replace('/'); }} />
      <Button title="Quay lại ghép đôi" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  codeBox: { alignSelf: 'stretch', paddingVertical: 16, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.rose, backgroundColor: colors.roseSoft, alignItems: 'center' },
  code: { fontFamily: fonts.extrabold, fontSize: 36, letterSpacing: 8, color: colors.roseStrong },
  expiry: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.peachSoft },
  how: { padding: 16, borderRadius: 20, backgroundColor: colors.surfaceMuted, gap: 10 },
  step: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.roseStrong, alignItems: 'center', justifyContent: 'center' },
  codeInput: { height: 56, borderRadius: 16, backgroundColor: colors.roseSoft, textAlign: 'center', fontFamily: fonts.bold, fontSize: 24, letterSpacing: 6, color: colors.roseStrong },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.surfaceMuted },
  searchLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', height: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
});

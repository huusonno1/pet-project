import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

import { useMe } from '@/features/account/api';
import { errorMessage } from '@/lib/api/client';
import type { UserCard } from '@/lib/api/types';
import { timeAgo } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ErrorText } from '@/ui/ErrorText';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { colors, fonts } from '@/ui/theme';
import { TopBar } from '@/ui/TopBar';

import { useAcceptPairRequest, useCancelPairRequest, useDeclinePairRequest, useLookupHandle, usePairRequests, useSendPairRequest } from './api';
import { normalizeHandle } from './handle';

export default function PairSearchScreen() {
  const me = useMe();
  const requests = usePairRequests();
  const lookup = useLookupHandle();
  const send = useSendPairRequest();
  const accept = useAcceptPairRequest();
  const decline = useDeclinePairRequest();
  const cancel = useCancelPairRequest();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<UserCard | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setError(null);
    setFound(null);
    setSent(false);
    const handle = normalizeHandle(query);
    if (!handle) return;
    try {
      setFound(await lookup.mutateAsync(handle));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function invite(user: UserCard) {
    setError(null);
    try {
      await send.mutateAsync(user.handle);
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onAccept(id: string) {
    try {
      await accept.mutateAsync({ id });
      router.replace('/pair/success');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const handle = me.data?.handle;
  return (
    <Screen>
      <TopBar title="Tìm theo ID" />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="micro" color={colors.textMuted}>ID CỦA BẠN</AppText>
          <AppText variant="h3" color={colors.roseStrong}>{handle ? `@${handle}` : '…'}</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Sao chép ID" style={styles.round} onPress={() => handle && Clipboard.setStringAsync(`@${handle}`)}>
          <Icon name="copy" size={16} color={colors.roseStrong} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Chia sẻ ID" style={styles.round}
          onPress={() => handle && Share.share({ message: `Tìm mình trên Couple App với ID @${handle}` })}>
          <Icon name="share" size={16} color={colors.roseStrong} />
        </Pressable>
      </Card>

      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput accessibilityLabel="Nhập ID người ấy" placeholder="@id-nguoi-ay" placeholderTextColor={colors.textMuted}
          value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search"
          onSubmitEditing={search} style={styles.searchInput} />
        <Button title="Tìm" compact onPress={search} loading={lookup.isPending} style={{ height: 36, paddingHorizontal: 12 }} />
      </View>
      <ErrorText message={error} />

      {found ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={found.displayName} tone="lavender" uri={found.avatarUrl} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">{found.displayName}</AppText>
            <AppText variant="caption" color={colors.textMuted}>@{found.handle}</AppText>
          </View>
          {sent ? (
            <AppText variant="captionStrong" color={colors.textMuted}>Đã gửi · chờ đồng ý</AppText>
          ) : (
            <Button title="Gửi lời mời" compact onPress={() => invite(found)} loading={send.isPending} style={{ height: 40, paddingHorizontal: 14 }} />
          )}
        </Card>
      ) : null}

      <View style={styles.hint}>
        <Icon name="shield" size={16} color={colors.lavenderInk} />
        <AppText variant="caption" color={colors.lavenderInk} style={{ flex: 1 }}>
          Chỉ tìm thấy khi nhập đúng chính xác ID. Có thể tắt trong Tôi → Quyền riêng tư.
        </AppText>
      </View>

      {requests.data?.incoming.length ? <AppText variant="h3">Lời mời đã nhận</AppText> : null}
      {requests.data?.incoming.map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={r.user.displayName} tone="peach" uri={r.user.avatarUrl} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{r.user.displayName} muốn ghép đôi với bạn</AppText>
              <AppText variant="caption" color={colors.textMuted}>@{r.user.handle} · {timeAgo(r.createdAt)}</AppText>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Từ chối" variant="secondary" compact style={{ flex: 1 }} onPress={() => decline.mutate(r.id)} />
            <Button title="Đồng ý" compact style={{ flex: 1 }} onPress={() => onAccept(r.id)} loading={accept.isPending} />
          </View>
        </Card>
      ))}

      {requests.data?.outgoing.length ? <AppText variant="h3">Lời mời đã gửi</AppText> : null}
      {requests.data?.outgoing.map((r) => (
        <Card key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={r.user.displayName} tone="lavender" uri={r.user.avatarUrl} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">{r.user.displayName}</AppText>
            <AppText variant="caption" color={colors.textMuted}>Đang chờ đồng ý</AppText>
          </View>
          <Button title="Huỷ" variant="secondary" compact onPress={() => cancel.mutate(r.id)} style={{ height: 40, paddingHorizontal: 14 }} />
        </Card>
      ))}

      <AppText variant="caption" color={colors.textMuted}>Lời mời hết hạn sau 24 giờ. Bạn chỉ ghép đôi được với 1 người tại một thời điểm.</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.roseSoft, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingLeft: 16, paddingRight: 8, borderRadius: 16, borderWidth: 1.5, borderColor: colors.roseStrong, backgroundColor: colors.surface },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.lavender },
});

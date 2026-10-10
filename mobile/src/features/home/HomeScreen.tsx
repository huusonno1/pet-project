import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMe } from '@/features/account/api';
import { useCouple, useDistance } from '@/features/couple/api';
import { useMoments } from '@/features/moments/api';
import { daysLeftLabel, TYPE_LABELS } from '@/features/moments/labels';
import { upcomingMoments } from '@/features/moments/occurrence';
import { daysBetween, formatDate, formatKm, timeAgo } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { LocationStatus, useLocationSync } from './use-location-sync';

export default function HomeScreen() {
  const me = useMe();
  const couple = useCouple();
  const distance = useDistance();
  const moments = useMoments();
  const location = useLocationSync();
  const today = new Date();
  const upcoming = moments.data ? upcomingMoments(moments.data, today, 3) : [];
  const startedOn = couple.data?.startedDatingOn;

  return (
    <Screen>
      <Card style={styles.hero}>
        <Text style={styles.names}>
          {me.data?.displayName ?? '…'} ❤ {couple.data?.partner.displayName ?? '…'}
        </Text>
        {startedOn ? (
          <Text style={styles.days}>{daysBetween(startedOn, today)} ngày bên nhau</Text>
        ) : (
          <Text style={styles.muted}>Thêm ngày bắt đầu yêu bằng một kỷ niệm "Ngày yêu nhau"</Text>
        )}
      </Card>

      <Card>
        <Title>Khoảng cách</Title>
        <DistanceBody location={location} distance={distance.data} />
      </Card>

      <Card>
        <Title>Sắp tới</Title>
        {upcoming.length === 0 ? (
          <Text style={styles.muted}>Chưa có ngày đặc biệt nào sắp tới.</Text>
        ) : (
          upcoming.map(({ moment, date, daysLeft }) => (
            <Pressable
              key={moment.id}
              accessibilityRole="button"
              onPress={() => router.push(`/moments/${moment.id}`)}
              style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{moment.title}</Text>
                <Text style={styles.muted}>
                  {TYPE_LABELS[moment.type]} · {formatDate(date)}
                </Text>
              </View>
              <Text style={styles.badge}>{daysLeftLabel(daysLeft)}</Text>
            </Pressable>
          ))
        )}
      </Card>
    </Screen>
  );
}

function DistanceBody({
  location,
  distance,
}: {
  location: LocationStatus;
  distance: ReturnType<typeof useDistance>['data'];
}) {
  if (location === 'denied') {
    return (
      <>
        <Text style={styles.muted}>Bạn chưa cho phép truy cập vị trí.</Text>
        <Button title="Mở cài đặt" variant="secondary" onPress={() => Linking.openSettings()} />
      </>
    );
  }
  if (location === 'disabled') {
    return <Text style={styles.muted}>Bạn đang tắt chia sẻ vị trí (bật lại trong Cài đặt).</Text>;
  }
  if (!distance) {
    return <Text style={styles.muted}>Đang tải…</Text>;
  }
  if (distance.distanceKm !== null) {
    return (
      <>
        <Text style={styles.km}>{formatKm(distance.distanceKm)}</Text>
        {distance.partner && <Text style={styles.muted}>Người ấy cập nhật {timeAgo(distance.partner.updatedAt)}</Text>}
      </>
    );
  }
  if (!distance.partner) {
    return <Text style={styles.muted}>Người ấy chưa bật chia sẻ vị trí</Text>;
  }
  return <Text style={styles.muted}>Đang lấy vị trí của bạn…</Text>;
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', backgroundColor: colors.primary, borderColor: colors.primary },
  names: { color: '#fff', fontSize: 22, fontWeight: '700' },
  days: { color: '#fff', fontSize: 16, marginTop: spacing.xs },
  km: { fontSize: 36, fontWeight: '800', color: colors.primary },
  muted: { color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowTitle: { fontWeight: '600', color: colors.text },
  badge: { color: colors.primary, fontWeight: '600' },
});

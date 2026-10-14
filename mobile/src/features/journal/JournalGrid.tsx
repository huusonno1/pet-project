import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { moodLabel, TYPE_LABELS } from '@/features/moments/labels';
import type { Moment } from '@/lib/api/types';
import { toIsoDate } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { PhotoTile } from '@/ui/PhotoTile';
import { colors } from '@/ui/theme';

import { dayLabel, groupByDay, JournalFilter, journalMoments } from './group';

const FILTERS: { key: JournalFilter; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' }, { key: 'MOMENT', label: 'Khoảnh khắc' }, { key: 'MILESTONE', label: 'Kỷ niệm' },
  { key: 'DATE', label: 'Hẹn hò' }, { key: 'GIFT', label: 'Quà' },
];

function Tile({ moment, style, overlay }: { moment: Moment; style: object; overlay?: string }) {
  const media = moment.media[0];
  if (!media) {
    return (
      <View style={[style, styles.textTile]}>
        <Icon name="quote" size={18} color={colors.lavenderInk} />
        <AppText variant="captionStrong" numberOfLines={3}>{moment.title}</AppText>
      </View>
    );
  }
  return (
    <PhotoTile uri={media.url} seed={moment.id} style={style}>
      {overlay ? <View style={styles.more}><AppText variant="h2" color={colors.white}>{overlay}</AppText></View> : null}
    </PhotoTile>
  );
}

export function JournalGrid({ moments }: { moments: Moment[] }) {
  const [filter, setFilter] = useState<JournalFilter>('ALL');
  const groups = groupByDay(journalMoments(moments, toIsoDate(new Date()), filter));
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map((f) => <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />)}
      </ScrollView>
      {groups.length === 0 ? <AppText color={colors.textMuted}>Chưa có kỷ niệm nào. Bấm + để lưu khoảnh khắc đầu tiên.</AppText> : null}
      {groups.map(({ date, moments: day }) => {
        const first = day[0];
        const photos = day.length;
        const label = TYPE_LABELS[first.type] + (moodLabel(first.details.mood) ? ` · ${moodLabel(first.details.mood)}` : '');
        return (
          <View key={date} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <AppText variant="bodyStrong">{dayLabel(date)}</AppText>
              <AppText variant="captionStrong" color={photos > 1 ? colors.roseStrong : colors.textMuted}>{photos} kỷ niệm</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Xem ${photos} kỷ niệm ngày ${date}`} onPress={() => router.push(`/journal/${date}`)}>
              {day.length === 1 ? (
                <Tile moment={first} style={{ height: 150, borderRadius: 20 }} />
              ) : day.length === 2 ? (
                <View style={{ flexDirection: 'row', gap: 6, height: 160 }}>
                  <Tile moment={day[0]} style={{ flex: 1, borderRadius: 20 }} />
                  <Tile moment={day[1]} style={{ flex: 1, borderRadius: 20 }} />
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 6, height: 204 }}>
                  <View style={{ flex: 2 }}>
                    <Tile moment={day[0]} style={{ flex: 1, borderRadius: 20 }} />
                    <View style={styles.badge}><AppText variant="captionStrong" color={colors.roseStrong} style={{ fontSize: 12 }}>{label}</AppText></View>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Tile moment={day[1]} style={{ flex: 1, borderRadius: 16 }} />
                    <Tile moment={day[2]} style={{ flex: 1, borderRadius: 16 }} overlay={day.length > 3 ? `+${day.length - 3}` : undefined} />
                  </View>
                </View>
              )}
            </Pressable>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  textTile: { backgroundColor: colors.lavender, padding: 12, gap: 6, justifyContent: 'center', overflow: 'hidden' },
  more: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(43,26,46,0.5)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', left: 10, bottom: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.9)' },
});

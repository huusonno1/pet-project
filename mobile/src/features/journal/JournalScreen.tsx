import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { useMoments } from '@/features/moments/api';
import { toIsoDate } from '@/lib/format';
import { AppText } from '@/ui/AppText';
import { Screen } from '@/ui/Screen';
import { SegmentedTabs } from '@/ui/SegmentedTabs';
import { colors } from '@/ui/theme';

import { journalMoments } from './group';
import { JournalGrid } from './JournalGrid';
import { JournalMonth } from './JournalMonth';
import { JournalYear } from './JournalYear';

type View_ = 'grid' | 'month' | 'year';

export default function JournalScreen() {
  const params = useLocalSearchParams<{ view?: View_; ym?: string }>();
  const view: View_ = params.view === 'month' || params.view === 'year' ? params.view : 'grid';
  const moments = useMoments();
  const list = journalMoments(moments.data ?? [], toIsoDate(new Date()));
  return (
    <Screen gap={14}>
      <View>
        <AppText variant="display">Nhật ký</AppText>
        <AppText variant="caption" color={colors.textMuted}>{list.length} kỷ niệm</AppText>
      </View>
      <SegmentedTabs options={[{ key: 'grid', label: 'Lưới' }, { key: 'month', label: 'Tháng' }, { key: 'year', label: 'Năm' }]}
        value={view} onChange={(v) => router.setParams({ view: v })} />
      {view === 'grid' ? <JournalGrid moments={moments.data ?? []} /> : null}
      {view === 'month' ? <JournalMonth moments={moments.data ?? []} initial={params.ym} /> : null}
      {view === 'year' ? <JournalYear moments={moments.data ?? []} /> : null}
    </Screen>
  );
}

import { useSettings, useUpdateSettings } from '@/features/account/api';
import { Card } from '@/ui/Card';
import { ListRow } from '@/ui/ListRow';
import { Screen } from '@/ui/Screen';
import { colors } from '@/ui/theme';
import { Toggle } from '@/ui/Toggle';
import { TopBar } from '@/ui/TopBar';

const TYPES: { key: string; label: string; sub: string }[] = [
  { key: 'ANNIVERSARY', label: 'Mốc ngày yêu', sub: '100 ngày, năm tròn…' },
  { key: 'DATE_PLAN', label: 'Lịch hẹn', sub: 'Trước buổi hẹn' },
  { key: 'GIFT_OCCASION', label: 'Dịp tặng quà', sub: 'Sinh nhật, 14/2, 20/10…' },
  { key: 'CUSTOM', label: 'Nhắc tự đặt', sub: 'Các mốc bạn tự tạo' },
  { key: 'CYCLE', label: 'Chu kỳ', sub: 'Khi có theo dõi và chia sẻ' },
];

export default function NotificationPrefsScreen() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const prefs = settings.data?.notifyPrefs ?? {};
  return (
    <Screen>
      <TopBar title="Thông báo" />
      <Card style={{ paddingVertical: 4, gap: 0 }}>
        {TYPES.map((t) => (
          <ListRow key={t.key} icon="bell" iconBg={colors.lavender} iconColor={colors.lavenderInk} title={t.label} subtitle={t.sub}
            right={<Toggle label={t.label} value={prefs[t.key] ?? true} onValueChange={(v) => update.mutate({ notifyPrefs: { [t.key]: v } })} />} />
        ))}
      </Card>
    </Screen>
  );
}

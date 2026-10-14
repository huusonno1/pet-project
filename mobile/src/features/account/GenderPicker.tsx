import { View } from 'react-native';

import type { Gender } from '@/lib/api/types';
import { AppText } from '@/ui/AppText';
import { Chip } from '@/ui/Chip';
import { colors } from '@/ui/theme';

export const GENDER_LABEL: Record<Gender, string> = { MALE: 'Nam', FEMALE: 'Nữ' };

/** Chọn Nam/Nữ — tài khoản Nữ mới có theo dõi chu kỳ. */
export function GenderPicker({ value, onChange }: { value: Gender | null; onChange: (g: Gender) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" color={colors.textMuted}>Giới tính</AppText>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['FEMALE', 'MALE'] as const).map((g) => (
          <Chip key={g} label={GENDER_LABEL[g]} selected={value === g} onPress={() => onChange(g)} />
        ))}
      </View>
    </View>
  );
}

import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors } from './theme';

type Props = { title?: string; onBack?: () => void; backIcon?: 'back' | 'close'; right?: React.ReactNode };

export function TopBar({ title, onBack, backIcon = 'back', right }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backIcon === 'close' ? 'Đóng' : 'Quay lại'}
        onPress={onBack ?? (() => router.back())}
        style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={backIcon} size={20} />
      </Pressable>
      <AppText variant="h3" style={{ flex: 1 }} numberOfLines={1}>{title ?? ''}</AppText>
      {right}
    </View>
  );
}

import { Pressable, View } from 'react-native';

import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { IconCircle } from './IconCircle';
import { colors } from './theme';

type Props = {
  icon: IconName;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string | null;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  testID?: string;
};

export function ListRow({ icon, iconBg, iconColor, title, subtitle, right, onPress, danger, testID }: Props) {
  const body = (
    <>
      <IconCircle name={icon} bg={iconBg} color={iconColor} size={36} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" color={danger ? colors.danger : colors.text}>{title}</AppText>
        {subtitle ? <AppText variant="caption" color={colors.textMuted}>{subtitle}</AppText> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevronRight" size={18} color={colors.textMuted} /> : null)}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 10 };
  return onPress ? (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={style}>
      {body}
    </Pressable>
  ) : (
    <View testID={testID} style={style}>{body}</View>
  );
}

import { View } from 'react-native';

import { Icon, IconName } from './Icon';

export function IconCircle({ name, bg, color, size = 40 }: { name: IconName; bg: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={Math.round(size / 2)} color={color} />
    </View>
  );
}

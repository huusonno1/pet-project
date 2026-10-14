import { Text, TextProps } from 'react-native';

import { colors, text, TextVariant } from './theme';

export function AppText({ variant = 'body', color = colors.text, style, ...rest }: TextProps & { variant?: TextVariant; color?: string }) {
  return <Text {...rest} style={[text[variant], { color }, style]} />;
}

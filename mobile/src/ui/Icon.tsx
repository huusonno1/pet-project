import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors } from './theme';

const FEATHER = {
  heart: 'heart', camera: 'camera', image: 'image', calendar: 'calendar', pin: 'map-pin', bell: 'bell',
  gift: 'gift', droplet: 'droplet', lock: 'lock', link: 'link', user: 'user', search: 'search', share: 'share-2',
  copy: 'copy', edit: 'edit-2', close: 'x', back: 'chevron-left', chevronRight: 'chevron-right',
  chevronDown: 'chevron-down', plus: 'plus', repeat: 'repeat', clock: 'clock', send: 'send', zap: 'zap',
  flip: 'refresh-cw', eye: 'eye', shield: 'shield', logout: 'log-out', layers: 'layers', journal: 'book-open',
  home: 'home', hash: 'hash', navigation: 'navigation', check: 'check', more: 'more-horizontal', type: 'type',
  film: 'film', smile: 'smile', trash: 'trash-2', slash: 'slash', pen: 'edit-3', quote: 'message-circle',
} as const;

const IONICONS = {
  sparkles: 'sparkles-outline', qr: 'qr-code-outline', heartFilled: 'heart', unlink: 'unlink-outline',
  stamp: 'ribbon-outline', bunny: 'paw-outline', apple: 'logo-apple', google: 'logo-google',
  facebook: 'logo-facebook',
} as const;

export type IconName = keyof typeof FEATHER | keyof typeof IONICONS;

export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  if (name in IONICONS) {
    return <Ionicons name={IONICONS[name as keyof typeof IONICONS]} size={size} color={color} />;
  }
  return <Feather name={FEATHER[name as keyof typeof FEATHER]} size={size} color={color} />;
}

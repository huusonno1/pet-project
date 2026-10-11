export const colors = {
  bg: '#FFF8F3',
  surface: '#FFFFFF',
  surfaceMuted: '#F6EEEA',
  line: '#EADFD9',
  text: '#2B1A2E',
  textMuted: '#6F5B6A',
  rose: '#E9557A',
  roseStrong: '#C9365C',
  roseSoft: '#FFE6EC',
  roseBorder: '#F2A3B6',
  peachSoft: '#FFEEDF',
  peachInk: '#B5562A',
  lavender: '#EEEAFF',
  lavenderInk: '#5B4BC4',
  mint: '#E3F5EC',
  mintInk: '#24795A',
  cycle: '#D64545',
  danger: '#C42F3F',
  scrim: 'rgba(43,26,46,0.45)',
  white: '#FFFFFF',
  toggleOff: '#D9CCC6',
};

export const fonts = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
  extrabold: 'BeVietnamPro_800ExtraBold',
};

export const text = {
  display: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 35 },
  h1: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32 },
  h2: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  captionStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 0.66 },
} as const;

export type TextVariant = keyof typeof text;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 12, md: 16, lg: 20, xl: 24, sheet: 32, pill: 999 };

export const shadow = {
  card: { shadowColor: '#2B1A2E', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  raised: { shadowColor: '#2B1A2E', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
};

export const GRADIENTS: [string, string][] = [
  ['#FFC8B4', '#F38BA8'],
  ['#C9D8FF', '#A99BF0'],
  ['#BFEBD9', '#7CC9AE'],
  ['#FFE1A8', '#FFAE8A'],
];

/** Gradient giữ chỗ cho ảnh, cố định theo id để không nhảy màu giữa các lần render. */
export function gradientFor(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

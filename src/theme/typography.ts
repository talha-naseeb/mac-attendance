import { Platform, TextStyle, ViewStyle } from 'react-native';

export type AppLanguage = 'en' | 'ar';

/**
 * Bilingual English & Arabic Typography System
 * Uses native system fonts optimized for both Latin and Arabic scripts
 * with generous line-heights so Arabic ascenders/diacritics never clip.
 */
export const FONT_FAMILY = {
  regular: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: "'Inter', 'Cairo', 'Tajawal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'System',
  }),
  medium: Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    web: "'Inter', 'Cairo', 'Tajawal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'System',
  }),
  bold: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: "'Inter', 'Cairo', 'Tajawal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'System',
  }),
};

export const TYPOGRAPHY: Record<string, TextStyle> = {
  brandLight: {
    fontFamily: FONT_FAMILY.regular,
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: -0.6,
  },
  brandBold: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  h1: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
  },
  h2: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  cardTitle: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  body: {
    fontFamily: FONT_FAMILY.regular,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  bodyStrong: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  caption: {
    fontFamily: FONT_FAMILY.regular,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  badge: {
    fontFamily: FONT_FAMILY.bold,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
};

export const rtlRow = (isRTL: boolean): ViewStyle => ({
  flexDirection: isRTL ? 'row-reverse' : 'row',
});

export const rtlText = (isRTL: boolean): TextStyle => ({
  textAlign: isRTL ? 'right' : 'left',
  writingDirection: isRTL ? 'rtl' : 'ltr',
});

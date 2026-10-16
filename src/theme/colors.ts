/**
 * Official Macquires Colour Palette — Single Source of Truth
 * Mirrors src/theme/palette.css so all components import primary, secondary,
 * tertiary, accent, and neutral tokens from one place without hardcoding hex values.
 *
 * - Oxford Blue:    #001629 (RGB 0, 22, 41)
 * - Prussian Blue:  #002C52 (RGB 0, 44, 82)
 * - Indigo Dye:     #293F66 (RGB 41, 63, 102)
 * - Bdazzled Blue:  #3F5678 (RGB 63, 86, 120)
 * - Davys Grey:     #555555 (RGB 85, 85, 85)
 * - Spanish Grey:   #999999 (RGB 153, 153, 153)
 * - Orange Pantone: #FE5800 (RGB 254, 88, 0)
 */
export const MACQUIRES_PALETTE = {
  oxfordBlue: '#001629',
  prussianBlue: '#002C52',
  indigoDye: '#293F66',
  bdazzledBlue: '#3F5678',
  davysGrey: '#555555',
  spanishGrey: '#999999',
  orangePantone: '#FE5800',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export interface ThemeColors {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSubtle: string;
  primary: string;
  primaryBright: string;
  primarySoft: string;
  secondary: string;
  secondarySoft: string;
  tertiary: string;
  tertiarySoft: string;
  accent: string;
  accentSoft: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  border: string;
  successBg: string;
  successText: string;
  warningBg: string;
  warningText: string;
  dangerBg: string;
  dangerText: string;
  rejectButton: string;
  badgeRed: string;
  shadow: string;
}

export const lightColors: ThemeColors = {
  isDark: false,
  background: '#F4F6F9',
  surface: MACQUIRES_PALETTE.white,
  surfaceElevated: MACQUIRES_PALETTE.white,
  surfaceSubtle: '#EBF0F5',
  primary: MACQUIRES_PALETTE.prussianBlue, // #002C52
  primaryBright: MACQUIRES_PALETTE.orangePantone, // #FE5800
  primarySoft: '#E6ECF2',
  secondary: MACQUIRES_PALETTE.indigoDye, // #293F66
  secondarySoft: '#EAEEF5',
  tertiary: MACQUIRES_PALETTE.bdazzledBlue, // #3F5678
  tertiarySoft: '#EDF1F6',
  accent: MACQUIRES_PALETTE.orangePantone, // #FE5800
  accentSoft: '#FFF0E8',
  textPrimary: MACQUIRES_PALETTE.oxfordBlue, // #001629
  textSecondary: MACQUIRES_PALETTE.davysGrey, // #555555
  textMuted: MACQUIRES_PALETTE.spanishGrey, // #999999
  textOnPrimary: MACQUIRES_PALETTE.white,
  border: '#DCE3EC',
  successBg: '#E6F4EA',
  successText: '#137333',
  warningBg: '#FFF0E8',
  warningText: MACQUIRES_PALETTE.orangePantone,
  dangerBg: '#FCE8E6',
  dangerText: '#C5221F',
  rejectButton: MACQUIRES_PALETTE.davysGrey,
  badgeRed: MACQUIRES_PALETTE.orangePantone,
  shadow: MACQUIRES_PALETTE.oxfordBlue,
};

export const darkColors: ThemeColors = {
  isDark: true,
  background: MACQUIRES_PALETTE.oxfordBlue, // #001629
  surface: MACQUIRES_PALETTE.prussianBlue, // #002C52
  surfaceElevated: MACQUIRES_PALETTE.indigoDye, // #293F66
  surfaceSubtle: '#08223E',
  primary: MACQUIRES_PALETTE.orangePantone, // #FE5800
  primaryBright: MACQUIRES_PALETTE.orangePantone, // #FE5800
  primarySoft: MACQUIRES_PALETTE.indigoDye, // #293F66
  secondary: MACQUIRES_PALETTE.bdazzledBlue, // #3F5678
  secondarySoft: '#1E314F',
  tertiary: MACQUIRES_PALETTE.indigoDye, // #293F66
  tertiarySoft: '#253A5E',
  accent: MACQUIRES_PALETTE.orangePantone, // #FE5800
  accentSoft: '#3A2218',
  textPrimary: MACQUIRES_PALETTE.white,
  textSecondary: '#D6E0EB',
  textMuted: MACQUIRES_PALETTE.spanishGrey, // #999999
  textOnPrimary: MACQUIRES_PALETTE.white,
  border: MACQUIRES_PALETTE.bdazzledBlue, // #3F5678
  successBg: '#064E3B',
  successText: '#6EE7B7',
  warningBg: '#3A2218',
  warningText: '#FF8547',
  dangerBg: '#450A0A',
  dangerText: '#FCA5A5',
  rejectButton: MACQUIRES_PALETTE.bdazzledBlue,
  badgeRed: MACQUIRES_PALETTE.orangePantone,
  shadow: MACQUIRES_PALETTE.black,
};

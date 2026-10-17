/**
 * Official MacqHR® Brand Identity & Concept A ("People + M Crown") Vector Spec
 * Uses the official Macquires colour palette:
 * - Prussian Blue (#002C52) & Oxford Blue (#001629) squircle badge
 * - Crisp White (#FFFFFF) architectural 'M' pillars
 * - Orange Pantone (#FE5800) human head/pulse apex node & base verification bar
 */

import { MACQUIRES_PALETTE } from '../theme/colors';

export interface MacqLogoSpec {
  conceptId: 'CONCEPT_A_PEOPLE_M_CROWN';
  viewBox: string;
  mPillarsPath: string;
  baseVerificationBarPath: string;
  humanApexCircle: {
    cx: number;
    cy: number;
    r: number;
    fill: string;
  };
  colors: {
    badgeBackground: string;
    badgeBorder: string;
    mStroke: string;
    accentOrange: string;
  };
}

export function getMacqLogoSpec(isDark: boolean = false): MacqLogoSpec {
  return {
    conceptId: 'CONCEPT_A_PEOPLE_M_CROWN',
    viewBox: '0 0 48 48',
    // Bold architectural M pillars
    mPillarsPath:
      'M9 36V16C9 14.3431 10.3431 13 12 13C13.1 13 14.1 13.6 14.6 14.5L24 30L33.4 14.5C33.9 13.6 34.9 13 36 13C37.6569 13 39 14.3431 39 16V36',
    // Subtle bottom verification bar under M
    baseVerificationBarPath: 'M16 39H32',
    // Human head / pulse node at the apex in Orange Pantone
    humanApexCircle: {
      cx: 24,
      cy: 12.5,
      r: 4.8,
      fill: MACQUIRES_PALETTE.orangePantone,
    },
    colors: {
      badgeBackground: isDark
        ? MACQUIRES_PALETTE.oxfordBlue
        : MACQUIRES_PALETTE.prussianBlue,
      badgeBorder: MACQUIRES_PALETTE.indigoDye,
      mStroke: MACQUIRES_PALETTE.white,
      accentOrange: MACQUIRES_PALETTE.orangePantone,
    },
  };
}

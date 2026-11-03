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

/**
 * Official Shiftly® Brand Identity & Concept 02 ("The Dual Shift Pulse") Vector Spec
 * Modern geometric speed S with telemetry attendance pulse:
 * - Upper angled wave stroke in vibrant Orange Pantone (#FE5800)
 * - Lower angled wave stroke in Crisp White (#FFFFFF)
 * - Central attendance radar telemetry pulse dot and dashed ring at (50, 50)
 */
export interface ShiftlyLogoSpec {
  conceptId: 'CONCEPT_DUAL_SHIFT_PULSE';
  viewBox: string;
  upperNavyWingPath: string;
  lowerNavyWingPath: string;
  upperWhiteSlashPoints: string;
  lowerWhiteSlashPoints: string;
  radarPulseCenter: {
    cx: number;
    cy: number;
    r: number;
    fill: string;
  };
  colors: {
    badgeBackground: string;
    badgeBorder: string;
    navyWing: string;
    whiteSlash: string;
    pulseOrange: string;
  };
}

export function getShiftlyLogoSpec(isDark: boolean = false): ShiftlyLogoSpec {
  return {
    conceptId: 'CONCEPT_DUAL_SHIFT_PULSE',
    viewBox: '0 0 200 200',
    upperNavyWingPath:
      'M88 31L113 31L68 76L68 96L54 96C38 96 32 86 40 74L88 31Z',
    lowerNavyWingPath:
      'M112 169L87 169L132 124L132 104L146 104C162 104 168 114 160 126L112 169Z',
    upperWhiteSlashPoints: '173,14 148,14 64,100 89,100',
    lowerWhiteSlashPoints: '111,104 136,104 52,190 27,190',
    radarPulseCenter: {
      cx: 140,
      cy: 83,
      r: 11,
      fill: MACQUIRES_PALETTE.orangePantone,
    },
    colors: {
      badgeBackground: isDark
        ? MACQUIRES_PALETTE.oxfordBlue
        : MACQUIRES_PALETTE.prussianBlue,
      badgeBorder: MACQUIRES_PALETTE.indigoDye,
      navyWing: '#0F4C7A',
      whiteSlash: MACQUIRES_PALETTE.white,
      pulseOrange: MACQUIRES_PALETTE.orangePantone,
    },
  };
}

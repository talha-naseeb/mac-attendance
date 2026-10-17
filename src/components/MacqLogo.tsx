import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { getMacqLogoSpec } from '../services/logoSpec';
import { MACQUIRES_PALETTE, ThemeColors } from '../theme/colors';
import { TYPOGRAPHY } from '../theme/typography';

export interface MacqLogoProps {
  colors: ThemeColors;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  layout?: 'row' | 'stacked';
  showWordmark?: boolean;
  showSubtitle?: boolean;
  forceLightWordmark?: boolean;
}

export const MacqLogo: React.FC<MacqLogoProps> = ({
  colors,
  size = 'md',
  layout = 'row',
  showWordmark = true,
  showSubtitle = false,
  forceLightWordmark = false,
}) => {
  const spec = getMacqLogoSpec(colors.isDark);

  const badgeSize =
    size === 'sm' ? 32 : size === 'lg' ? 54 : size === 'xl' ? 76 : 40;
  const svgSize =
    size === 'sm' ? 22 : size === 'lg' ? 36 : size === 'xl' ? 52 : 28;
  const borderRadius =
    size === 'sm' ? 9 : size === 'lg' ? 16 : size === 'xl' ? 22 : 12;
  const fontSize =
    size === 'sm' ? 20 : size === 'lg' ? 32 : size === 'xl' ? 38 : 25;

  const macqTextColor = forceLightWordmark
    ? MACQUIRES_PALETTE.white
    : colors.textPrimary;

  const isStacked = layout === 'stacked';

  return (
    <View style={[styles.container, isStacked && styles.containerStacked]}>
      {/* Concept A: Squircle App Icon with Architectural 'M' Pillars + Orange Pantone Human Apex */}
      <View
        style={[
          styles.iconBadge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius,
            backgroundColor: spec.colors.badgeBackground,
            borderColor: spec.colors.badgeBorder,
          },
        ]}
      >
        <Svg width={svgSize} height={svgSize} viewBox={spec.viewBox} fill="none">
          {/* Architectural M Pillars */}
          <Path
            d={spec.mPillarsPath}
            stroke={spec.colors.mStroke}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Orange Pantone Human Head / Pulse Apex Node */}
          <Circle
            cx={spec.humanApexCircle.cx}
            cy={spec.humanApexCircle.cy}
            r={spec.humanApexCircle.r}
            fill={spec.humanApexCircle.fill}
          />
          {/* Subtle Base Verification Bar */}
          <Path
            d={spec.baseVerificationBarPath}
            stroke={spec.colors.accentOrange}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </Svg>
      </View>

      {showWordmark && (
        <View
          style={[
            styles.wordmarkColumn,
            isStacked && styles.wordmarkColumnStacked,
          ]}
        >
          <View style={styles.wordmarkRow}>
            <Text
              style={[
                TYPOGRAPHY.brandLight,
                {
                  color: macqTextColor,
                  fontSize,
                },
              ]}
            >
              macq
            </Text>
            <Text
              style={[
                TYPOGRAPHY.brandBold,
                {
                  color: MACQUIRES_PALETTE.orangePantone,
                  fontSize,
                },
              ]}
            >
              HR
            </Text>
            <Text
              style={[
                styles.brandReg,
                {
                  color: forceLightWordmark
                    ? MACQUIRES_PALETTE.spanishGrey
                    : colors.textMuted,
                },
              ]}
            >
              ®
            </Text>
          </View>
          {showSubtitle && (
            <Text
              style={[
                styles.subtitleText,
                isStacked && styles.subtitleTextStacked,
                {
                  color: forceLightWordmark
                    ? MACQUIRES_PALETTE.spanishGrey
                    : colors.secondary,
                },
              ]}
            >
              MACQUIRES PEOPLE
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  containerStacked: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: MACQUIRES_PALETTE.oxfordBlue,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  wordmarkColumn: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  wordmarkColumnStacked: {
    alignItems: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandReg: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 2,
  },
  subtitleText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: -2,
  },
  subtitleTextStacked: {
    fontSize: 11,
    letterSpacing: 2.2,
    marginTop: 2,
  },
});

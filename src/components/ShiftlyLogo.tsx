import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { getShiftlyLogoSpec } from '../services/logoSpec';
import { MACQUIRES_PALETTE, ThemeColors } from '../theme/colors';
import { TYPOGRAPHY } from '../theme/typography';

export interface ShiftlyLogoProps {
  colors: ThemeColors;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  layout?: 'row' | 'stacked';
  showWordmark?: boolean;
  showSubtitle?: boolean;
  forceLightWordmark?: boolean;
}

export const ShiftlyLogo: React.FC<ShiftlyLogoProps> = ({
  colors,
  size = 'md',
  layout = 'row',
  showWordmark = true,
  showSubtitle = false,
  forceLightWordmark = false,
}) => {
  const spec = getShiftlyLogoSpec(colors.isDark);

  const badgeSize =
    size === 'sm' ? 32 : size === 'lg' ? 54 : size === 'xl' ? 76 : 40;
  const svgSize =
    size === 'sm' ? 22 : size === 'lg' ? 38 : size === 'xl' ? 54 : 28;
  const borderRadius =
    size === 'sm' ? 9 : size === 'lg' ? 16 : size === 'xl' ? 22 : 12;
  const fontSize =
    size === 'sm' ? 20 : size === 'lg' ? 32 : size === 'xl' ? 38 : 25;

  const shiftTextColor = forceLightWordmark || colors.isDark
    ? MACQUIRES_PALETTE.white
    : MACQUIRES_PALETTE.prussianBlue; // #002C52 - rich signature brand blue

  const subtitleColor = forceLightWordmark || colors.isDark
    ? MACQUIRES_PALETTE.spanishGrey
    : MACQUIRES_PALETTE.bdazzledBlue; // #3F5678 - slate blue accent

  const isStacked = layout === 'stacked';

  return (
    <View style={[styles.container, isStacked && styles.containerStacked]}>
      {/* Concept 02: Dual Shift Pulse Badge */}
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
          {/* Top-Left Navy Wing */}
          <Path d={spec.upperNavyWingPath} fill={spec.colors.navyWing} />
          {/* Bottom-Right Navy Wing */}
          <Path d={spec.lowerNavyWingPath} fill={spec.colors.navyWing} />
          {/* Upper White Slash */}
          <Polygon points={spec.upperWhiteSlashPoints} fill={spec.colors.whiteSlash} />
          {/* Lower White Slash */}
          <Polygon points={spec.lowerWhiteSlashPoints} fill={spec.colors.whiteSlash} />
          {/* Vibrant Orange Pulse Beacon */}
          <Circle
            cx={spec.radarPulseCenter.cx}
            cy={spec.radarPulseCenter.cy}
            r={spec.radarPulseCenter.r}
            fill={spec.radarPulseCenter.fill}
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
                TYPOGRAPHY.brandBold,
                {
                  color: shiftTextColor,
                  fontSize,
                  letterSpacing: -0.5,
                },
              ]}
            >
              Shift
            </Text>
            <Text
              style={[
                TYPOGRAPHY.brandBold,
                {
                  color: MACQUIRES_PALETTE.orangePantone,
                  fontSize,
                  letterSpacing: -0.5,
                },
              ]}
            >
              ly
            </Text>
          </View>
          {showSubtitle && (
            <Text
              style={[
                styles.subtitleText,
                isStacked && styles.subtitleTextStacked,
                {
                  color: subtitleColor,
                },
              ]}
            >
              SMART ATTENDANCE
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
    gap: 12,
  },
  containerStacked: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  wordmarkColumn: {
    justifyContent: 'center',
  },
  wordmarkColumnStacked: {
    alignItems: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  subtitleText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  subtitleTextStacked: {
    textAlign: 'center',
  },
});

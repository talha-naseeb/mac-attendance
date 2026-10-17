import React, { useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { buildSmoothBezierCradleGeometry } from '../services/bottomNavGeometry';
import { MACQUIRES_PALETTE, ThemeColors } from '../theme/colors';
import { rtlRow, TYPOGRAPHY } from '../theme/typography';

interface NotchedBottomBarProps {
  colors: ThemeColors;
  isRTL: boolean;
  activeBottomTab: 'dashboard' | 'clock';
  dashboardLabel: string;
  clockInLabel: string;
  requestTimeOffLabel: string;
  onSelectTab: (tab: 'dashboard' | 'clock') => void;
  onPressQuickRequest: () => void;
}

export const NotchedBottomBar: React.FC<NotchedBottomBarProps> = ({
  colors,
  isRTL,
  activeBottomTab,
  dashboardLabel,
  clockInLabel,
  requestTimeOffLabel,
  onSelectTab,
  onPressQuickRequest,
}) => {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState<number>(390);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - barWidth) > 1) {
      setBarWidth(w);
    }
  };

  // Option A: Smooth Bezier Cradle flush to bottom edge (includes safe area bottom inset)
  const geometry = buildSmoothBezierCradleGeometry({
    width: barWidth,
    safeBottomInset: insets.bottom,
    barContentHeight: 66,
    cradleHalfWidth: 58,
    cradleDepth: 36,
    cornerRadius: 16,
  });

  return (
    <View
      style={[
        styles.wrapper,
        {
          height: geometry.totalHeight,
        },
      ]}
      onLayout={handleLayout}
      pointerEvents="box-none"
    >
      {/* Center Floating '+' Quick Request Button sitting inside the Bezier Cradle Cutout */}
      <View
        style={[
          styles.fabWrapper,
          {
            bottom: geometry.totalHeight - geometry.cradleDepth + 6,
          },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={[
            styles.fabButton,
            {
              backgroundColor: colors.accent,
            },
          ]}
          onPress={onPressQuickRequest}
          activeOpacity={0.85}
          accessibilityLabel={requestTimeOffLabel}
        >
          <Feather name="plus" size={28} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>

      {/* SVG Option A Smooth Bezier Cradle — Flush to bottom edge, NO bottom shadow */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg
          width={geometry.width}
          height={geometry.totalHeight}
          viewBox={`0 0 ${geometry.width} ${geometry.totalHeight}`}
        >
          {/* Filled bar body extending all the way through bottom safe area */}
          <Path d={geometry.fillPath} fill={colors.surface} />
          {/* Top contour & Bezier wave border only (no bottom or side borders) */}
          <Path
            d={geometry.topStrokePath}
            fill="none"
            stroke={colors.border}
            strokeWidth={1.2}
          />
        </Svg>
      </View>

      {/* Left & Right Navigation Tabs */}
      <View
        style={[
          styles.tabsRow,
          rtlRow(isRTL),
          {
            height: geometry.barContentHeight,
            marginBottom: geometry.safeBottomInset,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Left Tab: Dashboard Grid Icon */}
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => onSelectTab('dashboard')}
          activeOpacity={0.75}
          accessibilityLabel={dashboardLabel}
        >
          <View style={styles.navIconSlot}>
            <Feather
              name="grid"
              size={20}
              color={
                activeBottomTab === 'dashboard'
                  ? colors.accent
                  : colors.textMuted
              }
            />
          </View>
          <Text
            style={[
              styles.navTabLabel,
              {
                color:
                  activeBottomTab === 'dashboard'
                    ? colors.accent
                    : colors.textMuted,
                fontWeight: activeBottomTab === 'dashboard' ? '800' : '600',
              },
            ]}
            numberOfLines={1}
          >
            {dashboardLabel}
          </Text>
          {activeBottomTab === 'dashboard' && (
            <View
              style={[
                styles.activeIndicator,
                { backgroundColor: colors.accent },
              ]}
            />
          )}
        </TouchableOpacity>

        {/* Center Cutout Spacer so tabs sit cleanly on either side of the Bezier wave */}
        <View
          style={{ width: geometry.cradleHalfWidth * 2 + 8 }}
          pointerEvents="none"
        />

        {/* Right Tab: Attendance Clock / Stopwatch Icon */}
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => onSelectTab('clock')}
          activeOpacity={0.75}
          accessibilityLabel={clockInLabel}
        >
          <View style={styles.navIconSlot}>
            <Feather
              name="clock"
              size={20}
              color={
                activeBottomTab === 'clock' ? colors.accent : colors.textMuted
              }
            />
          </View>
          <Text
            style={[
              styles.navTabLabel,
              {
                color:
                  activeBottomTab === 'clock'
                    ? colors.accent
                    : colors.textMuted,
                fontWeight: activeBottomTab === 'clock' ? '800' : '600',
              },
            ]}
            numberOfLines={1}
          >
            {clockInLabel}
          </Text>
          {activeBottomTab === 'clock' && (
            <View
              style={[
                styles.activeIndicator,
                { backgroundColor: colors.accent },
              ]}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    zIndex: 30,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingTop: 4,
    paddingHorizontal: 6,
  },
  navIconSlot: {
    width: 24,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTabLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    marginTop: 2,
    maxWidth: '100%',
  },
  activeIndicator: {
    width: 20,
    height: 3,
    borderRadius: 2,
    marginTop: 3,
  },
  fabWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: MACQUIRES_PALETTE.orangePantone,
    shadowOpacity: 0.38,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
});

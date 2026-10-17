import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { DashboardSectionId } from '../services/dashboardOptimizationService';
import { ThemeColors } from '../theme/colors';
import { rtlRow } from '../theme/typography';

interface SkeletonPulseProps {
  colors: ThemeColors;
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonPulse: React.FC<SkeletonPulseProps> = React.memo(
  ({ colors, width, height, borderRadius = 8, style }) => {
    const pulseAnim = useRef(new Animated.Value(0.38)).current;

    useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.88,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.38,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, [pulseAnim]);

    const barColor = colors.isDark
      ? 'rgba(59, 110, 156, 0.28)'
      : 'rgba(0, 44, 82, 0.09)';

    return (
      <Animated.View
        style={[
          {
            width,
            height,
            borderRadius,
            backgroundColor: barColor,
            opacity: pulseAnim,
          },
          style,
        ]}
      />
    );
  }
);

interface DashboardSectionSkeletonProps {
  sectionId: DashboardSectionId;
  colors: ThemeColors;
  isRTL: boolean;
  actionCardCount?: number;
}

/**
 * Geometry-matched Skeleton Shimmer Cards for each Dashboard section.
 * Prevents Cumulative Layout Shift (CLS) while Tier 1, Tier 2, and Tier 3
 * database queries resolve independently.
 */
export const DashboardSectionSkeleton: React.FC<DashboardSectionSkeletonProps> =
  React.memo(({ sectionId, colors, isRTL, actionCardCount = 6 }) => {
    if (sectionId === 'balances') {
      return (
        <View style={[styles.horizontalRow, rtlRow(isRTL)]}>
          {[0, 1].map((idx) => (
            <View
              key={idx}
              style={[
                styles.balanceCardSkeleton,
                rtlRow(isRTL),
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={{ flex: 1, gap: 10 }}>
                <SkeletonPulse
                  colors={colors}
                  width="68%"
                  height={14}
                  borderRadius={6}
                />
                <SkeletonPulse
                  colors={colors}
                  width="48%"
                  height={12}
                  borderRadius={6}
                />
              </View>
              <SkeletonPulse
                colors={colors}
                width={20}
                height={20}
                borderRadius={10}
              />
            </View>
          ))}
        </View>
      );
    }

    if (sectionId === 'actions') {
      const slots = Array.from({ length: actionCardCount }, (_, i) => i);
      return (
        <View style={[styles.actionsGridSkeleton, rtlRow(isRTL)]}>
          {slots.map((idx) => (
            <View
              key={idx}
              style={[
                styles.actionCardSkeleton,
                rtlRow(isRTL),
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <SkeletonPulse
                colors={colors}
                width={38}
                height={38}
                borderRadius={12}
              />
              <SkeletonPulse
                colors={colors}
                width="56%"
                height={13}
                borderRadius={6}
              />
            </View>
          ))}
        </View>
      );
    }

    if (sectionId === 'whos_off' || sectionId === 'birthdays') {
      return (
        <View style={[styles.horizontalRow, rtlRow(isRTL)]}>
          {[0, 1].map((idx) => (
            <View
              key={idx}
              style={[
                styles.whosOffCardSkeleton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={[styles.whosOffTopRow, rtlRow(isRTL)]}>
                <SkeletonPulse
                  colors={colors}
                  width={46}
                  height={46}
                  borderRadius={23}
                />
                <SkeletonPulse
                  colors={colors}
                  width={92}
                  height={38}
                  borderRadius={12}
                />
              </View>
              <SkeletonPulse
                colors={colors}
                width="74%"
                height={14}
                borderRadius={6}
                style={{ marginBottom: 8 }}
              />
              <SkeletonPulse
                colors={colors}
                width="54%"
                height={11}
                borderRadius={5}
              />
            </View>
          ))}
        </View>
      );
    }

    // 'events' section skeleton
    return (
      <View>
        {[0, 1].map((idx) => (
          <View
            key={idx}
            style={[
              styles.eventCardSkeleton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.eventTopRow, rtlRow(isRTL)]}>
              <SkeletonPulse
                colors={colors}
                width={42}
                height={42}
                borderRadius={21}
              />
              <View style={{ flex: 1, gap: 8, marginHorizontal: 12 }}>
                <SkeletonPulse
                  colors={colors}
                  width="70%"
                  height={14}
                  borderRadius={6}
                />
                <SkeletonPulse
                  colors={colors}
                  width="45%"
                  height={11}
                  borderRadius={5}
                />
              </View>
              <SkeletonPulse
                colors={colors}
                width={18}
                height={18}
                borderRadius={9}
              />
            </View>
            <SkeletonPulse
              colors={colors}
              width="40%"
              height={12}
              borderRadius={5}
              style={{ marginBottom: 6 }}
            />
            <SkeletonPulse
              colors={colors}
              width="52%"
              height={11}
              borderRadius={5}
            />
          </View>
        ))}
      </View>
    );
  });

const styles = StyleSheet.create({
  horizontalRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 6,
  },
  balanceCardSkeleton: {
    width: 224,
    height: 78,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionsGridSkeleton: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 11,
  },
  actionCardSkeleton: {
    width: '48.3%',
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 10,
  },
  whosOffCardSkeleton: {
    width: 215,
    height: 126,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  whosOffTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  eventCardSkeleton: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
    marginBottom: 12,
  },
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
});

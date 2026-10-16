import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { makeTr } from "../i18n/localize";
import { TRANSLATIONS } from '../i18n/translations';
import { ThemeColors } from '../theme/colors';
import { AppLanguage, rtlRow, rtlText, TYPOGRAPHY } from '../theme/typography';

interface ClockInScreenProps {
  colors: ThemeColors;
  lang: AppLanguage;
  isClockedIn: boolean;
  isOnBreak: boolean;
  clockInTime: string;
  clockOutTime: string;
  breakInTime: string;
  breakOutTime: string;
  elapsedMinutes: number;
  onToggleClockInOut: () => void;
  onToggleBreak: () => void;
  onOpenAttendanceHistory: () => void;
  onBackToDashboard: () => void;
}

export const ClockInScreen: React.FC<ClockInScreenProps> = ({
  colors,
  lang,
  isClockedIn,
  isOnBreak,
  clockInTime,
  clockOutTime,
  breakInTime,
  breakOutTime,
  elapsedMinutes,
  onToggleClockInOut,
  onToggleBreak,
  onOpenAttendanceHistory,
  onBackToDashboard,
}) => {
  const [now, setNow] = useState(new Date());
  const [autoClockEnabled, setAutoClockEnabled] = useState(true);
  const isRTL = lang === 'ar';
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const tr = makeTr(lang);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hoursElapsed = Math.floor(elapsedMinutes / 60);
  const minsElapsed = elapsedMinutes % 60;

  const formattedClock = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const formattedDate = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Consistent Top Navigation Header with Back Button */}
      <View
        style={[
          styles.topHeaderBar,
          rtlRow(isRTL),
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.circleBackButton,
            { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
          ]}
          onPress={onBackToDashboard}
          accessibilityLabel={t.back}
        >
          <Feather
            name={isRTL ? 'chevron-right' : 'chevron-left'}
            size={20}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
        <Text
          style={[
            TYPOGRAPHY.cardTitle,
            { color: colors.textPrimary, flex: 1, textAlign: 'center' },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {t.geoAttendanceTitle}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Geofence Map Header */}
        <View
          style={[
            styles.mapContainer,
            { backgroundColor: colors.isDark ? colors.surfaceSubtle : '#E8EEF2' },
          ]}
        >
          <View
            style={[
              styles.roadHorizontal,
              { backgroundColor: colors.isDark ? colors.border : colors.surface },
            ]}
          />
          <View
            style={[
              styles.roadVertical,
              { backgroundColor: colors.isDark ? colors.border : colors.surface },
            ]}
          />
          <View
            style={[
              styles.roadDiagonal,
              { backgroundColor: colors.isDark ? colors.border : colors.surface },
            ]}
          />

          <Text
            style={[
              styles.mapStreetLabelTop,
              { color: colors.textMuted },
            ]}
            numberOfLines={1}
          >
            {tr("King Fahd Rd • Riyadh Digital City")}
          </Text>

          {/* Geofence Radius Circle */}
          <View
            style={[
              styles.geofenceCircle,
              {
                borderColor: colors.primary,
                backgroundColor: `${colors.primary}22`,
              },
            ]}
          >
            <View
              style={[
                styles.geofencePinOuter,
                { backgroundColor: colors.accent },
              ]}
            >
              <Feather name="map-pin" size={18} color={colors.textOnPrimary} />
            </View>
          </View>

          <View style={styles.mapBottomActionRow}>
            <TouchableOpacity
              style={[
                styles.autoClockChip,
                rtlRow(isRTL),
                {
                  backgroundColor: colors.surface,
                  borderColor: autoClockEnabled ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setAutoClockEnabled((prev) => !prev)}
            >
              <Feather
                name={autoClockEnabled ? 'check-circle' : 'circle'}
                size={14}
                color={autoClockEnabled ? colors.accent : colors.textMuted}
              />
              <Text
                style={[styles.autoClockText, { color: colors.textPrimary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {autoClockEnabled ? t.autoClockActive : t.autoClockOff}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Elapsed Banner */}
        <View style={[styles.elapsedRow, rtlRow(isRTL)]}>
          <Text
            style={[
              styles.elapsedText,
              { color: colors.textPrimary },
              rtlText(isRTL),
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {isClockedIn
              ? `${hoursElapsed} ${t.hours} ${minsElapsed}m ${t.sinceClockIn}`
              : t.shiftCompletedReady}
          </Text>
          <Feather name="info" size={16} color={colors.textMuted} />
        </View>

        {/* Digital Clock & Location Accuracy Card */}
        <View
          style={[
            styles.clockCard,
            { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
          ]}
        >
          <View style={[styles.timeHeadlineRow, rtlRow(isRTL)]}>
            <Feather name="clock" size={22} color={colors.accent} />
            <Text
              style={[styles.digitalTimeText, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {formattedClock}
            </Text>
          </View>

          <Text
            style={[styles.timezoneDateText, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            GMT +3 hours • {formattedDate}
          </Text>

          <View style={[styles.accuracyRow, rtlRow(isRTL)]}>
            <Text
              style={[styles.accuracyLabel, { color: colors.textMuted }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t.locationAccuracy}
            </Text>
            <View
              style={[
                styles.accurateBadge,
                { backgroundColor: colors.successBg },
              ]}
            >
              <Text
                style={[styles.accurateBadgeText, { color: colors.successText }]}
                numberOfLines={1}
              >
                {t.accurate}
              </Text>
            </View>
          </View>
        </View>

        {/* 2x2 Status Grid */}
        <View style={[styles.gridWrap, rtlRow(isRTL)]}>
          <View
            style={[
              styles.stampBox,
              {
                backgroundColor: colors.surface,
                borderColor: !isClockedIn ? colors.accent : colors.border,
                borderWidth: !isClockedIn ? 2 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.stampTitleMuted,
                { color: colors.textMuted },
                rtlText(isRTL),
              ]}
              numberOfLines={1}
            >
              {t.clockIn}
            </Text>
            <Text
              style={[
                styles.stampValue,
                { color: colors.textSecondary },
                rtlText(isRTL),
              ]}
              numberOfLines={1}
            >
              {clockInTime}
            </Text>
          </View>

          <View
            style={[
              styles.stampBox,
              {
                backgroundColor: colors.surface,
                borderColor: isClockedIn ? colors.accent : colors.border,
                borderWidth: isClockedIn ? 2 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.stampTitleActive,
                { color: colors.textPrimary },
                rtlText(isRTL),
              ]}
              numberOfLines={1}
            >
              {t.clockOut}
            </Text>
            <Text
              style={[
                styles.stampValue,
                { color: colors.textMuted },
                rtlText(isRTL),
              ]}
              numberOfLines={1}
            >
              {clockOutTime}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.stampBox,
              {
                backgroundColor: colors.surface,
                borderColor: isOnBreak ? colors.accent : colors.border,
                borderWidth: isOnBreak ? 2 : 1,
              },
            ]}
            onPress={onToggleBreak}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.stampTitleActive,
                { color: colors.textPrimary },
                rtlText(isRTL),
              ]}
              numberOfLines={1}
            >
              {t.breakIn}
            </Text>
            <Text
              style={[
                styles.stampValue,
                { color: colors.textMuted },
                rtlText(isRTL),
              ]}
              numberOfLines={1}
            >
              {breakInTime}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.stampBox,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={onToggleBreak}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.stampTitleMuted,
                { color: colors.textMuted },
                rtlText(isRTL),
              ]}
              numberOfLines={1}
            >
              {t.breakOut}
            </Text>
            <Text
              style={[
                styles.stampValue,
                { color: colors.textMuted },
                rtlText(isRTL),
              ]}
              numberOfLines={1}
            >
              {breakOutTime}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Primary Clock-out / Clock-in CTA Button */}
        <TouchableOpacity
          style={[
            styles.primaryActionButton,
            { backgroundColor: isClockedIn ? colors.primary : colors.accent },
          ]}
          onPress={onToggleClockInOut}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryActionButtonText} numberOfLines={1}>
            {isClockedIn ? t.clockOut : t.clockIn}
          </Text>
        </TouchableOpacity>

        {/* Secondary Break / Attendance Log Controls */}
        <View style={[styles.secondaryButtonsRow, rtlRow(isRTL)]}>
          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={onToggleBreak}
          >
            <Text
              style={[styles.secondaryBtnText, { color: colors.textPrimary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {isOnBreak ? t.endBreak : t.startBreak}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              rtlRow(isRTL),
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              },
            ]}
            onPress={onOpenAttendanceHistory}
          >
            <Text
              style={[styles.secondaryBtnText, { color: colors.accent }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t.viewAttendanceLog}
            </Text>
            <Feather
              name={isRTL ? 'chevron-left' : 'chevron-right'}
              size={16}
              color={colors.accent}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeaderBar: {
    height: 54,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  circleBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  contentContainer: {
    paddingBottom: 110,
  },
  mapContainer: {
    height: 205,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  roadHorizontal: {
    position: 'absolute',
    width: '120%',
    height: 14,
    top: 70,
    transform: [{ rotate: '8deg' }],
    opacity: 0.75,
  },
  roadVertical: {
    position: 'absolute',
    width: 12,
    height: '130%',
    left: '48%',
    transform: [{ rotate: '-12deg' }],
    opacity: 0.75,
  },
  roadDiagonal: {
    position: 'absolute',
    width: '120%',
    height: 10,
    bottom: 50,
    transform: [{ rotate: '-18deg' }],
    opacity: 0.65,
  },
  mapStreetLabelTop: {
    position: 'absolute',
    top: 14,
    left: 16,
    fontSize: 11,
    fontWeight: '700',
  },
  geofenceCircle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geofencePinOuter: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  mapBottomActionRow: {
    position: 'absolute',
    bottom: 12,
  },
  autoClockChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 300,
  },
  autoClockText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  elapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 6,
  },
  elapsedText: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  clockCard: {
    marginHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  timeHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  digitalTimeText: {
    fontSize: 26,
    fontWeight: '800',
  },
  timezoneDateText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  accuracyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accuracyLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  accurateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  accurateBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    rowGap: 10,
    marginBottom: 16,
  },
  stampBox: {
    width: '48.4%',
    borderRadius: 16,
    padding: 14,
  },
  stampTitleMuted: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  stampTitleActive: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  stampValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  primaryActionButton: {
    marginHorizontal: 18,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
});

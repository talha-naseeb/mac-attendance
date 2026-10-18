import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LiveLocationMap } from '../components/LiveLocationMap';
import { useLocationSecurity } from '../hooks/useLocationSecurity';
import { TRANSLATIONS } from '../i18n/translations';
import { OfflineAttendancePunch } from '../services/offlineSyncAndCompliance';
import { TeamsPresenceState } from '../services/microsoftGraph';
import { MACQUIRES_PALETTE, ThemeColors } from '../theme/colors';
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
  teamsPresence?: TeamsPresenceState;
  offlineQueueCount?: number;
  onToggleClockInOut: () => void;
  onToggleBreak: () => void;
  onOpenAttendanceHistory: () => void;
  onBackToDashboard: () => void;
  onSecurityAuditEvent?: (message: string, blocked: boolean) => void;
  onQueueOfflinePunch?: (punch: OfflineAttendancePunch) => void;
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
  onSecurityAuditEvent,
}) => {
  const [now, setNow] = useState(new Date());
  const [autoClockEnabled, setAutoClockEnabled] = useState(true);
  const [securityBannerMsg, setSecurityBannerMsg] = useState<string | null>(
    null
  );

  // Live Hardware GPS + Reverse Geocoded Address + 6-Layer Security
  const {
    telemetry,
    verdict,
    loadingLocation,
    liveAddressLabel,
    refreshLiveLocation,
  } = useLocationSecurity();

  const isRTL = lang === 'ar';
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;

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

  const handleGuardedClockAction = () => {
    if (!verdict.allowed) {
      const reason =
        verdict.violationDetails[0] ||
        'Attendance restricted by MacqHR Anti-Spoofing Policy.';
      setSecurityBannerMsg(
        isRTL
          ? `تم حظر تسجيل الحضور أمنياً: ${verdict.violations.join(' ، ')}`
          : `Blocked by Location Guard: ${reason}`
      );
      onSecurityAuditEvent?.(reason, true);
      return;
    }

    setSecurityBannerMsg(null);
    onToggleClockInOut();
    onSecurityAuditEvent?.(
      `Verified punch at ${liveAddressLabel} (Trust: ${verdict.trustScore}%)`,
      false
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Clean Top Navigation Header */}
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
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.border,
            },
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
        <TouchableOpacity
          style={[
            styles.circleBackButton,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.border,
            },
          ]}
          onPress={refreshLiveLocation}
          accessibilityLabel="Refresh Live GPS"
        >
          <Feather
            name={loadingLocation ? 'loader' : 'crosshair'}
            size={18}
            color={colors.accent}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Interactive react-native-maps Viewport Centered on Live GPS Coordinates */}
        <View
          style={[
            styles.mapContainer,
            {
              backgroundColor: colors.isDark
                ? colors.surfaceSubtle
                : '#E8EEF5',
            },
          ]}
        >
          <LiveLocationMap
            latitude={telemetry.latitude}
            longitude={telemetry.longitude}
            radiusMeters={verdict.nearestBranch.radiusMeters}
            allowed={verdict.allowed}
            addressLabel={liveAddressLabel}
            loadingLocation={loadingLocation}
            colors={colors}
          />

          {/* Single Clean Floating Pill at Bottom of Map Showing Live Location Name */}
          <View style={styles.mapBottomActionRow}>
            <TouchableOpacity
              style={[
                styles.autoClockChip,
                rtlRow(isRTL),
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setAutoClockEnabled((prev) => !prev)}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: verdict.allowed
                      ? '#10B981'
                      : colors.dangerText,
                  },
                ]}
              />
              <Text
                style={[styles.autoClockText, { color: colors.textPrimary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {liveAddressLabel}
              </Text>
              <Text style={[styles.zoneMutedText, { color: colors.textMuted }]}>
                • {autoClockEnabled ? t.autoClockActive : t.autoClockOff}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Only shown if an actual Location Security violation occurs */}
        {(!verdict.allowed || securityBannerMsg) && (
          <View
            style={[
              styles.violationAlertBox,
              {
                backgroundColor: colors.dangerBg,
                borderColor: colors.dangerText,
              },
            ]}
          >
            <View style={[styles.violationHeaderRow, rtlRow(isRTL)]}>
              <Feather name="shield-off" size={15} color={colors.dangerText} />
              <Text
                style={[
                  styles.violationAlertTitle,
                  { color: colors.dangerText },
                ]}
              >
                {securityBannerMsg ||
                  (isRTL
                    ? 'خارج النطاق الجغرافي المسموح'
                    : 'Outside Authorized Office Zone')}
              </Text>
            </View>
          </View>
        )}

        {/* Elapsed Working Time Row */}
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
          <View
            style={[
              styles.accurateBadge,
              {
                backgroundColor: verdict.insideGeofence
                  ? colors.successBg
                  : colors.dangerBg,
              },
            ]}
          >
            <Text
              style={[
                styles.accurateBadgeText,
                {
                  color: verdict.insideGeofence
                    ? colors.successText
                    : colors.dangerText,
                },
              ]}
              numberOfLines={1}
            >
              {verdict.insideGeofence
                ? t.accurate
                : isRTL
                  ? 'خارج النطاق'
                  : 'Out of Zone'}
            </Text>
          </View>
        </View>

        {/* Clean Digital Clock Card */}
        <View
          style={[
            styles.clockCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.timeHeadlineRow, rtlRow(isRTL)]}>
            <Feather name="clock" size={20} color={colors.accent} />
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
            {formattedDate}
          </Text>
        </View>

        {/* 2x2 Status Grid (Clock In / Out / Break In / Out) */}
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
            rtlRow(isRTL),
            {
              backgroundColor: !verdict.allowed
                ? MACQUIRES_PALETTE.spanishGrey
                : isClockedIn
                  ? colors.primary
                  : colors.accent,
            },
          ]}
          onPress={handleGuardedClockAction}
          activeOpacity={0.85}
          accessibilityLabel={isClockedIn ? t.clockOut : t.clockIn}
        >
          <Feather
            name={!verdict.allowed ? 'lock' : 'check-circle'}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.primaryActionButtonText} numberOfLines={1}>
            {isClockedIn ? t.clockOut : t.clockIn}
          </Text>
        </TouchableOpacity>

        {/* Clean 2-Button Secondary Row: Break & Attendance Log */}
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
    height: 225,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  mapBottomActionRow: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  autoClockChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '94%',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  autoClockText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  zoneMutedText: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 0,
  },
  violationAlertBox: {
    marginHorizontal: 18,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  violationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  violationAlertTitle: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  elapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 8,
  },
  elapsedText: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  accurateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  accurateBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  clockCard: {
    marginHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 14,
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
    fontSize: 12,
    fontWeight: '600',
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
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
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
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
});

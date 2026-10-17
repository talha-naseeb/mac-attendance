import React, { useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  SimulationPreset,
  useLocationSecurity,
} from '../hooks/useLocationSecurity';
import { makeTr } from '../i18n/localize';
import { TRANSLATIONS } from '../i18n/translations';
import {
  OfflineAttendancePunch,
  createSignedOfflinePunch,
} from '../services/offlineSyncAndCompliance';
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

const PRESET_LABELS: Array<{
  id: SimulationPreset;
  labelEn: string;
  labelAr: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
  {
    id: 'LIVE_VERIFIED_HQ',
    labelEn: 'Verified Riyadh HQ',
    labelAr: 'المقر الرئيسي (موثق)',
    icon: 'shield',
  },
  {
    id: 'REAL_DEVICE_GPS',
    labelEn: 'Device Hardware GPS',
    labelAr: 'موقع الجهاز الفعلي',
    icon: 'navigation',
  },
  {
    id: 'SIMULATE_SPOOF_MOCK_GPS',
    labelEn: 'Test Fake/Mock GPS',
    labelAr: 'اختبار تزييف الموقع',
    icon: 'alert-octagon',
  },
  {
    id: 'SIMULATE_OUTSIDE_GEOFENCE',
    labelEn: 'Test Outside Fence',
    labelAr: 'اختبار خارج النطاق',
    icon: 'map-pin',
  },
  {
    id: 'SIMULATE_POOR_ACCURACY',
    labelEn: 'Test Low Accuracy (>50m)',
    labelAr: 'اختبار ضعف الدقة',
    icon: 'wifi-off',
  },
  {
    id: 'SIMULATE_COMPROMISED_ROOT',
    labelEn: 'Test Root/Jailbreak',
    labelAr: 'اختبار كسر الحماية',
    icon: 'slash',
  },
];

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
  teamsPresence,
  onToggleClockInOut,
  onToggleBreak,
  onOpenAttendanceHistory,
  onBackToDashboard,
  onSecurityAuditEvent,
  onQueueOfflinePunch,
}) => {
  const [now, setNow] = useState(new Date());
  const [autoClockEnabled, setAutoClockEnabled] = useState(true);
  const [offlineSimMode, setOfflineSimMode] = useState(false);
  const [securityBannerMsg, setSecurityBannerMsg] = useState<string | null>(
    null
  );
  const [mapMode, setMapMode] = useState<'vector' | 'google_embed'>('vector');

  const {
    telemetry,
    verdict,
    loadingLocation,
    simulationPreset,
    setSimulationPreset,
    refreshLiveLocation,
    toggleBiometricVerified,
    toggleWifiConnected,
  } = useLocationSecurity();

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

  const handleGuardedClockAction = () => {
    if (!verdict.allowed) {
      const reason =
        verdict.violationDetails[0] ||
        'Attendance restricted by MacqHR Anti-Spoofing Policy.';
      setSecurityBannerMsg(
        isRTL
          ? `تم حظر تسجيل الحضور أمنياً: ${verdict.violations.join(' ، ')}`
          : `Blocked by Anti-Spoofing Guard: ${reason}`
      );
      onSecurityAuditEvent?.(reason, true);
      return;
    }

    setSecurityBannerMsg(null);

    if (offlineSimMode && onQueueOfflinePunch) {
      const punch = createSignedOfflinePunch({
        employeeId: 'EMP-1042',
        action: isClockedIn ? 'CLOCK_OUT' : 'CLOCK_IN',
        latitude: telemetry.latitude,
        longitude: telemetry.longitude,
        accuracyMeters: telemetry.accuracy ?? 10,
        wifiBssid: telemetry.wifiBssid ?? 'NONE',
      });
      onQueueOfflinePunch(punch);
    }

    onToggleClockInOut();
    onSecurityAuditEvent?.(
      `Verified punch at ${verdict.nearestBranch.name} (Trust: ${verdict.trustScore}%)`,
      false
    );
  };

  // Calculate visual pin offset inside the radar map based on distance
  const pinOffsetPx = Math.min(
    72,
    Math.round((verdict.distanceMeters / verdict.nearestBranch.radiusMeters) * 42)
  );

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
        {/* Live Google Maps & Geofence Telemetry Viewport */}
        <View
          style={[
            styles.mapContainer,
            {
              backgroundColor: colors.isDark
                ? colors.surfaceSubtle
                : '#E4ECF5',
            },
          ]}
        >
          {Platform.OS === 'web' && mapMode === 'google_embed' ? (
            <View style={styles.webIframeWrap}>
              {React.createElement('iframe', {
                title: 'Google Maps Live Geofence',
                width: '100%',
                height: '100%',
                style: { border: 0 },
                loading: 'lazy',
                src: `https://maps.google.com/maps?q=${telemetry.latitude},${telemetry.longitude}&z=17&output=embed`,
              })}
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.roadHorizontal,
                  {
                    backgroundColor: colors.isDark
                      ? colors.border
                      : colors.surface,
                  },
                ]}
              />
              <View
                style={[
                  styles.roadVertical,
                  {
                    backgroundColor: colors.isDark
                      ? colors.border
                      : colors.surface,
                  },
                ]}
              />
              <View
                style={[
                  styles.roadDiagonal,
                  {
                    backgroundColor: colors.isDark
                      ? colors.border
                      : colors.surface,
                  },
                ]}
              />

              {/* Geofence Radius Circle */}
              <View
                style={[
                  styles.geofenceCircle,
                  {
                    borderColor: verdict.allowed
                      ? colors.primary
                      : colors.dangerText,
                    backgroundColor: verdict.allowed
                      ? `${colors.primary}22`
                      : `${colors.dangerText}22`,
                  },
                ]}
              >
                {/* Live Employee Coordinate Pin */}
                <View
                  style={[
                    styles.geofencePinOuter,
                    {
                      backgroundColor: verdict.allowed
                        ? colors.accent
                        : colors.dangerText,
                      transform: [
                        { translateX: pinOffsetPx },
                        { translateY: -pinOffsetPx * 0.4 },
                      ],
                    },
                  ]}
                >
                  <Feather
                    name={verdict.allowed ? 'map-pin' : 'alert-triangle'}
                    size={17}
                    color={colors.textOnPrimary}
                  />
                </View>
              </View>
            </>
          )}

          {/* Top Overlay: Branch Title & Live Coordinates */}
          <View
            style={[
              styles.mapTopOverlay,
              rtlRow(isRTL),
              {
                backgroundColor: `${colors.surface}E6`,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.mapBranchTitle, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {isRTL
                  ? verdict.nearestBranch.nameAr
                  : verdict.nearestBranch.name}
              </Text>
              <Text
                style={[styles.mapCoordsSub, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                GPS: {telemetry.latitude.toFixed(4)}° N,{' '}
                {telemetry.longitude.toFixed(4)}° E • {verdict.distanceMeters}m{' '}
                {isRTL ? 'من المركز' : 'from center'} (R=
                {verdict.nearestBranch.radiusMeters}m)
              </Text>
            </View>

            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={[
                  styles.mapToggleMiniBtn,
                  {
                    backgroundColor: colors.primarySoft,
                    borderColor: colors.primary,
                  },
                ]}
                onPress={() =>
                  setMapMode((m) =>
                    m === 'vector' ? 'google_embed' : 'vector'
                  )
                }
              >
                <Feather name="map" size={12} color={colors.primary} />
                <Text
                  style={[styles.mapToggleMiniText, { color: colors.primary }]}
                >
                  {mapMode === 'vector'
                    ? isRTL
                      ? 'خريطة جوجل'
                      : 'Google Map'
                    : isRTL
                      ? 'رادار النطاق'
                      : 'Radar View'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.mapBottomActionRow}>
            <TouchableOpacity
              style={[
                styles.autoClockChip,
                rtlRow(isRTL),
                {
                  backgroundColor: colors.surface,
                  borderColor: autoClockEnabled
                    ? colors.primary
                    : colors.border,
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

        {/* Anti-Spoofing Security Shield Card (RULES.md Section 2) */}
        <View
          style={[
            styles.securityCard,
            {
              backgroundColor: colors.surface,
              borderColor: verdict.allowed ? colors.border : colors.dangerText,
            },
          ]}
        >
          <View style={[styles.securityHeaderRow, rtlRow(isRTL)]}>
            <View style={[styles.securityTitleGroup, rtlRow(isRTL)]}>
              <Feather
                name={verdict.allowed ? 'shield' : 'alert-octagon'}
                size={18}
                color={verdict.allowed ? colors.successText : colors.dangerText}
              />
              <Text
                style={[styles.securityCardTitle, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {isRTL
                  ? 'درع الحماية من تزييف الموقع (Anti-Spoofing)'
                  : 'Anti-Spoofing & Live Telemetry Guard'}
              </Text>
            </View>
            <View
              style={[
                styles.trustScorePill,
                {
                  backgroundColor: verdict.allowed
                    ? colors.successBg
                    : colors.dangerBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.trustScoreText,
                  {
                    color: verdict.allowed
                      ? colors.successText
                      : colors.dangerText,
                  },
                ]}
              >
                {isRTL ? `الثقة ${verdict.trustScore}%` : `Trust ${verdict.trustScore}%`}
              </Text>
            </View>
          </View>

          {/* 4-Pill Telemetry Verification Matrix */}
          <View style={[styles.telemetryGrid, rtlRow(isRTL)]}>
            <View
              style={[
                styles.telemetryChip,
                {
                  backgroundColor: !verdict.isMockDetected
                    ? colors.successBg
                    : colors.dangerBg,
                },
              ]}
            >
              <Feather
                name={!verdict.isMockDetected ? 'check-circle' : 'x-circle'}
                size={13}
                color={
                  !verdict.isMockDetected
                    ? colors.successText
                    : colors.dangerText
                }
              />
              <Text
                style={[
                  styles.telemetryChipText,
                  {
                    color: !verdict.isMockDetected
                      ? colors.successText
                      : colors.dangerText,
                  },
                ]}
                numberOfLines={1}
              >
                {!verdict.isMockDetected
                  ? isRTL
                    ? 'مزود GPS أصلي'
                    : 'Hardware GPS Real'
                  : isRTL
                    ? 'تم كشف موقع مزيف!'
                    : 'Mock GPS Detected!'}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.telemetryChip,
                {
                  backgroundColor: verdict.wifiVerified
                    ? colors.successBg
                    : colors.warningBg,
                },
              ]}
              onPress={toggleWifiConnected}
            >
              <Feather
                name="wifi"
                size={13}
                color={
                  verdict.wifiVerified ? colors.successText : colors.warningText
                }
              />
              <Text
                style={[
                  styles.telemetryChipText,
                  {
                    color: verdict.wifiVerified
                      ? colors.successText
                      : colors.warningText,
                  },
                ]}
                numberOfLines={1}
              >
                {verdict.wifiVerified
                  ? `Wi-Fi: ${telemetry.wifiSsid}`
                  : isRTL
                    ? 'خارج شبكة المكتب'
                    : 'Off-Corp Wi-Fi'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.telemetryChip,
                {
                  backgroundColor: telemetry.biometricVerified
                    ? colors.successBg
                    : colors.dangerBg,
                },
              ]}
              onPress={toggleBiometricVerified}
            >
              <Feather
                name="user-check"
                size={13}
                color={
                  telemetry.biometricVerified
                    ? colors.successText
                    : colors.dangerText
                }
              />
              <Text
                style={[
                  styles.telemetryChipText,
                  {
                    color: telemetry.biometricVerified
                      ? colors.successText
                      : colors.dangerText,
                  },
                ]}
                numberOfLines={1}
              >
                {telemetry.biometricVerified
                  ? isRTL
                    ? 'بصمة الوجه موثقة'
                    : 'Face ID Liveness OK'
                  : isRTL
                    ? 'البصمة غير موثقة'
                    : 'Biometric Unverified'}
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.telemetryChip,
                {
                  backgroundColor: verdict.insideGeofence
                    ? colors.successBg
                    : colors.dangerBg,
                },
              ]}
            >
              <Feather
                name="compass"
                size={13}
                color={
                  verdict.insideGeofence
                    ? colors.successText
                    : colors.dangerText
                }
              />
              <Text
                style={[
                  styles.telemetryChipText,
                  {
                    color: verdict.insideGeofence
                      ? colors.successText
                      : colors.dangerText,
                  },
                ]}
                numberOfLines={1}
              >
                {verdict.insideGeofence
                  ? isRTL
                    ? `داخل النطاق (${verdict.distanceMeters}م)`
                    : `In Zone (${verdict.distanceMeters}m)`
                  : isRTL
                    ? `خارج النطاق (${verdict.distanceMeters}م)`
                    : `Outside (${verdict.distanceMeters}m)`}
              </Text>
            </View>
          </View>

          {/* Interactive Anti-Spoofing QA Simulator Strip */}
          <Text
            style={[
              styles.simulatorLabel,
              { color: colors.textMuted },
              rtlText(isRTL),
            ]}
          >
            {isRTL
              ? 'محاكي اختبار أمان الموقع (للفحص اليدوي QA):'
              : 'Anti-Spoofing QA Test Presets (Tap to simulate):'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetScrollRow}
          >
            {PRESET_LABELS.map((p) => {
              const active = simulationPreset === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.presetBtn,
                    rtlRow(isRTL),
                    {
                      backgroundColor: active
                        ? colors.primary
                        : colors.surfaceSubtle,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setSimulationPreset(p.id);
                    setSecurityBannerMsg(null);
                  }}
                >
                  <Feather
                    name={p.icon}
                    size={12}
                    color={active ? colors.textOnPrimary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.presetBtnText,
                      {
                        color: active
                          ? colors.textOnPrimary
                          : colors.textSecondary,
                      },
                    ]}
                  >
                    {isRTL ? p.labelAr : p.labelEn}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Active Security Violations Alert Box */}
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
                <Feather
                  name="shield-off"
                  size={15}
                  color={colors.dangerText}
                />
                <Text
                  style={[
                    styles.violationAlertTitle,
                    { color: colors.dangerText },
                  ]}
                >
                  {securityBannerMsg ||
                    (isRTL
                      ? 'تم اكتشاف مخالفة لقواعد الحضور الجغرافي'
                      : 'Attendance Restricted — Security Policy Violation')}
                </Text>
              </View>
              {verdict.violationDetails.map((detail, idx) => (
                <Text
                  key={idx}
                  style={[
                    styles.violationDetailText,
                    { color: colors.dangerText },
                    rtlText(isRTL),
                  ]}
                >
                  • {detail}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Elapsed Banner & Microsoft Teams Presence Status */}
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
          {teamsPresence && (
            <View
              style={[
                styles.teamsPresenceBadge,
                rtlRow(isRTL),
                {
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.primary,
                },
              ]}
            >
              <View
                style={[
                  styles.teamsDot,
                  {
                    backgroundColor:
                      teamsPresence.availability === 'Available'
                        ? '#10B981'
                        : teamsPresence.availability === 'BeRightBack'
                          ? '#F59E0B'
                          : '#6B7280',
                  },
                ]}
              />
              <Text
                style={[styles.teamsBadgeText, { color: colors.primary }]}
                numberOfLines={1}
              >
                Teams: {teamsPresence.availability}
              </Text>
            </View>
          )}
        </View>

        {/* Digital Clock & Location Accuracy Card */}
        <View
          style={[
            styles.clockCard,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.border,
            },
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
            NTP Verified GMT +3 • {formattedDate}
          </Text>

          <View style={[styles.accuracyRow, rtlRow(isRTL)]}>
            <Text
              style={[styles.accuracyLabel, { color: colors.textMuted }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {isRTL
                ? `دقة الـ GPS: ±${Math.round(telemetry.accuracy ?? 0)} متر`
                : `GPS Accuracy: ±${Math.round(telemetry.accuracy ?? 0)}m (Max 50m)`}
            </Text>
            <View
              style={[
                styles.accurateBadge,
                {
                  backgroundColor: verdict.isAccuracyAcceptable
                    ? colors.successBg
                    : colors.dangerBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.accurateBadgeText,
                  {
                    color: verdict.isAccuracyAcceptable
                      ? colors.successText
                      : colors.dangerText,
                  },
                ]}
                numberOfLines={1}
              >
                {verdict.isAccuracyAcceptable
                  ? t.accurate
                  : isRTL
                    ? 'غير دقيق'
                    : 'Low Accuracy'}
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

        {/* Primary Clock-out / Clock-in CTA Button (Restricted if Anti-Spoofing fails) */}
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
            {!verdict.allowed
              ? isRTL
                ? 'محظور أمنياً (تحقق من الموقع)'
                : 'Restricted by Location Security'
              : isClockedIn
                ? t.clockOut
                : t.clockIn}
          </Text>
        </TouchableOpacity>

        {/* Secondary Break / Attendance Log Controls + Offline Queue Toggle */}
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
                backgroundColor: offlineSimMode
                  ? colors.warningBg
                  : colors.surface,
                borderColor: offlineSimMode
                  ? colors.warningText
                  : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              },
            ]}
            onPress={() => setOfflineSimMode((prev) => !prev)}
          >
            <Feather
              name={offlineSimMode ? 'cloud-off' : 'cloud'}
              size={14}
              color={offlineSimMode ? colors.warningText : colors.textSecondary}
            />
            <Text
              style={[
                styles.secondaryBtnText,
                {
                  color: offlineSimMode
                    ? colors.warningText
                    : colors.textSecondary,
                },
              ]}
              numberOfLines={1}
            >
              {offlineSimMode
                ? isRTL
                  ? 'وضع عدم الاتصال (مفعل)'
                  : 'Offline Queue On'
                : isRTL
                  ? 'متصل بالسحابة'
                  : 'Online Sync'}
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
    height: 215,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  webIframeWrap: {
    width: '100%',
    height: '100%',
  },
  roadHorizontal: {
    position: 'absolute',
    width: '120%',
    height: 14,
    top: 80,
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
  mapTopOverlay: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mapBranchTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  mapCoordsSub: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  mapToggleMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  mapToggleMiniText: {
    fontSize: 10,
    fontWeight: '800',
  },
  geofenceCircle: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  geofencePinOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  mapBottomActionRow: {
    position: 'absolute',
    bottom: 10,
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
  securityCard: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  securityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  securityTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  securityCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  trustScorePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  trustScoreText: {
    fontSize: 11,
    fontWeight: '800',
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  telemetryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  telemetryChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  simulatorLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  presetScrollRow: {
    gap: 6,
    paddingBottom: 2,
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  presetBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  violationAlertBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  violationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  violationAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  violationDetailText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  elapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 8,
  },
  elapsedText: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  teamsPresenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  teamsDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  teamsBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  clockCard: {
    marginHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
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
    marginBottom: 14,
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
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
});

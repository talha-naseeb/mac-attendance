import React, { useState } from 'react';
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
import { AppLanguage, rtlRow, rtlText } from '../theme/typography';
import { AttendanceRecord } from '../types/zenhr';

interface AttendanceScreenProps {
  colors: ThemeColors;
  lang: AppLanguage;
  myAttendance: AttendanceRecord[];
  subordinatesAttendance: AttendanceRecord[];
  onBack: () => void;
}

export const AttendanceScreen: React.FC<AttendanceScreenProps> = ({
  colors,
  lang,
  myAttendance,
  subordinatesAttendance,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'my' | 'subordinates'>('my');
  const [statusFilter, setStatusFilter] = useState<
    'All' | 'Complete' | 'Incomplete'
  >('All');
  const isRTL = lang === 'ar';
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const tr = makeTr(lang);

  const sourceRecords =
    activeTab === 'my' ? myAttendance : subordinatesAttendance;

  const filteredRecords = sourceRecords.filter(
    (rec) => statusFilter === 'All' || rec.status === statusFilter
  );

  const cycleFilter = () => {
    setStatusFilter((prev) =>
      prev === 'All'
        ? 'Complete'
        : prev === 'Complete'
          ? 'Incomplete'
          : 'All'
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button Header */}
      <View style={[styles.topRow, rtlRow(isRTL)]}>
        <TouchableOpacity
          style={[
            styles.circleBackButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onBack}
          accessibilityLabel={t.back}
        >
          <Feather
            name={isRTL ? 'chevron-right' : 'chevron-left'}
            size={22}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Tabs: My Attendance | Subordinates' Attendance */}
      <View
        style={[
          styles.tabsRow,
          rtlRow(isRTL),
          { borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'my' && {
              borderBottomColor: colors.accent,
              borderBottomWidth: 3,
            },
          ]}
          onPress={() => setActiveTab('my')}
        >
          <Text
            style={[
              styles.tabLabel,
              {
                color:
                  activeTab === 'my' ? colors.textPrimary : colors.textMuted,
              },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {t.myAttendance}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'subordinates' && {
              borderBottomColor: colors.accent,
              borderBottomWidth: 3,
            },
          ]}
          onPress={() => setActiveTab('subordinates')}
        >
          <Text
            style={[
              styles.tabLabel,
              {
                color:
                  activeTab === 'subordinates'
                    ? colors.textPrimary
                    : colors.textMuted,
              },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {t.subordinatesAttendance}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Filters Pill Button */}
        <View style={[styles.filterBarRow, rtlRow(isRTL)]}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              rtlRow(isRTL),
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={cycleFilter}
          >
            <Feather name="sliders" size={15} color={colors.accent} />
            <Text
              style={[styles.filterText, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {t.filters}
              {statusFilter !== 'All'
                ? `: ${statusFilter === 'Complete' ? t.complete : t.incomplete}`
                : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Attendance Log Cards */}
        {filteredRecords.map((rec) => {
          const isComplete = rec.status === 'Complete';
          return (
            <View
              key={rec.id}
              style={[
                styles.attendanceCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {rec.employeeName && (
                <View style={[styles.subordinateBanner, rtlRow(isRTL)]}>
                  <Text
                    style={[styles.subordinateName, { color: colors.primary }]}
                    numberOfLines={1}
                  >
                    {tr(rec.employeeName)}
                  </Text>
                  <Text
                    style={[styles.subordinateRole, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    • {tr(rec.employeeRole)}
                  </Text>
                </View>
              )}

              <View style={[styles.topSummaryRow, rtlRow(isRTL)]}>
                <View
                  style={[
                    styles.dateBlock,
                    isRTL
                      ? {
                          borderLeftWidth: 1,
                          borderLeftColor: colors.border,
                          paddingLeft: 14,
                          marginLeft: 14,
                        }
                      : {
                          borderRightWidth: 1,
                          borderRightColor: colors.border,
                          paddingRight: 14,
                          marginRight: 14,
                        },
                  ]}
                >
                  <Text
                    style={[styles.dayNumberText, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {rec.dayNumber}
                  </Text>
                  <Text
                    style={[styles.monthYearText, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {tr(rec.monthYear)}
                  </Text>
                </View>

                <View style={styles.workingHoursWrap}>
                  <Text
                    style={[
                      styles.workingHoursTitle,
                      { color: colors.textPrimary },
                      rtlText(isRTL),
                    ]}
                    numberOfLines={1}
                  >
                    {t.workingHours}
                  </Text>
                  <Text
                    style={[
                      styles.workingHoursValue,
                      { color: colors.textSecondary },
                      rtlText(isRTL),
                    ]}
                    numberOfLines={1}
                  >
                    {tr(rec.workingHoursLabel)}
                  </Text>
                </View>

                <Feather
                  name={isRTL ? 'chevron-left' : 'chevron-right'}
                  size={20}
                  color={colors.textMuted}
                />
              </View>

              {/* Status Pill (Complete / Incomplete) */}
              <View style={[styles.statusRow, rtlRow(isRTL)]}>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: isComplete
                        ? colors.successBg
                        : colors.dangerBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      {
                        color: isComplete
                          ? colors.successText
                          : colors.dangerText,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {isComplete ? t.complete : t.incomplete}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.shiftIntervalText,
                  { color: colors.textPrimary },
                  rtlText(isRTL),
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {t.shiftInterval} {tr(rec.shiftInterval)}
              </Text>

              <View
                style={[styles.divider, { backgroundColor: colors.border }]}
              />

              {/* Clock In / Clock Out Grid */}
              <View style={[styles.clockRow, rtlRow(isRTL)]}>
                <View style={styles.clockColumn}>
                  <Text
                    style={[
                      styles.clockCaption,
                      { color: colors.textPrimary },
                      rtlText(isRTL),
                    ]}
                    numberOfLines={1}
                  >
                    {t.clockIn}
                  </Text>
                  <Text
                    style={[
                      styles.clockTimestamp,
                      { color: colors.textMuted },
                      rtlText(isRTL),
                    ]}
                    numberOfLines={1}
                  >
                    {tr(rec.clockIn)}
                  </Text>
                </View>

                <View style={styles.clockColumn}>
                  <Text
                    style={[
                      styles.clockCaption,
                      { color: colors.textPrimary },
                      rtlText(isRTL),
                    ]}
                    numberOfLines={1}
                  >
                    {t.clockOut}
                  </Text>
                  <Text
                    style={[
                      styles.clockTimestamp,
                      { color: colors.textMuted },
                      rtlText(isRTL),
                    ]}
                    numberOfLines={1}
                  >
                    {tr(rec.clockOut)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topRow: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
  },
  circleBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 90,
  },
  filterBarRow: {
    flexDirection: 'row',
    paddingVertical: 14,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  attendanceCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  subordinateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  subordinateName: {
    fontSize: 13,
    fontWeight: '800',
  },
  subordinateRole: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  topSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dayNumberText: {
    fontSize: 22,
    fontWeight: '800',
  },
  monthYearText: {
    fontSize: 12,
    fontWeight: '600',
  },
  workingHoursWrap: {
    flex: 1,
    minWidth: 0,
  },
  workingHoursTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  workingHoursValue: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  shiftIntervalText: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  clockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  clockColumn: {
    flex: 1,
    minWidth: 0,
  },
  clockCaption: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  clockTimestamp: {
    fontSize: 13,
    fontWeight: '600',
  },
});

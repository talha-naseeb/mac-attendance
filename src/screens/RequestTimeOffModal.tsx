import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { makeTr } from '../i18n/localize';
import { TRANSLATIONS } from '../i18n/translations';
import { ThemeColors } from '../theme/colors';
import { AppLanguage, rtlRow, rtlText } from '../theme/typography';
import { LeaveType } from '../types/zenhr';
import {
  calculateClientWorkingDays,
  getSaudiHolidayName,
  isSaudiWeekend,
  LEAVE_TYPES,
} from '../utils/leaveCalculator';

export interface RequestTimeOffModalProps {
  visible: boolean;
  colors: ThemeColors;
  lang: AppLanguage;
  onClose: () => void;
  onSubmitRequest: (payload: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    fromDay: number;
    toDay: number;
    daysCount: number;
    notes: string;
    hasAttachment: boolean;
    attachmentUrl?: string;
    isHalfDay?: boolean;
    halfDayPeriod?: 'MORNING' | 'AFTERNOON';
  }) => void | Promise<void>;
}

export { LEAVE_TYPES };

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const WEEKDAYS_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

function formatIso(year: number, monthZeroIndexed: number, day: number): string {
  const m = String(monthZeroIndexed + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export const RequestTimeOffModal: React.FC<RequestTimeOffModalProps> = ({
  visible,
  colors,
  lang,
  onClose,
  onSubmitRequest,
}) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth());

  const [selectedLeaveType, setSelectedLeaveType] =
    useState<LeaveType>('Annual Vacation');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(true);
  const [rangeMode, setRangeMode] = useState<'single' | 'multiple'>('multiple');

  // Day selection within current viewMonth
  const [fromDay, setFromDay] = useState<number>(Math.min(today.getDate(), 20));
  const [toDay, setToDay] = useState<number>(Math.min(today.getDate() + 4, 28));

  // Half-day option
  const [isHalfDay, setIsHalfDay] = useState<boolean>(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'MORNING' | 'AFTERNOON'>('MORNING');

  // Attachment
  const [attachmentFile, setAttachmentFile] = useState<{
    name: string;
    url: string;
  } | null>(null);

  const [notes, setNotes] = useState<string>('');

  const isRTL = lang === 'ar';
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const tr = makeTr(lang);

  // Month navigation
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
    setFromDay(1);
    setToDay(1);
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
    setFromDay(1);
    setToDay(1);
  };

  // Month metadata
  const currentViewDate = useMemo(() => new Date(viewYear, viewMonth, 1), [viewYear, viewMonth]);
  const monthName = currentViewDate.toLocaleDateString('en-US', { month: 'long' });
  const monthShort = currentViewDate.toLocaleDateString('en-US', { month: 'short' });
  const daysInMonthCount = useMemo(
    () => new Date(viewYear, viewMonth + 1, 0).getDate(),
    [viewYear, viewMonth],
  );
  const firstDayWeekday = useMemo(
    () => new Date(viewYear, viewMonth, 1).getDay(),
    [viewYear, viewMonth],
  );
  const daysInMonth = useMemo(
    () => Array.from({ length: daysInMonthCount }, (_, i) => i + 1),
    [daysInMonthCount],
  );

  // Working days & holiday calculation
  const startDateIso = formatIso(viewYear, viewMonth, fromDay);
  const effectiveToDay = rangeMode === 'single' || isHalfDay ? fromDay : toDay;
  const endDateIso = formatIso(viewYear, viewMonth, effectiveToDay);

  const calcResult = useMemo(
    () => calculateClientWorkingDays(startDateIso, endDateIso, isHalfDay),
    [startDateIso, endDateIso, isHalfDay],
  );

  const daysCount = calcResult.workingDays;

  const handleDayPress = (day: number) => {
    if (rangeMode === 'single' || isHalfDay) {
      setFromDay(day);
      setToDay(day);
      return;
    }
    if (day < fromDay) {
      setFromDay(day);
    } else if (fromDay === toDay) {
      setToDay(day);
    } else {
      setFromDay(day);
      setToDay(day);
    }
  };

  const handleToggleAttachment = () => {
    if (attachmentFile) {
      setAttachmentFile(null);
    } else {
      setAttachmentFile({
        name: 'medical_certificate.pdf',
        url: 'https://s3.me-central-1.amazonaws.com/shiftly-docs/medical_certificate.pdf',
      });
    }
  };

  const handleSubmit = async () => {
    await onSubmitRequest({
      leaveType: selectedLeaveType,
      startDate: startDateIso,
      endDate: endDateIso,
      fromDay,
      toDay: effectiveToDay,
      daysCount,
      notes,
      hasAttachment: !!attachmentFile,
      attachmentUrl: attachmentFile?.url,
      isHalfDay,
      halfDayPeriod: isHalfDay ? halfDayPeriod : undefined,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: colors.primary }]}>
        {/* Prussian Blue Header with Back & Close */}
        <View style={[styles.header, rtlRow(isRTL)]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityLabel={t.back}
          >
            <Feather
              name={isRTL ? 'chevron-right' : 'chevron-left'}
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>
          <Text
            style={[styles.headerTitle, { flex: 1, textAlign: 'center' }]}
            numberOfLines={1}
          >
            {t.requestTimeOff}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityLabel="Close"
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Form Container */}
        <View
          style={[
            styles.formContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Leave Type Field */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }, rtlText(isRTL)]}>
              Leave type <Text style={styles.asterisk}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.inputBox,
                rtlRow(isRTL),
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => setTypeDropdownOpen((prev) => !prev)}
            >
              <Text style={[styles.inputValue, { color: colors.textPrimary }]}>
                {tr(selectedLeaveType)}
              </Text>
              <Feather
                name={typeDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textPrimary}
              />
            </TouchableOpacity>

            {typeDropdownOpen && (
              <View
                style={[
                  styles.dropdownList,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {LEAVE_TYPES.map((lt) => (
                  <TouchableOpacity
                    key={lt}
                    style={[
                      styles.dropdownOption,
                      lt === selectedLeaveType && {
                        backgroundColor: colors.surfaceSubtle,
                      },
                    ]}
                    onPress={() => {
                      setSelectedLeaveType(lt);
                      setTypeDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        {
                          color:
                            lt === selectedLeaveType
                              ? colors.accent
                              : colors.textPrimary,
                        },
                      ]}
                    >
                      {tr(lt)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Leave Date Field */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }, rtlText(isRTL)]}>
              {t.leaveDateLabel} <Text style={styles.asterisk}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.inputBox,
                rtlRow(isRTL),
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => setDateSheetOpen((prev) => !prev)}
            >
              <Text style={[styles.inputValue, { color: colors.textPrimary }, rtlText(isRTL)]}>
                {monthShort} {fromDay}, {viewYear} — {monthShort} {effectiveToDay}, {viewYear}
              </Text>
              <Feather name="calendar" size={18} color={colors.accent} />
            </TouchableOpacity>

            {/* Duration & Exclusions Pill */}
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              ]}
            >
              <View style={[styles.summaryRow, rtlRow(isRTL)]}>
                <View style={styles.summaryMetric}>
                  <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                    Working Days
                  </Text>
                  <Text style={[styles.metricValue, { color: colors.accent }]}>
                    {daysCount.toFixed(2)} {t.days}
                  </Text>
                </View>
                {(calcResult.excludedWeekendDays > 0 || calcResult.excludedHolidayDays > 0) && (
                  <View style={styles.summaryMetric}>
                    <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                      Exclusions (KSA)
                    </Text>
                    <Text style={[styles.metricExcluded, { color: colors.textSecondary }]}>
                      {calcResult.excludedWeekendDays > 0 && `${calcResult.excludedWeekendDays} wknd `}
                      {calcResult.excludedHolidayDays > 0 && `${calcResult.excludedHolidayDays} holiday`}
                    </Text>
                  </View>
                )}
              </View>
              {calcResult.excludedHolidays.length > 0 && (
                <Text style={[styles.holidayTag, { color: colors.accent }]}>
                  ⭐ {calcResult.excludedHolidays.join(', ')}
                </Text>
              )}
            </View>

            {/* Notes Input */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }, rtlText(isRTL)]}>
              {t.notesLabel}
            </Text>
            <TextInput
              style={[
                styles.notesInput,
                rtlText(isRTL),
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
              placeholder={t.notesPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            {/* Attachment Document Section */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }, rtlText(isRTL)]}>
              {t.attachmentDocument}
            </Text>
            <View style={styles.attachmentContainer}>
              <TouchableOpacity
                style={[
                  styles.cameraSquare,
                  {
                    backgroundColor: colors.surface,
                    borderColor: attachmentFile ? colors.accent : colors.border,
                  },
                ]}
                onPress={handleToggleAttachment}
              >
                <Feather
                  name={attachmentFile ? 'file-text' : 'paperclip'}
                  size={20}
                  color={attachmentFile ? colors.accent : colors.textSecondary}
                />
              </TouchableOpacity>
              {attachmentFile ? (
                <View
                  style={[
                    styles.attachmentChip,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.attachmentChipText, { color: colors.textPrimary }]}>
                    {attachmentFile.name}
                  </Text>
                  <TouchableOpacity onPress={() => setAttachmentFile(null)}>
                    <Feather name="x" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[styles.cameraCaption, { color: colors.textSecondary }]}>
                  Attach medical certificate or document
                </Text>
              )}
            </View>

            {/* Embedded Calendar Picker */}
            {dateSheetOpen && (
              <View
                style={[
                  styles.calendarSheet,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.sheetHandle,
                    { backgroundColor: colors.border },
                  ]}
                />
                <Text
                  style={[styles.selectDateTitle, { color: colors.textSecondary }]}
                >
                  {t.selectDate}
                </Text>

                {/* Range Mode: Single Day vs Multiple Days */}
                <View
                  style={[
                    styles.segmentedTrack,
                    { backgroundColor: colors.surfaceSubtle },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      rangeMode === 'single' && !isHalfDay && {
                        backgroundColor: colors.surface,
                      },
                    ]}
                    onPress={() => {
                      setRangeMode('single');
                      setIsHalfDay(false);
                      setToDay(fromDay);
                    }}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color:
                            rangeMode === 'single' && !isHalfDay
                              ? colors.textPrimary
                              : colors.textMuted,
                        },
                      ]}
                    >
                      {t.oneDay}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      rangeMode === 'multiple' && !isHalfDay && {
                        backgroundColor: colors.surface,
                      },
                    ]}
                    onPress={() => {
                      setRangeMode('multiple');
                      setIsHalfDay(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color:
                            rangeMode === 'multiple' && !isHalfDay
                              ? colors.textPrimary
                              : colors.textMuted,
                        },
                      ]}
                    >
                      {t.multipleDays}
                    </Text>
                  </TouchableOpacity>

                  {/* Half-Day Segment */}
                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      isHalfDay && {
                        backgroundColor: colors.surface,
                      },
                    ]}
                    onPress={() => {
                      setIsHalfDay(true);
                      setRangeMode('single');
                      setToDay(fromDay);
                    }}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color: isHalfDay
                            ? colors.accent
                            : colors.textMuted,
                        },
                      ]}
                    >
                      ½ Half-Day
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Half-Day Period Selector */}
                {isHalfDay && (
                  <View style={[styles.halfDayTrack, { backgroundColor: colors.surfaceSubtle }]}>
                    <TouchableOpacity
                      style={[
                        styles.halfDayBtn,
                        halfDayPeriod === 'MORNING' && { backgroundColor: colors.surface },
                      ]}
                      onPress={() => setHalfDayPeriod('MORNING')}
                    >
                      <Text
                        style={[
                          styles.halfDayBtnText,
                          {
                            color:
                              halfDayPeriod === 'MORNING'
                                ? colors.accent
                                : colors.textMuted,
                          },
                        ]}
                      >
                        Morning Shift (0.5d)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.halfDayBtn,
                        halfDayPeriod === 'AFTERNOON' && { backgroundColor: colors.surface },
                      ]}
                      onPress={() => setHalfDayPeriod('AFTERNOON')}
                    >
                      <Text
                        style={[
                          styles.halfDayBtnText,
                          {
                            color:
                              halfDayPeriod === 'AFTERNOON'
                                ? colors.accent
                                : colors.textMuted,
                          },
                        ]}
                      >
                        Afternoon Shift (0.5d)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Month & Year Navigation Header with clickable chevrons */}
                <View style={styles.monthNavRow}>
                  <TouchableOpacity
                    onPress={handlePrevMonth}
                    style={styles.navArrowBtn}
                    accessibilityLabel="Previous month"
                  >
                    <Feather
                      name="chevron-left"
                      size={22}
                      color={colors.textPrimary}
                    />
                  </TouchableOpacity>

                  <Text style={[styles.monthTitle, { color: colors.textPrimary }]}>
                    {tr(`${monthName} ${viewYear}`)}
                  </Text>

                  <TouchableOpacity
                    onPress={handleNextMonth}
                    style={styles.navArrowBtn}
                    accessibilityLabel="Next month"
                  >
                    <Feather
                      name="chevron-right"
                      size={22}
                      color={colors.textPrimary}
                    />
                  </TouchableOpacity>
                </View>

                {/* Weekday Headers */}
                <View style={styles.weekdaysRow}>
                  {(lang === 'ar' ? WEEKDAYS_AR : WEEKDAYS).map((wd, idx) => (
                    <Text
                      key={wd}
                      style={[
                        styles.weekdayText,
                        {
                          color:
                            idx === 5 || idx === 6
                              ? colors.accent
                              : colors.textMuted,
                        },
                      ]}
                    >
                      {wd}
                    </Text>
                  ))}
                </View>

                {/* Days Grid with weekday alignment offset */}
                <View style={styles.daysGrid}>
                  {/* Leading empty slots */}
                  {Array.from({ length: firstDayWeekday }).map((_, i) => (
                    <View key={`empty-${i}`} style={styles.dayCell} />
                  ))}

                  {/* Day cells */}
                  {daysInMonth.map((day) => {
                    const isEndpoint =
                      day === fromDay || day === effectiveToDay;
                    const isInRange =
                      !isHalfDay &&
                      rangeMode === 'multiple' &&
                      day > fromDay &&
                      day < effectiveToDay;

                    const dateObj = new Date(viewYear, viewMonth, day);
                    const isWknd = isSaudiWeekend(dateObj);
                    const holiday = getSaudiHolidayName(dateObj);

                    return (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.dayCell,
                          isInRange && {
                            backgroundColor: colors.primarySoft,
                          },
                          isEndpoint && {
                            backgroundColor: colors.primary,
                            borderRadius: 10,
                          },
                        ]}
                        onPress={() => handleDayPress(day)}
                      >
                        <Text
                          style={[
                            styles.dayCellText,
                            {
                              color: isEndpoint
                                ? '#FFFFFF'
                                : isInRange
                                  ? colors.primary
                                  : isWknd
                                    ? colors.textMuted
                                    : colors.textPrimary,
                            },
                          ]}
                        >
                          {day}
                        </Text>
                        {holiday && (
                          <View
                            style={[
                              styles.holidayDot,
                              { backgroundColor: colors.accent },
                            ]}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Apply Button */}
                <TouchableOpacity
                  style={[
                    styles.applyButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() => void handleSubmit()}
                >
                  <Text style={styles.applyButtonText}>
                    {t.apply} ({daysCount.toFixed(2)} {t.days})
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 42,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContainer: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 8,
  },
  asterisk: {
    color: '#3B82F6',
  },
  inputBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inputValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  dropdownList: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryMetric: {
    flexDirection: 'column',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricExcluded: {
    fontSize: 13,
    fontWeight: '600',
  },
  holidayTag: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  notesInput: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10,
    minHeight: 64,
  },
  attachmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cameraSquare: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  attachmentChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cameraCaption: {
    fontSize: 13,
    fontWeight: '500',
  },
  calendarSheet: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    marginTop: 4,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  selectDateTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  segmentedTrack: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  halfDayTrack: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  halfDayBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  halfDayBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  navArrowBtn: {
    padding: 6,
    borderRadius: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayCellText: {
    fontSize: 14,
    fontWeight: '700',
  },
  holidayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  applyButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

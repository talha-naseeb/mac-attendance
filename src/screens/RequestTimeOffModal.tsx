import React, { useState } from 'react';
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
import { makeTr } from "../i18n/localize";
import { TRANSLATIONS } from '../i18n/translations';
import { ThemeColors } from '../theme/colors';
import { AppLanguage, rtlRow, rtlText } from '../theme/typography';
import { LeaveType } from '../types/zenhr';

interface RequestTimeOffModalProps {
  visible: boolean;
  colors: ThemeColors;
  lang: AppLanguage;
  onClose: () => void;
  onSubmitRequest: (payload: {
    leaveType: LeaveType;
    fromDay: number;
    toDay: number;
    daysCount: number;
    notes: string;
    hasAttachment: boolean;
  }) => void;
}

const LEAVE_TYPES: LeaveType[] = [
  'Annual Vacation',
  'Sick Day off',
  'Remote Work',
  'Emergency Leave',
  'Unpaid Leave',
];

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const WEEKDAYS_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
const DAYS_IN_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

export const RequestTimeOffModal: React.FC<RequestTimeOffModalProps> = ({
  visible,
  colors,
  lang,
  onClose,
  onSubmitRequest,
}) => {
  const [selectedLeaveType, setSelectedLeaveType] =
    useState<LeaveType>('Annual Vacation');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(true);
  const [rangeMode, setRangeMode] = useState<'single' | 'multiple'>('multiple');
  const [fromDay, setFromDay] = useState<number>(11);
  const [toDay, setToDay] = useState<number>(23);
  const [notes, setNotes] = useState<string>('');
  const [hasAttachment, setHasAttachment] = useState<boolean>(false);

  const isRTL = lang === 'ar';
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const tr = makeTr(lang);

  const daysCount =
    rangeMode === 'single' ? 1 : Math.max(1, toDay - fromDay + 1);

  const handleDayPress = (day: number) => {
    if (rangeMode === 'single') {
      setFromDay(day);
      setToDay(day);
      return;
    }
    if (day < fromDay || (fromDay !== toDay && day >= fromDay)) {
      if (day < fromDay) {
        setFromDay(day);
      } else if (fromDay === toDay) {
        setToDay(day);
      } else {
        setFromDay(day);
        setToDay(day);
      }
    }
  };

  const handleSubmit = () => {
    onSubmitRequest({
      leaveType: selectedLeaveType,
      fromDay,
      toDay: rangeMode === 'single' ? fromDay : toDay,
      daysCount,
      notes,
      hasAttachment,
    });
    onClose();
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
        <View style={[styles.tealHeader, rtlRow(isRTL)]}>
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
            style={[styles.tealHeaderTitle, { flex: 1, textAlign: 'center' }]}
            numberOfLines={1}
          >
            {t.requestTimeOff}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Rounded Sheet Container matching shot_3.png */}
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
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
              Leave type <Text style={styles.asterisk}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.inputBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => setTypeDropdownOpen((prev) => !prev)}
            >
              <Text style={[styles.inputValue, { color: colors.textPrimary }]}>
                {tr(selectedLeaveType)}
              </Text>
              <Feather name="chevron-down" size={18} color={colors.textPrimary} />
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
                    style={styles.dropdownOption}
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
                {tr(`Jan ${fromDay}, 2026`)} - {tr(`Jan ${rangeMode === 'single' ? fromDay : toDay}, 2026`)}
              </Text>
              <Feather name="calendar" size={18} color={colors.accent} />
            </TouchableOpacity>

            {/* Length Display */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }, rtlText(isRTL)]}>
              {t.lengthLabel}
            </Text>
            <Text style={[styles.lengthValue, { color: colors.textSecondary }, rtlText(isRTL)]}>
              {daysCount.toFixed(2)} {t.days}
            </Text>

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
            />

            {/* Attachment Document (Camera) matching shot_3.png */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
              {t.attachmentDocument}
            </Text>
            <View style={styles.attachmentRow}>
              <TouchableOpacity
                style={[
                  styles.cameraSquare,
                  {
                    backgroundColor: colors.surface,
                    borderColor: hasAttachment ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setHasAttachment((prev) => !prev)}
              >
                <Feather
                  name={hasAttachment ? 'check-circle' : 'camera'}
                  size={22}
                  color={hasAttachment ? colors.accent : colors.textSecondary}
                />
              </TouchableOpacity>
              <Text style={[styles.cameraCaption, { color: colors.textSecondary }]}>
                {hasAttachment ? t.attachedFile : t.camera}
              </Text>
            </View>

            {/* Embedded "Select Date" Calendar Sheet matching shot_3.png */}
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

                {/* One Day | Multiple Days Segmented Control */}
                <View
                  style={[
                    styles.segmentedTrack,
                    { backgroundColor: colors.surfaceSubtle },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      rangeMode === 'single' && {
                        backgroundColor: colors.surface,
                      },
                    ]}
                    onPress={() => {
                      setRangeMode('single');
                      setToDay(fromDay);
                    }}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color:
                            rangeMode === 'single'
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
                      rangeMode === 'multiple' && {
                        backgroundColor: colors.surface,
                      },
                    ]}
                    onPress={() => setRangeMode('multiple')}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color:
                            rangeMode === 'multiple'
                              ? colors.textPrimary
                              : colors.textMuted,
                        },
                      ]}
                    >
                      {t.multipleDays}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* From Date / To Date Boxes */}
                <View style={styles.fromToRow}>
                  <View style={styles.fromToColumn}>
                    <Text
                      style={[styles.fromToLabel, { color: colors.textPrimary }]}
                    >
                      {t.fromDate}
                    </Text>
                    <View
                      style={[
                        styles.fromToBox,
                        { borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[styles.fromToValue, { color: colors.textPrimary }]}
                      >
                        {tr(`Jan ${fromDay}, 2026`)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.fromToColumn}>
                    <Text
                      style={[styles.fromToLabel, { color: colors.textPrimary }]}
                    >
                      {t.toDate}
                    </Text>
                    <View
                      style={[
                        styles.fromToBox,
                        { borderColor: colors.accent, borderWidth: 1.5 },
                      ]}
                    >
                      <Text
                        style={[styles.fromToValue, { color: colors.textPrimary }]}
                      >
                        {tr(`Jan ${rangeMode === 'single' ? fromDay : toDay}, 2026`)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Month Header */}
                <View style={styles.monthNavRow}>
                  <Feather
                    name="chevron-left"
                    size={20}
                    color={colors.textPrimary}
                  />
                  <Text style={[styles.monthTitle, { color: colors.textPrimary }]}>
                    {tr("January 2026")}
                  </Text>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={colors.textPrimary}
                  />
                </View>

                {/* Weekday Headers */}
                <View style={styles.weekdaysRow}>
                  {(lang === 'ar' ? WEEKDAYS_AR : WEEKDAYS).map((wd) => (
                    <Text
                      key={wd}
                      style={[styles.weekdayText, { color: colors.textMuted }]}
                    >
                      {wd}
                    </Text>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={styles.daysGrid}>
                  {DAYS_IN_MONTH.map((day) => {
                    const effectiveTo =
                      rangeMode === 'single' ? fromDay : toDay;
                    const isEndpoint = day === fromDay || day === effectiveTo;
                    const isInRange = day > fromDay && day < effectiveTo;

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
                                  : colors.textPrimary,
                            },
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Apply Button matching shot_3.png */}
                <TouchableOpacity
                  style={[
                    styles.applyButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={handleSubmit}
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
  tealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 22,
  },
  tealHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  formContainer: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
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
  dropdownChevron: {
    fontSize: 18,
    fontWeight: '700',
  },
  calendarInputEmoji: {
    fontSize: 17,
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
  lengthValue: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  notesInput: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  attachmentRow: {
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  cameraSquare: {
    width: 58,
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cameraEmoji: {
    fontSize: 22,
  },
  cameraCaption: {
    fontSize: 13,
    fontWeight: '600',
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
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
  },
  segmentedTrack: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  fromToRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  fromToColumn: {
    flex: 1,
  },
  fromToLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  fromToBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  fromToValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  monthArrow: {
    fontSize: 22,
    fontWeight: '700',
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    width: '14%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
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
  applyButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

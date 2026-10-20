import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { WhosOffEntry } from '../types/zenhr';
import { ThemeColors, MACQUIRES_PALETTE } from '../theme/colors';
import { AppLanguage, rtlRow, rtlText, TYPOGRAPHY } from '../theme/typography';
import { getColleagueAvailabilitySummary } from '../services/whosOffService';

export interface ColleagueDetailModalProps {
  visible: boolean;
  colleague: WhosOffEntry | null;
  colors: ThemeColors;
  lang: AppLanguage;
  onClose: () => void;
}

export const ColleagueDetailModal: React.FC<ColleagueDetailModalProps> = ({
  visible,
  colleague,
  colors,
  lang,
  onClose,
}) => {
  if (!colleague) return null;
  const isRTL = lang === 'ar';
  const summary = getColleagueAvailabilitySummary(colleague);

  const handleCall = () => {
    if (colleague.phone) {
      Linking.openURL(`tel:${colleague.phone}`).catch(() => {});
    }
  };

  const handleEmail = () => {
    if (colleague.email) {
      Linking.openURL(`mailto:${colleague.email}`).catch(() => {});
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              {/* Header with Close */}
              <View style={[styles.headerRow, rtlRow(isRTL)]}>
                <View style={[styles.statusBadge, { backgroundColor: `${summary.badgeColor}18` }]}>
                  <View style={[styles.statusDot, { backgroundColor: summary.badgeColor }]} />
                  <Text style={[styles.statusBadgeText, { color: summary.badgeColor }]}>
                    {colleague.type === 'Remote Work'
                      ? isRTL ? 'عمل عن بعد' : 'Working Remotely'
                      : isRTL ? 'في إجازة' : 'On Leave'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    styles.closeButton,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                    },
                  ]}
                  accessibilityLabel="Close colleague modal"
                >
                  <Feather name="x" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Colleague Profile Summary */}
              <View style={[styles.profileRow, rtlRow(isRTL)]}>
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: colleague.avatarColor || MACQUIRES_PALETTE.bdazzledBlue,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={styles.avatarText}>{colleague.avatarInitials}</Text>
                </View>
                <View style={styles.profileTextWrap}>
                  <Text
                    style={[
                      TYPOGRAPHY.h2,
                      { color: colors.textPrimary },
                      rtlText(isRTL),
                    ]}
                    numberOfLines={1}
                  >
                    {colleague.employeeName}
                  </Text>
                  <Text
                    style={[
                      styles.roleText,
                      { color: colors.accent },
                      rtlText(isRTL),
                    ]}
                    numberOfLines={1}
                  >
                    {colleague.role}
                  </Text>
                  <Text
                    style={[
                      styles.deptLocationText,
                      { color: colors.textMuted },
                      rtlText(isRTL),
                    ]}
                    numberOfLines={1}
                  >
                    {colleague.department || 'Macquires'} • {colleague.location || 'HQ'}
                  </Text>
                </View>
              </View>

              {/* Availability & Contact Recommendation Box */}
              <View
                style={[
                  styles.adviceBox,
                  {
                    backgroundColor: colors.isDark
                      ? 'rgba(255,255,255,0.04)'
                      : colors.surfaceSubtle,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={[styles.adviceHeaderRow, rtlRow(isRTL)]}>
                  <Feather
                    name={summary.isReachable ? 'check-circle' : 'alert-circle'}
                    size={16}
                    color={summary.badgeColor}
                  />
                  <Text style={[styles.adviceHeadline, { color: summary.badgeColor }]}>
                    {summary.statusHeadline}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.adviceBodyText,
                    { color: colors.textSecondary },
                    rtlText(isRTL),
                  ]}
                >
                  {summary.adviceText}
                </Text>
              </View>

              {/* Schedule Info */}
              <View
                style={[
                  styles.infoRow,
                  rtlRow(isRTL),
                  { borderColor: colors.border },
                ]}
              >
                <View style={styles.infoCol}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                    {isRTL ? 'نوع الإجازة / العمل' : 'Type'}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                    {colleague.type}
                  </Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                    {isRTL ? 'الفترة' : 'Dates'}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                    {colleague.fromDate} → {colleague.toDate} ({colleague.durationLabel})
                  </Text>
                </View>
              </View>

              {/* Handover Contact if on leave */}
              {colleague.handoverContact ? (
                <View style={[styles.handoverRow, rtlRow(isRTL)]}>
                  <Feather name="corner-down-right" size={14} color={colors.accent} />
                  <Text style={[styles.handoverText, { color: colors.textMuted }, rtlText(isRTL)]}>
                    <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                      {isRTL ? 'جهة التسليم / البديل: ' : 'Backup / Handover: '}
                    </Text>
                    {colleague.handoverContact}
                  </Text>
                </View>
              ) : null}

              {/* Contact Actions Buttons */}
              <View style={[styles.actionButtonsRow, rtlRow(isRTL)]}>
                {colleague.phone ? (
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: summary.isReachable
                          ? colors.primary
                          : colors.surfaceSubtle,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={handleCall}
                    activeOpacity={0.8}
                  >
                    <Feather
                      name="phone"
                      size={16}
                      color={summary.isReachable ? MACQUIRES_PALETTE.white : colors.textPrimary}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        {
                          color: summary.isReachable
                            ? MACQUIRES_PALETTE.white
                            : colors.textPrimary,
                        },
                      ]}
                    >
                      {isRTL ? 'اتصال هاتف' : 'Call'}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {colleague.email ? (
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={handleEmail}
                    activeOpacity={0.8}
                  >
                    <Feather name="mail" size={16} color={colors.accent} />
                    <Text style={[styles.actionBtnText, { color: colors.accent }]}>
                      {isRTL ? 'بريد إلكتروني' : 'Email'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 20, 40, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 18,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 16px 40px rgba(0, 20, 50, 0.28)',
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  profileTextWrap: {
    flex: 1,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  deptLocationText: {
    fontSize: 12,
    marginTop: 2,
  },
  adviceBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  adviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  adviceHeadline: {
    fontSize: 13,
    fontWeight: '800',
  },
  adviceBodyText: {
    fontSize: 12,
    lineHeight: 17,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  handoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    paddingBottom: 4,
  },
  handoverText: {
    fontSize: 12,
    flex: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

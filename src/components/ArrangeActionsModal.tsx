import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ActionItem, ActionModuleId } from '../types/zenhr';
import { ThemeColors, MACQUIRES_PALETTE } from '../theme/colors';
import { AppLanguage, rtlRow, rtlText, TYPOGRAPHY } from '../theme/typography';

export interface ArrangeActionsModalProps {
  visible: boolean;
  colors: ThemeColors;
  lang: AppLanguage;
  allActions: ActionItem[];
  selectedActionIds: ActionModuleId[];
  onSave: (newSelectedIds: ActionModuleId[]) => void;
  onOpenModule: (moduleId: ActionModuleId) => void;
  onClose: () => void;
}

import {
  DEFAULT_SELECTED_ACTIONS,
  MAX_SELECTED_ACTIONS,
  MIN_SELECTED_ACTIONS,
  toggleActionSelection,
} from '../services/arrangeActionsService';

export {
  DEFAULT_SELECTED_ACTIONS,
  MAX_SELECTED_ACTIONS,
  MIN_SELECTED_ACTIONS,
  toggleActionSelection,
};

export const ArrangeActionsModal: React.FC<ArrangeActionsModalProps> = ({
  visible,
  colors,
  lang,
  allActions,
  selectedActionIds,
  onSave,
  onOpenModule,
  onClose,
}) => {
  const isRTL = lang === 'ar';
  const [tempSelected, setTempSelected] = useState<ActionModuleId[]>(
    selectedActionIds && selectedActionIds.length > 0
      ? selectedActionIds
      : DEFAULT_SELECTED_ACTIONS
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null
  );

  // Sync internal state whenever modal opens or props change
  useEffect(() => {
    if (visible) {
      setTempSelected(
        selectedActionIds && selectedActionIds.length > 0
          ? selectedActionIds
          : DEFAULT_SELECTED_ACTIONS
      );
      setValidationMessage(null);
    }
  }, [visible, selectedActionIds]);

  const handleToggle = useCallback(
    (actionId: ActionModuleId) => {
      setValidationMessage(null);
      const result = toggleActionSelection(
        tempSelected,
        actionId,
        MAX_SELECTED_ACTIONS,
        MIN_SELECTED_ACTIONS
      );

      if (result.error?.startsWith('MAX_REACHED')) {
        setValidationMessage(
          isRTL
            ? `يمكنك اختيار حتى ${MAX_SELECTED_ACTIONS} إجراءات فقط كحد أقصى.`
            : `You can select a maximum of ${MAX_SELECTED_ACTIONS} actions for your home screen.`
        );
        return;
      }

      if (result.error?.startsWith('MIN_REACHED')) {
        setValidationMessage(
          isRTL
            ? `يرجى اختيار ما لا يقل عن ${MIN_SELECTED_ACTIONS} إجراءات.`
            : `Please keep at least ${MIN_SELECTED_ACTIONS} actions selected.`
        );
        return;
      }

      setTempSelected(result.updatedSelection);
    },
    [tempSelected, isRTL]
  );

  const handleSave = useCallback(() => {
    onSave(tempSelected);
    onClose();
  }, [onSave, tempSelected, onClose]);

  const handleResetToDefault = useCallback(() => {
    setTempSelected(DEFAULT_SELECTED_ACTIONS);
    setValidationMessage(null);
  }, []);

  const handleDirectNavigate = useCallback(
    (actionId: ActionModuleId) => {
      onClose();
      onOpenModule(actionId);
    },
    [onClose, onOpenModule]
  );

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
              {/* Header */}
              <View style={[styles.modalHeader, rtlRow(isRTL)]}>
                <View style={styles.headerTitleWrap}>
                  <Text
                    style={[
                      styles.modalTitle,
                      { color: colors.textPrimary },
                      rtlText(isRTL),
                    ]}
                  >
                    {isRTL ? 'ترتيب إجراءاتي' : 'Arrange My Actions'}
                  </Text>
                  <Text
                    style={[
                      styles.modalSubtitle,
                      { color: colors.textMuted },
                      rtlText(isRTL),
                    ]}
                  >
                    {isRTL
                      ? `اختر حتى ${MAX_SELECTED_ACTIONS} بطاقات لتثبيتها على شاشتك الرئيسية`
                      : `Select up to ${MAX_SELECTED_ACTIONS} cards to pin to your dashboard`}
                  </Text>
                </View>

                {/* Close Button */}
                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    styles.closeButton,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                    },
                  ]}
                  accessibilityLabel="Close arrange modal"
                >
                  <Feather name="x" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Counter Badge Row */}
              <View style={[styles.counterRow, rtlRow(isRTL)]}>
                <View
                  style={[
                    styles.counterPill,
                    {
                      backgroundColor: colors.primarySoft,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <Feather
                    name="check-circle"
                    size={13}
                    color={colors.primary}
                    style={{ marginRight: isRTL ? 0 : 5, marginLeft: isRTL ? 5 : 0 }}
                  />
                  <Text
                    style={[styles.counterText, { color: colors.primary }]}
                  >
                    {isRTL
                      ? `تم اختيار ${tempSelected.length} من ${MAX_SELECTED_ACTIONS}`
                      : `${tempSelected.length} / ${MAX_SELECTED_ACTIONS} Selected`}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleResetToDefault}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.resetLink, { color: colors.accent }]}
                  >
                    {isRTL ? 'استعادة الافتراضي' : 'Reset Default'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Validation Warning Alert (if any) */}
              {validationMessage ? (
                <View
                  style={[
                    styles.validationBox,
                    {
                      backgroundColor: colors.isDark
                        ? 'rgba(254, 88, 0, 0.15)'
                        : '#FFF3E8',
                      borderColor: colors.accent,
                    },
                  ]}
                >
                  <Feather
                    name="info"
                    size={14}
                    color={colors.accent}
                    style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }}
                  />
                  <Text
                    style={[
                      styles.validationText,
                      { color: colors.accent },
                      rtlText(isRTL),
                    ]}
                  >
                    {validationMessage}
                  </Text>
                </View>
              ) : null}

              {/* Actions List */}
              <ScrollView
                style={styles.actionsListScroll}
                contentContainerStyle={styles.actionsListContent}
                showsVerticalScrollIndicator={false}
              >
                {allActions.map((action) => {
                  const isSelected = tempSelected.includes(action.id);
                  return (
                    <View
                      key={action.id}
                      style={[
                        styles.actionRowCard,
                        rtlRow(isRTL),
                        {
                          backgroundColor: isSelected
                            ? colors.isDark
                              ? 'rgba(59, 110, 156, 0.22)'
                              : '#F0F6FC'
                            : colors.surfaceSubtle,
                          borderColor: isSelected
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                    >
                      {/* Checkbox Toggle Area */}
                      <TouchableOpacity
                        onPress={() => handleToggle(action.id)}
                        style={[styles.rowToggleArea, rtlRow(isRTL)]}
                        activeOpacity={0.75}
                        accessibilityLabel={`Toggle ${action.label} selection`}
                      >
                        <View
                          style={[
                            styles.checkboxCircle,
                            {
                              backgroundColor: isSelected
                                ? colors.primary
                                : 'transparent',
                              borderColor: isSelected
                                ? colors.primary
                                : colors.border,
                            },
                          ]}
                        >
                          {isSelected && (
                            <Feather
                              name="check"
                              size={12}
                              color={MACQUIRES_PALETTE.white}
                            />
                          )}
                        </View>

                        {/* Action Icon */}
                        <View
                          style={[
                            styles.actionIconBox,
                            { backgroundColor: `${action.tint}18` },
                          ]}
                        >
                          <Feather
                            name={
                              action.icon as React.ComponentProps<
                                typeof Feather
                              >['name']
                            }
                            size={18}
                            color={
                              colors.isDark ? colors.textOnPrimary : action.tint
                            }
                          />
                        </View>

                        {/* Action Label */}
                        <View style={styles.actionInfoWrap}>
                          <Text
                            style={[
                              styles.actionRowLabel,
                              { color: colors.textPrimary },
                              rtlText(isRTL),
                            ]}
                            numberOfLines={1}
                          >
                            {action.label}
                          </Text>
                          <Text
                            style={[
                              styles.actionStatusHint,
                              {
                                color: isSelected
                                  ? colors.primary
                                  : colors.textMuted,
                              },
                              rtlText(isRTL),
                            ]}
                          >
                            {isSelected
                              ? isRTL
                                ? 'مثبت على الرئيسية'
                                : 'Pinned to Home'
                              : isRTL
                              ? 'انقر للإضافة'
                              : 'Tap to add'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Direct Navigate CTA Button */}
                      <TouchableOpacity
                        onPress={() => handleDirectNavigate(action.id)}
                        style={[
                          styles.openModuleBtn,
                          rtlRow(isRTL),
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                        activeOpacity={0.8}
                        accessibilityLabel={`Open ${action.label}`}
                      >
                        <Text
                          style={[
                            styles.openModuleText,
                            { color: colors.accent },
                          ]}
                        >
                          {isRTL ? 'فتح' : 'Open'}
                        </Text>
                        <Feather
                          name={isRTL ? 'chevron-left' : 'chevron-right'}
                          size={13}
                          color={colors.accent}
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Footer Buttons */}
              <View style={[styles.footerRow, rtlRow(isRTL)]}>
                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    styles.cancelBtn,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.cancelBtnText, { color: colors.textMuted }]}
                  >
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSave}
                  style={[
                    styles.saveBtn,
                    {
                      backgroundColor: colors.primary,
                    },
                  ]}
                  activeOpacity={0.85}
                  accessibilityLabel="Save selected actions"
                >
                  <Feather
                    name="check"
                    size={16}
                    color={MACQUIRES_PALETTE.white}
                    style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }}
                  />
                  <Text style={styles.saveBtnText}>
                    {isRTL ? 'حفظ الترتيب' : 'Save Selection'}
                  </Text>
                </TouchableOpacity>
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
    maxWidth: 480,
    maxHeight: '88%',
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  counterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resetLink: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  validationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  validationText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  actionsListScroll: {
    maxHeight: 340,
  },
  actionsListContent: {
    paddingVertical: 4,
    gap: 8,
  },
  actionRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  rowToggleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInfoWrap: {
    flex: 1,
  },
  actionRowLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionStatusHint: {
    fontSize: 11,
    fontWeight: '500',
  },
  openModuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  openModuleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  saveBtnText: {
    color: MACQUIRES_PALETTE.white,
    fontSize: 13,
    fontWeight: '800',
  },
});

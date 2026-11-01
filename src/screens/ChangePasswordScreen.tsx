import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AuthSession, validatePasswordChange } from '../services/authService';
import { changePassword, BackendApiError } from '../services/backendApi';
import { isTokenExpiringSoon, refreshStoredSession } from '../services/sessionManager';
import { saveAuthSession } from '../services/authStorage';
import { MACQUIRES_PALETTE, ThemeColors } from '../theme/colors';
import { AppLanguage, rtlRow, rtlText, TYPOGRAPHY } from '../theme/typography';

interface ChangePasswordScreenProps {
  colors: ThemeColors;
  lang: AppLanguage;
  session: AuthSession;
  onChanged: (session: AuthSession) => void;
  onSignOut: () => void;
}

export const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({
  colors,
  lang,
  session,
  onChanged,
  onSignOut,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRTL = lang === 'ar';

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const validationError = validatePasswordChange(currentPassword, newPassword);
    if (validationError) {
      setErrorMessage(
        validationError === 'PASSWORD_TOO_SHORT'
          ? isRTL
            ? 'يجب أن تكون كلمة المرور الجديدة 8 أحرف على الأقل.'
            : 'Your new password must be at least 8 characters.'
          : isRTL
            ? 'اختر كلمة مرور جديدة مختلفة عن كلمة المرور الحالية.'
            : 'Choose a new password that is different from your current one.',
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      let activeSession = session;
      if (isTokenExpiringSoon(session.token)) {
        const refreshed = await refreshStoredSession();
        if (refreshed) activeSession = refreshed;
      }
      const result = await changePassword(
        currentPassword,
        newPassword,
        activeSession.token,
      );
      const next: AuthSession = {
        ...activeSession,
        token: result.accessToken,
        refreshToken: result.refreshToken,
        mustChangePassword: false,
        authenticatedAt: Date.now(),
      };
      await saveAuthSession(next);
      onChanged(next);
    } catch (error) {
      const isExpiredSession =
        error instanceof BackendApiError && error.message.trim() === 'Unauthorized';
      setErrorMessage(
        isExpiredSession
          ? isRTL
            ? 'انتهت صلاحية جلستك. سجّل الخروج ثم سجّل الدخول من جديد.'
            : 'Your session has expired. Sign out and sign in again.'
          : error instanceof BackendApiError
            ? error.message
            : isRTL
              ? 'تعذر تغيير كلمة المرور. حاول مرة أخرى.'
              : 'Unable to change your password. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPasswordField = (
    label: string,
    value: string,
    onChangeText: (next: string) => void,
    visible: boolean,
    onToggleVisible: () => void,
    placeholder: string,
  ) => (
    <>
      <Text
        style={[styles.inputLabel, { color: colors.textPrimary }, rtlText(isRTL)]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.inputRowContainer,
          rtlRow(isRTL),
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Feather
          name="lock"
          size={18}
          color={colors.textMuted}
          style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}
        />
        <TextInput
          style={[styles.textInput, { color: colors.textPrimary }, rtlText(isRTL)]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          onPress={onToggleVisible}
          style={styles.eyeBtn}
          accessibilityLabel={
            isRTL ? 'إظهار كلمة المرور أو إخفاؤها' : 'Toggle password visibility'
          }
        >
          <Feather
            name={visible ? 'eye-off' : 'eye'}
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: colors.accentSoft, borderColor: colors.border },
            ]}
          >
            <Feather name="shield" size={24} color={colors.accent} />
          </View>
          <Text
            style={[styles.title, { color: colors.textPrimary }, rtlText(isRTL)]}
          >
            {isRTL ? 'تحديث كلمة المرور مطلوب' : 'Update your password'}
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.textMuted }, rtlText(isRTL)]}
          >
            {isRTL
              ? 'تم تسجيل دخولك بكلمة مرور مؤقتة. اختر كلمة مرور جديدة للمتابعة.'
              : 'You signed in with a temporary password. Choose a new password to continue.'}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {errorMessage && (
            <View
              style={[
                styles.errorBanner,
                rtlRow(isRTL),
                { backgroundColor: colors.dangerBg, borderColor: colors.dangerText },
              ]}
            >
              <Feather name="alert-circle" size={15} color={colors.dangerText} />
              <Text
                style={[
                  styles.errorBannerText,
                  { color: colors.dangerText },
                  rtlText(isRTL),
                ]}
              >
                {errorMessage}
              </Text>
            </View>
          )}

          {renderPasswordField(
            isRTL ? 'كلمة المرور الحالية / المؤقتة' : 'Current / temporary password',
            currentPassword,
            setCurrentPassword,
            showCurrent,
            () => setShowCurrent((prev) => !prev),
            '••••••••',
          )}

          {renderPasswordField(
            isRTL ? 'كلمة المرور الجديدة' : 'New password',
            newPassword,
            setNewPassword,
            showNew,
            () => setShowNew((prev) => !prev),
            isRTL ? '8 أحرف على الأقل' : 'At least 8 characters',
          )}

          <Text
            style={[styles.hint, { color: colors.textMuted }, rtlText(isRTL)]}
          >
            {isRTL
              ? 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل ومختلفة عن الحالية.'
              : 'Use at least 8 characters and a password different from your current one.'}
          </Text>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              rtlRow(isRTL),
              {
                backgroundColor: isSubmitting
                  ? MACQUIRES_PALETTE.spanishGrey
                  : colors.primary,
              },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
            accessibilityLabel={
              isRTL ? 'حفظ كلمة المرور الجديدة' : 'Save new password'
            }
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>
                  {isRTL ? 'حفظ كلمة المرور' : 'Save new password'}
                </Text>
                <Feather
                  name={isRTL ? 'arrow-left' : 'arrow-right'}
                  size={17}
                  color="#FFFFFF"
                />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={onSignOut}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'تسجيل الخروج' : 'Sign out'}
          >
            <Text style={[styles.signOutText, { color: colors.textMuted }]}>
              {isRTL ? 'تسجيل الخروج' : 'Sign out'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.footerRow, rtlRow(isRTL)]}>
          <Feather name="lock" size={12} color={colors.textMuted} />
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            {isRTL
              ? 'MacqHR • محمي بتشفير جلسات Macquires'
              : 'MacqHR • Secured by Macquires session encryption'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 32,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    ...TYPOGRAPHY.h1,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 6,
  },
  inputRowContainer: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
  },
  eyeBtn: {
    padding: 6,
  },
  hint: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
    marginBottom: 14,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  signOutBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});

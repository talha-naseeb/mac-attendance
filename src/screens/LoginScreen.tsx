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
import { MacqLogo } from '../components/MacqLogo';
import {
  AuthCredentials,
  AuthSession,
  validateAndAuthenticate,
  authenticateWithMicrosoftSso,
} from '../services/authService';
import { MACQUIRES_PALETTE, ThemeColors } from '../theme/colors';
import { AppLanguage, rtlRow, rtlText, TYPOGRAPHY } from '../theme/typography';

interface LoginScreenProps {
  colors: ThemeColors;
  lang: AppLanguage;
  onLoginSuccess: (session: AuthSession) => void;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  colors,
  lang,
  onLoginSuccess,
  onToggleLanguage,
  onToggleTheme,
}) => {
  const [email, setEmail] = useState('rahaf.mansoor@macquires.sa');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRTL = lang === 'ar';

  const handleSignIn = () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = validateAndAuthenticate({
      email,
      password,
    });

    setTimeout(() => {
      setIsSubmitting(false);
      if (!res.valid || !res.session) {
        if (res.error === 'EMPTY_EMAIL') {
          setErrorMessage(
            isRTL
              ? 'الرجاء إدخال البريد الإلكتروني للعمل'
              : 'Please enter your work email.'
          );
        } else if (res.error === 'INVALID_EMAIL') {
          setErrorMessage(
            isRTL
              ? 'صيغة البريد الإلكتروني غير صحيحة'
              : 'Please enter a valid work email address.'
          );
        } else if (res.error === 'SHORT_PASSWORD') {
          setErrorMessage(
            isRTL
              ? 'كلمة المرور يجب أن لا تقل عن 6 خانات'
              : 'Password must be at least 6 characters.'
          );
        } else {
          setErrorMessage(
            isRTL
              ? 'بيانات الاعتماد غير صالحة'
              : 'Invalid credentials. Please try again.'
          );
        }
        return;
      }

      onLoginSuccess(res.session);
    }, 450);
  };

  const handleMicrosoftSso = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const session = authenticateWithMicrosoftSso();
      onLoginSuccess(session);
    }, 550);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Header Utilities: Language Switcher & Dark Mode */}
        <View style={[styles.topBar, rtlRow(isRTL)]}>
          <TouchableOpacity
            style={[
              styles.utilPill,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={onToggleLanguage}
            accessibilityLabel="Switch Language"
          >
            <Feather name="globe" size={13} color={colors.accent} />
            <Text style={[styles.utilPillText, { color: colors.textPrimary }]}>
              {lang === 'en' ? 'عربي' : 'EN'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.utilPill,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={onToggleTheme}
            accessibilityLabel="Toggle Theme"
          >
            <Feather
              name={colors.isDark ? 'sun' : 'moon'}
              size={13}
              color={colors.accent}
            />
            <Text style={[styles.utilPillText, { color: colors.textPrimary }]}>
              {colors.isDark ? 'Light' : 'Dark'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Central Brand Presentation: Concept A Logo */}
        <View style={styles.brandHero}>
          <MacqLogo
            colors={colors}
            size="lg"
            showWordmark={true}
            showSubtitle={true}
          />
          <Text
            style={[
              styles.welcomeTitle,
              { color: colors.textPrimary },
              rtlText(isRTL),
            ]}
          >
            {isRTL ? 'مرحباً بك مجدداً' : 'Welcome to MacqHR'}
          </Text>
          <Text
            style={[
              styles.welcomeSubtitle,
              { color: colors.textMuted },
              rtlText(isRTL),
            ]}
          >
            {isRTL
              ? 'سجّل الدخول إلى منصة إدارة الموارد البشرية الذكية'
              : 'Sign in to access your corporate workspace & attendance'}
          </Text>
        </View>

        {/* Card Form */}
        <View
          style={[
            styles.cardContainer,
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
              <Text style={[styles.errorBannerText, { color: colors.dangerText }]}>
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Work Email Field */}
          <Text
            style={[
              styles.inputLabel,
              { color: colors.textPrimary },
              rtlText(isRTL),
            ]}
          >
            {isRTL ? 'البريد الإلكتروني للعمل' : 'Work Email'}
          </Text>
          <View
            style={[
              styles.inputRowContainer,
              rtlRow(isRTL),
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <Feather
              name="mail"
              size={18}
              color={colors.textMuted}
              style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}
            />
            <TextInput
              style={[
                styles.textInput,
                { color: colors.textPrimary },
                rtlText(isRTL),
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="name@macquires.sa"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password Field */}
          <View style={[styles.labelRow, rtlRow(isRTL)]}>
            <Text
              style={[
                styles.inputLabel,
                { color: colors.textPrimary },
                rtlText(isRTL),
              ]}
            >
              {isRTL ? 'كلمة المرور' : 'Password'}
            </Text>
            <TouchableOpacity onPress={() => {}}>
              <Text
                style={[styles.forgotPasswordText, { color: colors.accent }]}
              >
                {isRTL ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.inputRowContainer,
              rtlRow(isRTL),
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <Feather
              name="lock"
              size={18}
              color={colors.textMuted}
              style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}
            />
            <TextInput
              style={[
                styles.textInput,
                { color: colors.textPrimary },
                rtlText(isRTL),
              ]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword((prev) => !prev)}
              style={styles.eyeBtn}
              accessibilityLabel="Toggle password visibility"
            >
              <Feather
                name={showPassword ? 'eye-off' : 'eye'}
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Primary Sign In Button */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              {
                backgroundColor: isSubmitting
                  ? MACQUIRES_PALETTE.spanishGrey
                  : colors.primary,
              },
            ]}
            onPress={handleSignIn}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={[styles.btnRow, rtlRow(isRTL)]}>
                <Text style={styles.primaryBtnText}>
                  {isRTL ? 'تسجيل الدخول' : 'Sign In'}
                </Text>
                <Feather
                  name={isRTL ? 'arrow-left' : 'arrow-right'}
                  size={17}
                  color="#FFFFFF"
                />
              </View>
            )}
          </TouchableOpacity>

          {/* Or Divider */}
          <View style={styles.dividerRow}>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.border }]}
            />
            <Text
              style={[
                styles.dividerText,
                { color: colors.textMuted, backgroundColor: colors.surface },
              ]}
            >
              {isRTL ? 'أو عبر الهوية الموحدة' : 'or continue with'}
            </Text>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.border }]}
            />
          </View>

          {/* Microsoft 365 Entra ID SSO Button */}
          <TouchableOpacity
            style={[
              styles.msSsoBtn,
              rtlRow(isRTL),
              {
                backgroundColor: colors.isDark ? '#001D38' : '#F8FAFC',
                borderColor: colors.border,
              },
            ]}
            onPress={handleMicrosoftSso}
            activeOpacity={0.85}
          >
            {/* Microsoft 4-square icon representation */}
            <View style={styles.msLogoSquare}>
              <View style={[styles.msSubSquare, { backgroundColor: '#F25022' }]} />
              <View style={[styles.msSubSquare, { backgroundColor: '#7FBA00' }]} />
              <View style={[styles.msSubSquare, { backgroundColor: '#00A4EF' }]} />
              <View style={[styles.msSubSquare, { backgroundColor: '#FFB900' }]} />
            </View>
            <Text
              style={[styles.msSsoBtnText, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {isRTL
                ? 'تسجيل الدخول بواسطة Microsoft 365'
                : 'Sign in with Microsoft 365'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <View style={styles.footerWrap}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            MacqHR® • Macquires Corporate Attendance & HRMS
          </Text>
          <Text style={[styles.footerSubText, { color: colors.textMuted }]}>
            Secured by Microsoft Entra ID & 6-Layer Anti-Spoofing
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
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  utilPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  utilPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  brandHero: {
    alignItems: 'center',
    marginBottom: 22,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 4,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  rolePickerSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  roleTabsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  roleTabBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTabText: {
    fontSize: 12,
    marginBottom: 2,
  },
  roleSubText: {
    fontSize: 10,
    fontWeight: '500',
  },
  cardContainer: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
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
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  forgotPasswordText: {
    fontSize: 12,
    fontWeight: '700',
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
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  dividerRow: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 11,
    fontWeight: '600',
  },
  msSsoBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  msLogoSquare: {
    width: 17,
    height: 17,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1.5,
  },
  msSubSquare: {
    width: 7.5,
    height: 7.5,
  },
  msSsoBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footerWrap: {
    alignItems: 'center',
    gap: 3,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerSubText: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
});

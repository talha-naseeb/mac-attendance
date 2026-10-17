import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { MacqLogo } from './MacqLogo';
import {
  EditableEmployeeProfile,
  getAvatarPresetById,
} from '../services/profileSettingsService';
import { TRANSLATIONS } from '../i18n/translations';
import { MACQUIRES_PALETTE, ThemeColors } from '../theme/colors';
import { AppLanguage, rtlRow, rtlText } from '../theme/typography';

export interface ExecutiveSidebarDrawerProps {
  visible: boolean;
  colors: ThemeColors;
  lang: AppLanguage;
  profile: EditableEmployeeProfile;
  onClose: () => void;
  onOpenProfileScreen: () => void;
  onOpenSettingsScreen: () => void;
  onToggleTheme: () => void;
  onToggleLanguage: () => void;
  onToggleBiometricLock: () => void;
  onOpenQuickRequest: () => void;
}

const DRAWER_WIDTH = 312;

export const ExecutiveSidebarDrawer: React.FC<ExecutiveSidebarDrawerProps> = ({
  visible,
  colors,
  lang,
  profile,
  onClose,
  onOpenProfileScreen,
  onOpenSettingsScreen,
  onToggleTheme,
  onToggleLanguage,
  onToggleBiometricLock,
  onOpenQuickRequest,
}) => {
  const isRTL = lang === 'ar';
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;

  // Smooth horizontal slide animation
  const slideAnim = useRef(
    new Animated.Value(isRTL ? DRAWER_WIDTH : -DRAWER_WIDTH)
  ).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(isRTL ? DRAWER_WIDTH : -DRAWER_WIDTH);
      fadeAnim.setValue(0);

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, isRTL, slideAnim, fadeAnim]);

  const handleAnimatedClose = (afterClose?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isRTL ? DRAWER_WIDTH : -DRAWER_WIDTH,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      if (afterClose) afterClose();
    });
  };

  const activePreset = getAvatarPresetById(profile.avatarPresetId);

  // Uses our existing Light / Dark theme tokens (Clean White in Light mode, Oxford Dark in Dark mode)
  const drawerBackground = colors.isDark
    ? MACQUIRES_PALETTE.oxfordBlue
    : colors.surface;
  const signOutPillBg = colors.isDark
    ? MACQUIRES_PALETTE.prussianBlue
    : colors.background;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => handleAnimatedClose()}
    >
      <View
        style={[
          styles.overlayContainer,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        {/* Dimmed Backdrop */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.backdropOverlay,
            { opacity: fadeAnim },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => handleAnimatedClose()}
          />
        </Animated.View>

        {/* Minimalist Slide-Over Sidebar Sheet */}
        <Animated.View
          style={[
            styles.sidebarSheet,
            {
              width: DRAWER_WIDTH,
              backgroundColor: drawerBackground,
              borderRightWidth: isRTL ? 0 : 1,
              borderLeftWidth: isRTL ? 1 : 0,
              borderColor: colors.border,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <SafeAreaView
            style={styles.safeAreaInner}
            edges={['top', 'bottom', 'left', 'right']}
          >
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Brand Top Header: MacqLogo + MACQUIRES PEOPLE */}
              <View style={[styles.brandTopRow, rtlRow(isRTL)]}>
                <MacqLogo
                  colors={colors}
                  size="sm"
                  showWordmark={true}
                  showSubtitle={true}
                />
              </View>

              {/* Top Profile Summary (Clicking opens separate Profile Screen) */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() =>
                  handleAnimatedClose(() => onOpenProfileScreen())
                }
                style={[
                  styles.profileHeaderSection,
                  { alignItems: isRTL ? 'flex-end' : 'flex-start' },
                ]}
              >
                <View
                  style={[
                    styles.largeAvatarCircle,
                    {
                      backgroundColor: activePreset.backgroundColor,
                      borderColor: activePreset.ringColor,
                    },
                  ]}
                >
                  <Text style={styles.largeAvatarInitials}>
                    {profile.avatarInitials}
                  </Text>
                  <View
                    style={[
                      styles.avatarEditDot,
                      { borderColor: drawerBackground },
                    ]}
                  >
                    <Feather
                      name="edit-2"
                      size={10}
                      color={MACQUIRES_PALETTE.white}
                    />
                  </View>
                </View>

                <Text
                  style={[
                    styles.userNameHeadline,
                    { color: colors.textPrimary },
                    rtlText(isRTL),
                  ]}
                  numberOfLines={1}
                >
                  {isRTL ? profile.fullNameAr : profile.fullName}
                </Text>

                <Text
                  style={[
                    styles.userSubHeadline,
                    { color: colors.textMuted },
                    rtlText(isRTL),
                  ]}
                  numberOfLines={1}
                >
                  {profile.email} • {profile.phone}
                </Text>
              </TouchableOpacity>

              {/* Thin Horizontal Divider Line */}
              <View
                style={[styles.thinDivider, { backgroundColor: colors.border }]}
              />

              {/* Clean Borderless Icon + Label Menu List */}
              <View style={styles.menuList}>
                {/* 1. Profile -> Opens Separate Profile Screen */}
                <TouchableOpacity
                  style={[styles.cleanMenuItem, rtlRow(isRTL)]}
                  onPress={() =>
                    handleAnimatedClose(() => onOpenProfileScreen())
                  }
                >
                  <Feather
                    name="user"
                    size={20}
                    color={colors.primaryBright}
                  />
                  <Text
                    style={[
                      styles.cleanMenuLabel,
                      { color: colors.textPrimary },
                      rtlText(isRTL),
                    ]}
                  >
                    {isRTL ? 'الملف الشخصي' : 'Profile'}
                  </Text>
                </TouchableOpacity>

                {/* 2. Setting -> Opens Separate Settings Screen */}
                <TouchableOpacity
                  style={[styles.cleanMenuItem, rtlRow(isRTL)]}
                  onPress={() =>
                    handleAnimatedClose(() => onOpenSettingsScreen())
                  }
                >
                  <Feather
                    name="settings"
                    size={20}
                    color={colors.primaryBright}
                  />
                  <Text
                    style={[
                      styles.cleanMenuLabel,
                      { color: colors.textPrimary },
                      rtlText(isRTL),
                    ]}
                  >
                    {isRTL ? 'الإعدادات' : 'Setting'}
                  </Text>
                </TouchableOpacity>

                {/* 3. Dark Mode */}
                <TouchableOpacity
                  style={[styles.cleanMenuItem, rtlRow(isRTL)]}
                  onPress={onToggleTheme}
                >
                  <Feather
                    name={colors.isDark ? 'sun' : 'moon'}
                    size={20}
                    color={colors.primaryBright}
                  />
                  <Text
                    style={[
                      styles.cleanMenuLabel,
                      { color: colors.textPrimary },
                      rtlText(isRTL),
                    ]}
                  >
                    {isRTL ? 'الوضع الداكن' : 'Dark Mode'}
                  </Text>
                  <View
                    style={[
                      styles.rightAccentPill,
                      {
                        backgroundColor: colors.isDark
                          ? MACQUIRES_PALETTE.orangePantone
                          : colors.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rightAccentPillText,
                        {
                          color: colors.isDark
                            ? MACQUIRES_PALETTE.white
                            : colors.textPrimary,
                        },
                      ]}
                    >
                      {colors.isDark ? 'On' : 'Off'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 4. Language */}
                <TouchableOpacity
                  style={[styles.cleanMenuItem, rtlRow(isRTL)]}
                  onPress={onToggleLanguage}
                >
                  <Feather
                    name="globe"
                    size={20}
                    color={colors.primaryBright}
                  />
                  <Text
                    style={[
                      styles.cleanMenuLabel,
                      { color: colors.textPrimary },
                      rtlText(isRTL),
                    ]}
                  >
                    {isRTL ? 'اللغة' : 'Language'}
                  </Text>
                  <View
                    style={[
                      styles.rightAccentPill,
                      { backgroundColor: MACQUIRES_PALETTE.orangePantone },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rightAccentPillText,
                        { color: MACQUIRES_PALETTE.white },
                      ]}
                    >
                      {lang === 'en' ? 'عربي' : 'EN'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 5. Touch / Face ID */}
                <TouchableOpacity
                  style={[styles.cleanMenuItem, rtlRow(isRTL)]}
                  onPress={() =>
                    handleAnimatedClose(() => onToggleBiometricLock())
                  }
                >
                  <Ionicons
                    name="finger-print-outline"
                    size={21}
                    color={colors.primaryBright}
                  />
                  <Text
                    style={[
                      styles.cleanMenuLabel,
                      { color: colors.textPrimary },
                      rtlText(isRTL),
                    ]}
                  >
                    {isRTL ? 'قفل الهوية / بصمة الوجه' : 'Touch / Face ID'}
                  </Text>
                </TouchableOpacity>

                {/* 6. Request Time Off */}
                <TouchableOpacity
                  style={[styles.cleanMenuItem, rtlRow(isRTL)]}
                  onPress={() =>
                    handleAnimatedClose(() => onOpenQuickRequest())
                  }
                >
                  <Feather
                    name="calendar"
                    size={20}
                    color={colors.primaryBright}
                  />
                  <Text
                    style={[
                      styles.cleanMenuLabel,
                      { color: colors.textPrimary },
                      rtlText(isRTL),
                    ]}
                  >
                    {t.requestTimeOff}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Bottom Logout Rounded Pill Button */}
            <View style={styles.bottomFooterWrap}>
              <TouchableOpacity
                style={[
                  styles.signOutPillBtn,
                  {
                    backgroundColor: signOutPillBg,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() =>
                  handleAnimatedClose(() => onToggleBiometricLock())
                }
                accessibilityLabel="Logout"
              >
                <Text
                  style={[
                    styles.signOutPillText,
                    { color: colors.textPrimary },
                  ]}
                >
                  {isRTL ? 'تسجيل الخروج' : 'Logout'}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
  },
  backdropOverlay: {
    backgroundColor: 'rgba(0, 22, 41, 0.45)',
  },
  sidebarSheet: {
    height: '100%',
    shadowColor: MACQUIRES_PALETTE.oxfordBlue,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 6, height: 0 },
    elevation: 18,
  },
  safeAreaInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 26,
    paddingTop: 18,
    paddingBottom: 24,
  },
  brandTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  profileHeaderSection: {
    marginBottom: 18,
  },
  largeAvatarCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  largeAvatarInitials: {
    color: MACQUIRES_PALETTE.white,
    fontSize: 26,
    fontWeight: '800',
  },
  avatarEditDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: MACQUIRES_PALETTE.orangePantone,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userNameHeadline: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  userSubHeadline: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 5,
  },
  thinDivider: {
    height: 1,
    width: '100%',
    marginBottom: 18,
  },
  menuList: {
    gap: 6,
  },
  cleanMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  cleanMenuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    marginHorizontal: 15,
  },
  rightAccentPill: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightAccentPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  bottomFooterWrap: {
    paddingHorizontal: 24,
    paddingBottom: 18,
    paddingTop: 8,
  },
  signOutPillBtn: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

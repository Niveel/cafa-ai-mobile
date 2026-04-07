import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useAppContext } from '@/context';
import { useI18n } from '@/hooks';
import { AppSwitch } from './AppSwitch';
import type { AnimationLevel } from '@/services';
import { PersonalizationSection } from './settings/PersonalizationSection';
import { DataControlsSection } from './settings/DataControlsSection';
import { SecuritySection } from './settings/SecuritySection';
import { AccountSection } from './settings/AccountSection';

const SETTINGS_TABS = [
  { key: 'general', i18nKey: 'settings.tab.general' },
  { key: 'personalization', i18nKey: 'settings.tab.personalization' },
  { key: 'data-controls', i18nKey: 'settings.tab.data' },
  { key: 'security', i18nKey: 'settings.tab.security' },
  { key: 'account', i18nKey: 'settings.tab.account' },
] as const;

type SettingsTabKey = (typeof SETTINGS_TABS)[number]['key'];

type SettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { colors, isDark, isAuthenticated, authUser, refreshAuthUser, signOut, setThemeMode, themeMode, hapticsEnabled, setHapticsEnabled, animationLevel, setAnimationLevel } = useAppContext();
  const { language, setLanguage, supportedLanguages, getLanguageLabel, t } = useI18n();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('general');
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const overlayOpacity = useSharedValue(0);
  const sheetTranslate = useSharedValue(26);

  useEffect(() => {
    if (!visible) return;
    overlayOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    sheetTranslate.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.exp) });
  }, [overlayOpacity, sheetTranslate, visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslate.value }],
  }));

  const activeTabLabel = useMemo(
    () => t(SETTINGS_TABS.find((tab) => tab.key === activeTab)?.i18nKey ?? 'settings.tab.general'),
    [activeTab, t],
  );

  const placeholderText = t('settings.placeholder', { tab: activeTabLabel });

  const animationOptions: { value: AnimationLevel; label: string }[] = [
    { value: 'full', label: t('settings.general.animation.full') },
    { value: 'reduced', label: t('settings.general.animation.reduced') },
    { value: 'off', label: t('settings.general.animation.off') },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View
        className="flex-1 justify-end"
        style={{
          backgroundColor: isDark ? 'rgba(4, 6, 12, 0.72)' : 'rgba(241, 244, 255, 0.72)',
        }}
      >
        <Animated.View style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, overlayStyle]}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: isDark ? 'rgba(4, 6, 12, 0.38)' : 'rgba(246, 248, 255, 0.42)',
            }}
          />
          <BlurView
            intensity={isDark ? 75 : 82}
            tint={isDark ? 'dark' : 'light'}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
        </Animated.View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.close')}
          accessibilityHint={t('settings.closeHint')}
          onPress={onClose}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />

        <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 10}>
          <Animated.View
            accessibilityViewIsModal
            className="rounded-t-3xl"
            style={[
              sheetStyle,
              {
                minHeight: '84%',
                maxHeight: '92%',
                backgroundColor: isDark ? '#0E0E12' : '#FFFFFF',
                borderTopWidth: 1.5,
                borderColor: colors.primary,
                paddingTop: Math.max(10, insets.top * 0.25),
                paddingHorizontal: 10,
                paddingBottom: Math.max(insets.bottom + 8, 16),
              },
            ]}
          >
            <View className="mb-3 flex-row items-center justify-between">
            <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>
              {t('settings.title')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.close')}
              accessibilityHint={t('settings.closeHint')}
              hitSlop={10}
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{
                borderWidth: 1,
                borderColor: colors.primary,
                backgroundColor: isDark ? 'rgba(124,58,237,0.14)' : 'rgba(124,58,237,0.08)',
              }}
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View
            accessibilityRole="tablist"
            accessibilityLabel={t('settings.sections')}
            className="mb-2 rounded-2xl p-1.5"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(124,58,237,0.04)',
            }}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 2 }}>
              {SETTINGS_TABS.map((tab) => {
                const selected = tab.key === activeTab;
                const tabLabel = t(tab.i18nKey);
                return (
                  <Pressable
                    key={tab.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={tabLabel}
                    accessibilityHint={selected ? t('settings.tabSelected', { tab: tabLabel }) : t('settings.tabOpen', { tab: tabLabel })}
                    onPress={() => {
                      setLanguageMenuOpen(false);
                      setActiveTab(tab.key);
                    }}
                    className="mr-1.5 rounded-xl px-3 py-2"
                    style={{
                      borderWidth: selected ? 1.2 : 1,
                      borderColor: selected ? colors.primary : 'transparent',
                      backgroundColor: selected
                        ? isDark
                          ? 'rgba(124,58,237,0.2)'
                          : 'rgba(124,58,237,0.12)'
                        : 'transparent',
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: selected ? '700' : '600' }}>{tabLabel}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

            <ScrollView
            className="flex-1 rounded-2xl"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 18,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.66)',
              overflow: 'hidden',
            }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingVertical: 16,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            accessible
            accessibilityLabel={`${activeTabLabel} section content.`}
          >
            {activeTab === 'general' ? (
              <Animated.View entering={FadeInDown.duration(220)} className="gap-4">
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>{t('settings.general.title')}</Text>

                <View className="gap-3">
                  <View>
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{t('settings.general.language')}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{t('settings.general.languageHint')}</Text>
                    <View className="relative mt-2">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('settings.language.menu')}
                        accessibilityHint={t('settings.general.languageHint')}
                        onPress={() => setLanguageMenuOpen((prev) => !prev)}
                        className="h-10 flex-row items-center justify-between rounded-xl border px-3"
                        style={{ borderColor: colors.primary, backgroundColor: isDark ? '#101015' : '#FFFFFF' }}
                      >
                        <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{getLanguageLabel(language)}</Text>
                        <Ionicons
                          name={languageMenuOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
                          size={16}
                          color={colors.textSecondary}
                        />
                      </Pressable>

                      {languageMenuOpen ? (
                        <View
                          className="absolute left-0 right-0 top-11 z-50 rounded-xl border p-1"
                          style={{ borderColor: colors.border, backgroundColor: isDark ? '#101015' : '#FFFFFF' }}
                        >
                          {supportedLanguages.map((value) => {
                            const selected = value === language;
                            const label = getLanguageLabel(value);
                            return (
                              <Pressable
                                key={value}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                accessibilityLabel={t('settings.language.option', { language: label })}
                                onPress={() => {
                                  setLanguage(value);
                                  setLanguageMenuOpen(false);
                                }}
                                className="rounded-lg px-3 py-2"
                                style={{
                                  backgroundColor: selected ? `${colors.primary}20` : 'transparent',
                                }}
                              >
                                <Text style={{ color: selected ? colors.primary : colors.textPrimary, fontSize: 13, fontWeight: selected ? '700' : '500' }}>
                                  {label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between rounded-xl border px-3 py-2.5" style={{ borderColor: colors.border }}>
                    <View className="mr-3 flex-1">
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{t('settings.general.theme')}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{t('settings.general.themeHint')}</Text>
                    </View>
                    <AppSwitch value={themeMode === 'dark'} onValueChange={(enabled) => setThemeMode(enabled ? 'dark' : 'light')} />
                  </View>

                  <View className="flex-row items-center justify-between rounded-xl border px-3 py-2.5" style={{ borderColor: colors.border }}>
                    <View className="mr-3 flex-1">
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{t('settings.general.haptics')}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{t('settings.general.hapticsHint')}</Text>
                    </View>
                    <AppSwitch value={hapticsEnabled} onValueChange={setHapticsEnabled} />
                  </View>

                  <View className="rounded-xl border px-3 py-2.5" style={{ borderColor: colors.border }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{t('settings.general.animation')}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{t('settings.general.animationHint')}</Text>
                    <View className="mt-3 flex-row gap-2">
                      {animationOptions.map((option) => {
                        const selected = option.value === animationLevel;
                        return (
                          <Pressable
                            key={option.value}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={option.label}
                            onPress={() => setAnimationLevel(option.value)}
                            className="rounded-full border px-3 py-1.5"
                            style={{
                              borderColor: selected ? colors.primary : colors.border,
                              backgroundColor: selected ? `${colors.primary}1A` : 'transparent',
                            }}
                          >
                            <Text style={{ color: selected ? colors.primary : colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </Animated.View>
            ) : activeTab === 'personalization' ? (
              <Animated.View entering={FadeInDown.duration(220)}>
                <PersonalizationSection
                  visible={visible}
                  isAuthenticated={isAuthenticated}
                  isDark={isDark}
                  colors={colors}
                  t={t}
                />
              </Animated.View>
            ) : activeTab === 'data-controls' ? (
              <Animated.View entering={FadeInDown.duration(220)}>
                <DataControlsSection
                  visible={visible}
                  isAuthenticated={isAuthenticated}
                  isDark={isDark}
                  colors={colors}
                  t={t}
                />
              </Animated.View>
            ) : activeTab === 'security' ? (
              <Animated.View entering={FadeInDown.duration(220)}>
                <SecuritySection
                  isDark={isDark}
                  colors={colors}
                  signOut={signOut}
                  t={t}
                />
              </Animated.View>
            ) : activeTab === 'account' ? (
              <Animated.View entering={FadeInDown.duration(220)}>
                <AccountSection
                  isDark={isDark}
                  colors={colors}
                  t={t}
                  authUser={authUser}
                  refreshAuthUser={refreshAuthUser}
                  signOut={signOut}
                />
              </Animated.View>
            ) : (
              <Animated.View key={activeTab} entering={FadeInDown.duration(220)} className="flex-1 items-center justify-center px-5">
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
                  {activeTabLabel}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 14,
                    textAlign: 'center',
                    marginTop: 8,
                    lineHeight: 20,
                  }}
                  accessibilityLiveRegion="polite"
                >
                  {placeholderText}
                </Text>
              </Animated.View>
            )}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

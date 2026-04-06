import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks';

const SETTINGS_TABS = [
  { key: 'general', label: 'General' },
  { key: 'personalization', label: 'Personalization' },
  { key: 'data-controls', label: 'Data Controls' },
  { key: 'security', label: 'Security' },
  { key: 'account', label: 'Account' },
] as const;

type SettingsTabKey = (typeof SETTINGS_TABS)[number]['key'];

type SettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

const TAB_PLACEHOLDERS: Record<SettingsTabKey, string> = {
  general: 'General settings content will appear here.',
  personalization: 'Personalization settings content will appear here.',
  'data-controls': 'Data controls settings content will appear here.',
  security: 'Security settings content will appear here.',
  account: 'Account settings content will appear here.',
};

export function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('general');
  const activeTabLabel = SETTINGS_TABS.find((tab) => tab.key === activeTab)?.label ?? 'General';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <BlurView
          intensity={isDark ? 40 : 55}
          tint={isDark ? 'dark' : 'light'}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close settings modal"
          accessibilityHint="Closes settings and returns to chat."
          onPress={onClose}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />

        <View
          accessibilityViewIsModal
          className="rounded-t-3xl"
          style={{
            minHeight: '84%',
            maxHeight: '92%',
            backgroundColor: isDark ? '#0E0E12' : '#FFFFFF',
            borderTopWidth: 1.5,
            borderColor: colors.primary,
            paddingTop: Math.max(10, insets.top * 0.25),
            paddingHorizontal: 10,
            paddingBottom: Math.max(insets.bottom + 8, 16),
          }}
        >
          <View className="mb-2 items-center">
            <View
              className="h-1.5 w-12 rounded-full"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)' }}
            />
          </View>

          <View className="mb-3 flex-row items-center justify-between">
            <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>
              Settings
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close settings"
              accessibilityHint="Closes settings and returns to chat."
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
            accessibilityLabel="Settings sections"
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
                return (
                  <Pressable
                    key={tab.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={tab.label}
                    accessibilityHint={
                      selected ? `${tab.label} section selected.` : `Open ${tab.label} settings section.`
                    }
                    onPress={() => setActiveTab(tab.key)}
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
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 12,
                        fontWeight: selected ? '700' : '600',
                      }}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View
            className="flex-1 rounded-2xl"
            accessible
            accessibilityLabel={`${activeTabLabel} section content.`}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.66)',
            }}
          >
            <View className="flex-1 items-center justify-center px-5">
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
                {TAB_PLACEHOLDERS[activeTab]}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

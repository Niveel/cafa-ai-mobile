import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/hooks';
import type { ArchivedChatSnapshot } from '@/services/storage/archivedChats';

type ArchivedChatsManageModalProps = {
  visible: boolean;
  items: ArchivedChatSnapshot[];
  loading: boolean;
  busyIds: string[];
  onClose: () => void;
  onUnarchive: (chatId: string) => void;
  onDelete: (chatId: string) => void;
  t: (key: string, params?: Record<string, string>) => string;
};

function formatArchivedDate(value: number) {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return '';
  }
}

export function ArchivedChatsManageModal({
  visible,
  items,
  loading,
  busyIds,
  onClose,
  onUnarchive,
  onDelete,
  t,
}: ArchivedChatsManageModalProps) {
  const { colors, isDark } = useAppTheme();
  const busySet = useMemo(() => new Set(busyIds), [busyIds]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.close')}
          onPress={onClose}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(4,6,12,0.6)' }}
        />

        <View
          className="rounded-t-3xl px-4 pb-5 pt-3"
          style={{
            maxHeight: '82%',
            backgroundColor: isDark ? '#0E0E12' : '#FFFFFF',
            borderTopWidth: 1.5,
            borderColor: colors.primary,
          }}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
              {t('settings.data.archivedManageTitle')}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('settings.close')}
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ borderWidth: 1, borderColor: colors.primary }}
            >
              <Ionicons name="close" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10 }}>
            {t('settings.data.archivedManageHint')}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8, gap: 8 }}>
            {loading ? (
              <View className="rounded-2xl border px-3 py-3" style={{ borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('drawer.loadingChats')}</Text>
              </View>
            ) : items.length === 0 ? (
              <View className="rounded-2xl border px-3 py-3" style={{ borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('settings.data.noArchivedChats')}</Text>
              </View>
            ) : (
              items.map((item) => {
                const busy = busySet.has(item.id);
                return (
                  <View key={item.id} className="rounded-2xl border px-3 py-3" style={{ borderColor: colors.border }}>
                    <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                      {item.title}
                    </Text>
                    <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      {item.preview || t('drawer.openChatHint')}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                      {t('settings.data.archivedOn')}: {formatArchivedDate(item.archivedAt)}
                    </Text>
                    <View className="mt-3 flex-row gap-2">
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={t('settings.data.unarchive')}
                        onPress={() => onUnarchive(item.id)}
                        disabled={busy}
                        className="h-9 flex-1 items-center justify-center rounded-full"
                        style={{
                          borderWidth: 1.2,
                          borderColor: colors.primary,
                          backgroundColor: busy ? `${colors.primary}22` : 'transparent',
                          opacity: busy ? 0.75 : 1,
                        }}
                      >
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                          {t('settings.data.unarchive')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={t('drawer.delete')}
                        onPress={() => onDelete(item.id)}
                        disabled={busy}
                        className="h-9 flex-1 items-center justify-center rounded-full"
                        style={{
                          borderWidth: 1.2,
                          borderColor: '#E11D48',
                          backgroundColor: busy ? 'rgba(225,29,72,0.18)' : 'transparent',
                          opacity: busy ? 0.75 : 1,
                        }}
                      >
                        <Text style={{ color: '#E11D48', fontSize: 12, fontWeight: '700' }}>{t('drawer.delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


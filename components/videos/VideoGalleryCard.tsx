import { memo } from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme, useI18n } from '@/hooks';
import { VideoHistoryItem } from '@/types';

type VideoGalleryCardProps = {
  item: VideoHistoryItem;
  width: number;
  onOpen: (item: VideoHistoryItem) => void;
  onDownload: (item: VideoHistoryItem) => void;
  onDelete: (item: VideoHistoryItem) => void;
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function VideoGalleryCardImpl({ item, width, onOpen, onDownload, onDelete }: VideoGalleryCardProps) {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const videoHeight = Math.round(width * 9 / 16);

  return (
    <View
      className="mb-3 overflow-hidden rounded-3xl"
      style={{
        width,
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(32,64,121,0.06)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(95,127,184,0.24)' : 'rgba(32,64,121,0.22)',
      }}
    >
      <View
        className="overflow-hidden"
        style={{
          width,
          height: videoHeight,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? 'rgba(95,127,184,0.18)' : 'rgba(32,64,121,0.18)',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chat.generatedVideoAlt')}
          accessibilityHint="Opens this video in a focused player."
          onPress={() => onOpen(item)}
          className="flex-1 items-center justify-center"
          style={{
            backgroundColor: isDark ? 'rgba(8,12,20,0.9)' : 'rgba(234,242,255,0.95)',
          }}
        >
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: 56,
              height: 56,
              backgroundColor: isDark ? 'rgba(95,127,184,0.2)' : 'rgba(32,64,121,0.12)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(95,127,184,0.28)' : 'rgba(32,64,121,0.2)',
            }}
          >
            <Ionicons name="play" size={22} color={colors.primary} style={{ marginLeft: 2 }} />
          </View>
          <Text
            style={{
              marginTop: 10,
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            Open video
          </Text>
        </Pressable>
      </View>

      <View className="px-3 pb-3 pt-2">
        <Text
          numberOfLines={2}
          style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: '600' }}
        >
          {item.prompt}
        </Text>
        <View className="mt-2 flex-row items-center justify-between">
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            {formatDate(item.createdAt)}
          </Text>
          <View className="flex-row items-center">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('videos.downloadOne')}
              accessibilityHint={t('videos.downloadOneHint')}
              onPress={() => onDownload(item)}
              activeOpacity={0.82}
              className="h-8 w-8 items-center justify-center rounded-full"
              style={{
                marginRight: 8,
                backgroundColor: isDark ? 'rgba(95,127,184,0.17)' : 'rgba(32,64,121,0.12)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(95,127,184,0.32)' : 'rgba(32,64,121,0.28)',
              }}
            >
              <Ionicons name="download-outline" size={16} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Delete video"
              accessibilityHint="Deletes this saved video"
              onPress={() => onDelete(item)}
              activeOpacity={0.82}
              className="h-8 w-8 items-center justify-center rounded-full"
              style={{
                backgroundColor: isDark ? 'rgba(239,68,68,0.17)' : 'rgba(239,68,68,0.12)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(248,113,113,0.34)' : 'rgba(239,68,68,0.28)',
              }}
            >
              <Ionicons name="trash-outline" size={16} color={isDark ? '#FCA5A5' : '#DC2626'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

export const VideoGalleryCard = memo(VideoGalleryCardImpl);

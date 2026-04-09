import { memo, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme, useI18n } from '@/hooks';
import { ImageHistoryItem } from '@/types';

type ImageGalleryCardProps = {
  item: ImageHistoryItem;
  imageUrl: string;
  width: number;
  imageHeaders?: Record<string, string>;
  onDownload: (item: ImageHistoryItem) => void;
  onDelete: (item: ImageHistoryItem) => void;
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function ImageGalleryCardImpl({ item, imageUrl, width, imageHeaders, onDownload, onDelete }: ImageGalleryCardProps) {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const imageHeight = Math.round(width * 1.22);
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <View
      className="mb-3 overflow-hidden rounded-3xl"
      style={{
        width,
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(124,58,237,0.06)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(167,139,250,0.24)' : 'rgba(124,58,237,0.22)',
      }}
    >
      <View
        className="overflow-hidden"
        style={{
          width,
          height: imageHeight,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? 'rgba(167,139,250,0.18)' : 'rgba(124,58,237,0.18)',
        }}
      >
        <ExpoImage
          source={{ uri: imageUrl, headers: imageHeaders }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={180}
          onLoadEnd={() => setIsLoaded(true)}
          onError={() => setIsLoaded(true)}
          accessibilityLabel={t('chat.generatedImageAlt')}
        />
        {!isLoaded ? (
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={isDark ? 48 : 56}
              tint={isDark ? 'dark' : 'light'}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(20,20,20,0.42)' : 'rgba(255,255,255,0.42)',
              }}
            >
              <ActivityIndicator color={colors.primary} />
            </BlurView>
          ) : (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(20,20,20,0.52)' : 'rgba(245,245,245,0.72)',
              }}
            >
              <ActivityIndicator color={colors.primary} />
            </View>
          )
        ) : null}
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
              accessibilityLabel={t('images.downloadOne')}
              accessibilityHint={t('images.downloadOneHint')}
              onPress={() => onDownload(item)}
              activeOpacity={0.82}
              className="h-8 w-8 items-center justify-center rounded-full"
              style={{
                marginRight: 8,
                backgroundColor: isDark ? 'rgba(167,139,250,0.17)' : 'rgba(124,58,237,0.12)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(167,139,250,0.32)' : 'rgba(124,58,237,0.28)',
              }}
            >
              <Ionicons name="download-outline" size={16} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Delete image"
              accessibilityHint="Deletes this saved image"
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

export const ImageGalleryCard = memo(ImageGalleryCardImpl);

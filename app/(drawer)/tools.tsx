import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppScreen, RequireAuthRoute } from '@/components';
import { useAppTheme, useI18n } from '@/hooks';

type ToolCard = {
  titleKey: string;
  descriptionKey: string;
  route: '/(drawer)/avatar-video' | '/(drawer)/image-to-video' | '/(drawer)/edit-image' | '/(drawer)/writing-tools' | '/(drawer)/voice';
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  eyebrowKey: string;
};

const TOOL_CARDS: ToolCard[] = [
  {
    titleKey: 'tools.card.avatar.title',
    descriptionKey: 'tools.card.avatar.description',
    route: '/(drawer)/avatar-video',
    icon: 'person-circle-outline',
    accent: '#8C3B16',
    eyebrowKey: 'tools.card.avatar.eyebrow',
  },
  {
    titleKey: 'tools.card.imageToVideo.title',
    descriptionKey: 'tools.card.imageToVideo.description',
    route: '/(drawer)/image-to-video',
    icon: 'film-outline',
    accent: '#1E4FA3',
    eyebrowKey: 'tools.card.imageToVideo.eyebrow',
  },
  {
    titleKey: 'tools.card.editImage.title',
    descriptionKey: 'tools.card.editImage.description',
    route: '/(drawer)/edit-image',
    icon: 'color-wand-outline',
    accent: '#A44A1A',
    eyebrowKey: 'tools.card.editImage.eyebrow',
  },
  {
    titleKey: 'tools.card.writing.title',
    descriptionKey: 'tools.card.writing.description',
    route: '/(drawer)/writing-tools',
    icon: 'create-outline',
    accent: '#0F6B57',
    eyebrowKey: 'tools.card.writing.eyebrow',
  },
  {
    titleKey: 'tools.card.voice.title',
    descriptionKey: 'tools.card.voice.description',
    route: '/(drawer)/voice',
    icon: 'volume-high-outline',
    accent: '#5B34A8',
    eyebrowKey: 'tools.card.voice.eyebrow',
  },
];

function ToolHubCard({
  titleKey,
  descriptionKey,
  route,
  icon,
  accent,
  eyebrowKey,
  cardWidth,
}: ToolCard & { cardWidth: number }) {
  const { t } = useI18n();
  const title = t(titleKey);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('hub.openLabel', { title })}
      accessibilityHint={t('hub.openHint', { title })}
      onPress={() => {
        router.push(route);
      }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.96 : 1,
        transform: [{ scale: pressed ? 0.992 : 1 }],
      })}
    >
      <View
        className="mb-4 overflow-hidden rounded-[24px] border p-4"
        style={{
          width: cardWidth,
          borderColor: `${accent}DD`,
          backgroundColor: accent,
        }}
      >
        <View
          className="absolute -right-8 -top-8 h-20 w-20 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
        />
        <View
          className="absolute -bottom-8 right-6 h-16 w-16 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}
        />

        <View className="flex-row items-start justify-between">
          <View
            className="h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}
          >
            <Ionicons name={icon} size={18} color="#FFFFFF" />
          </View>
          <View
            className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: 'rgba(15,23,42,0.18)' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 }}>
              {t(eyebrowKey)}
            </Text>
          </View>
        </View>

        <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800', marginTop: 14 }}>
          {title}
        </Text>
        <Text
          numberOfLines={4}
          style={{ color: 'rgba(255,255,255,0.84)', fontSize: 12, lineHeight: 18, marginTop: 8 }}
        >
          {t(descriptionKey)}
        </Text>

        <View className="mt-5 flex-row items-center justify-between">
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
            {t('hub.open')}
          </Text>
          <View
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.96)' }}
          >
            <Ionicons name="arrow-forward" size={15} color={accent} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function ToolsScreen() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const cardWidth = useMemo(() => Math.floor((width - 20 - 12) / 2), [width]);

  return (
    <RequireAuthRoute>
      <AppScreen title={t('drawer.tools')}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
            {t('tools.subtitle')}
          </Text>

          <View className="flex-row flex-wrap justify-between">
            {TOOL_CARDS.map((card) => (
              <ToolHubCard key={card.titleKey} {...card} cardWidth={cardWidth} />
            ))}
          </View>
        </ScrollView>
      </AppScreen>
    </RequireAuthRoute>
  );
}

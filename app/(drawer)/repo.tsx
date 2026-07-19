import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppScreen, RequireAuthRoute } from '@/components';
import { useAppTheme, useI18n } from '@/hooks';

type RepoCard = {
  titleKey: string;
  descriptionKey: string;
  route: '/(drawer)/artifacts' | '/(drawer)/videos' | '/(drawer)/images';
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  eyebrowKey: string;
};

const REPO_CARDS: RepoCard[] = [
  {
    titleKey: 'repo.card.artifacts.title',
    descriptionKey: 'repo.card.artifacts.description',
    route: '/(drawer)/artifacts',
    icon: 'document-attach-outline',
    accent: '#5B34A8',
    eyebrowKey: 'repo.card.artifacts.eyebrow',
  },
  {
    titleKey: 'repo.card.videos.title',
    descriptionKey: 'repo.card.videos.description',
    route: '/(drawer)/videos',
    icon: 'videocam-outline',
    accent: '#9F2F2F',
    eyebrowKey: 'repo.card.videos.eyebrow',
  },
  {
    titleKey: 'repo.card.images.title',
    descriptionKey: 'repo.card.images.description',
    route: '/(drawer)/images',
    icon: 'images-outline',
    accent: '#176D86',
    eyebrowKey: 'repo.card.images.eyebrow',
  },
];

function RepoHubCard({
  titleKey,
  descriptionKey,
  route,
  icon,
  accent,
  eyebrowKey,
  cardWidth,
}: RepoCard & { cardWidth: number }) {
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
          className="absolute -left-8 top-8 h-16 w-16 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}
        />
        <View
          className="absolute -right-8 -top-8 h-20 w-20 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
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

export default function RepoScreen() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const cardWidth = useMemo(() => Math.floor((width - 20 - 12) / 2), [width]);

  return (
    <RequireAuthRoute>
      <AppScreen title={t('drawer.repo')}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
            {t('repo.subtitle')}
          </Text>

          <View className="flex-row flex-wrap justify-between">
            {REPO_CARDS.map((card) => (
              <RepoHubCard key={card.titleKey} {...card} cardWidth={cardWidth} />
            ))}
          </View>
        </ScrollView>
      </AppScreen>
    </RequireAuthRoute>
  );
}

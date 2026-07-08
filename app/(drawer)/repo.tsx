import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppScreen, RequireAuthRoute } from '@/components';
import { useAppTheme } from '@/hooks';

type RepoCard = {
  title: string;
  description: string;
  route: '/(drawer)/artifacts' | '/(drawer)/videos' | '/(drawer)/images';
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  eyebrow: string;
};

const REPO_CARDS: RepoCard[] = [
  {
    title: 'Artifacts',
    description: 'Browse generated files, exports, and document outputs in one organized repository view.',
    route: '/(drawer)/artifacts',
    icon: 'document-attach-outline',
    accent: '#7C3AED',
    eyebrow: 'Files',
  },
  {
    title: 'Videos',
    description: 'Review saved video generations, manage downloads, and revisit recent motion outputs.',
    route: '/(drawer)/videos',
    icon: 'videocam-outline',
    accent: '#DC2626',
    eyebrow: 'Motion',
  },
  {
    title: 'Images',
    description: 'Open your image history, inspect results, and manage saved visual generations quickly.',
    route: '/(drawer)/images',
    icon: 'images-outline',
    accent: '#0891B2',
    eyebrow: 'Gallery',
  },
];

function RepoHubCard({
  title,
  description,
  route,
  icon,
  accent,
  eyebrow,
  cardWidth,
}: RepoCard & { cardWidth: number }) {
  const { colors, isDark } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      accessibilityHint={`Navigates to ${title}.`}
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
          borderColor: `${accent}40`,
          backgroundColor: isDark ? '#101017' : '#FBFBFF',
        }}
      >
        <View
          className="absolute -left-8 top-8 h-16 w-16 rounded-full"
          style={{ backgroundColor: `${accent}14` }}
        />
        <View
          className="absolute -right-8 -top-8 h-20 w-20 rounded-full"
          style={{ backgroundColor: `${accent}22` }}
        />

        <View className="flex-row items-start justify-between">
          <View
            className="h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${accent}20`, borderWidth: 1, borderColor: `${accent}40` }}
          >
            <Ionicons name={icon} size={18} color={accent} />
          </View>
          <View
            className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)' }}
          >
            <Text style={{ color: accent, fontSize: 9, fontWeight: '700', letterSpacing: 0.3 }}>
              {eyebrow}
            </Text>
          </View>
        </View>

        <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 14 }}>
          {title}
        </Text>
        <Text numberOfLines={4} style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
          {description}
        </Text>

        <View className="mt-5 flex-row items-center justify-between">
          <Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: '700' }}>
            Open
          </Text>
          <View
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: accent }}
          >
            <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function RepoScreen() {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const cardWidth = useMemo(() => Math.floor((width - 20 - 12) / 2), [width]);

  return (
    <RequireAuthRoute>
      <AppScreen title="Repo">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
            Everything you have generated lives here, grouped into focused collections for easier browsing.
          </Text>

          <View className="flex-row flex-wrap justify-between">
            {REPO_CARDS.map((card) => (
              <RepoHubCard key={card.title} {...card} cardWidth={cardWidth} />
            ))}
          </View>
        </ScrollView>
      </AppScreen>
    </RequireAuthRoute>
  );
}

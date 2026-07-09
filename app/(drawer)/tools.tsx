import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppScreen, RequireAuthRoute } from '@/components';
import { useAppTheme } from '@/hooks';

type ToolCard = {
  title: string;
  description: string;
  route: '/(drawer)/avatar-video' | '/(drawer)/image-to-video' | '/(drawer)/edit-image' | '/(drawer)/writing-tools' | '/(drawer)/voice';
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  eyebrow: string;
};

const TOOL_CARDS: ToolCard[] = [
  {
    title: 'Avatar Video',
    description: 'Create a talking avatar video with gallery faces or your own portrait, auto-written script, and voice selection.',
    route: '/(drawer)/avatar-video',
    icon: 'person-circle-outline',
    accent: '#C2410C',
    eyebrow: 'Talking Video',
  },
  {
    title: 'Image to Video',
    description: 'Turn a still image into a motion-ready clip with a workflow tuned for video prompts.',
    route: '/(drawer)/image-to-video',
    icon: 'film-outline',
    accent: '#2563EB',
    eyebrow: 'Motion Lab',
  },
  {
    title: 'Edit Image',
    description: 'Refine, restyle, or transform an image without leaving the Cafa creative flow.',
    route: '/(drawer)/edit-image',
    icon: 'color-wand-outline',
    accent: '#EA580C',
    eyebrow: 'Creative Edit',
  },
  {
    title: 'Writing Tools',
    description: 'Open AI Detection and Humanize in one place for fast checks and cleaner rewrites.',
    route: '/(drawer)/writing-tools',
    icon: 'create-outline',
    accent: '#059669',
    eyebrow: 'Text Studio',
  },
  {
    title: 'Text to Speech',
    description: 'Turn text into downloadable speech with library voices, cloned voices, previews, and recent history.',
    route: '/(drawer)/voice',
    icon: 'volume-high-outline',
    accent: '#7C3AED',
    eyebrow: 'Voice Lab',
  },
];

function ToolHubCard({
  title,
  description,
  route,
  icon,
  accent,
  eyebrow,
  cardWidth,
}: ToolCard & { cardWidth: number }) {
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
          backgroundColor: isDark ? '#0E1118' : '#F8FAFF',
        }}
      >
        <View
          className="absolute -right-8 -top-8 h-20 w-20 rounded-full"
          style={{ backgroundColor: `${accent}1F` }}
        />
        <View
          className="absolute -bottom-8 right-6 h-16 w-16 rounded-full"
          style={{ backgroundColor: `${accent}14` }}
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
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)' }}
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

export default function ToolsScreen() {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const cardWidth = useMemo(() => Math.floor((width - 20 - 12) / 2), [width]);

  return (
    <RequireAuthRoute>
      <AppScreen title="Tools">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
            Create, transform, and refine with focused workspaces designed for media and writing tasks.
          </Text>

          <View className="flex-row flex-wrap justify-between">
            {TOOL_CARDS.map((card) => (
              <ToolHubCard key={card.title} {...card} cardWidth={cardWidth} />
            ))}
          </View>
        </ScrollView>
      </AppScreen>
    </RequireAuthRoute>
  );
}

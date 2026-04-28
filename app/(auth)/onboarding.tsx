import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppLogo } from '@/components';
import { useAppContext } from '@/context';
import { useAppTheme, useI18n } from '@/hooks';
import { hapticSelection } from '@/utils';

type OnboardingSlide = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
};

type SlideCardProps = {
  item: OnboardingSlide;
  index: number;
  pageWidth: number;
  cardMinHeight: number;
  scrollX: SharedValue<number>;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
};

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<OnboardingSlide>);

function SlideCard({
  item,
  index,
  pageWidth,
  cardMinHeight,
  scrollX,
  isDark,
  textPrimary,
  textSecondary,
}: SlideCardProps) {
  const input = [pageWidth * (index - 1), pageWidth * index, pageWidth * (index + 1)];
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(scrollX.value, input, [0.92, 1, 0.92], Extrapolation.CLAMP) },
      { translateY: interpolate(scrollX.value, input, [18, 0, 18], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(scrollX.value, input, [0.6, 1, 0.6], Extrapolation.CLAMP),
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(scrollX.value, input, [-8, 0, 8], Extrapolation.CLAMP)}deg` },
      { scale: interpolate(scrollX.value, input, [0.85, 1, 0.85], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={{ width: pageWidth }}>
      <Animated.View
        className="overflow-hidden rounded-[30px] p-[1.2px]"
        style={cardStyle}
      >
        <LinearGradient
          colors={
            isDark
              ? [item.accent, 'rgba(32,64,121,0.55)', 'rgba(20,20,20,0.8)']
              : ['rgba(32,64,121,0.45)', item.accent, 'rgba(95,127,184,0.35)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 30, padding: 1.2 }}
        >
          <View
            className="rounded-[29px] px-6 pb-8 pt-7"
            style={{
              minHeight: cardMinHeight,
              backgroundColor: isDark ? 'rgba(8,8,10,0.88)' : 'rgba(255,255,255,0.94)',
            }}
          >
            <Animated.View
              className="mb-7 h-16 w-16 items-center justify-center rounded-2xl"
              style={[
                iconStyle,
                {
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(95,127,184,0.4)' : 'rgba(32,64,121,0.28)',
                  backgroundColor: isDark ? 'rgba(95,127,184,0.15)' : 'rgba(32,64,121,0.12)',
                },
              ]}
            >
              <Ionicons name={item.icon} size={30} color={item.accent} />
            </Animated.View>
            <Text style={{ color: textPrimary, fontSize: 32, lineHeight: 38, fontWeight: '800' }}>
              {item.title}
            </Text>
            <Text style={{ color: textSecondary, marginTop: 14, lineHeight: 24, fontSize: 15 }}>
              {item.description}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

export default function OnboardingScreen() {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const { completeOnboarding } = useAppContext();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const bgPulse = useSharedValue(0);
  const horizontalPadding = 16;
  const topSpacing = Math.max(16, insets.top + 10);
  const footerSpacing = Math.max(16, insets.bottom + 12);
  const footerReservedHeight = 96 + footerSpacing;
  const contentPaddingY = topSpacing + footerReservedHeight + 56;
  const cardMinHeight = Math.max(360, Math.min(470, height - contentPaddingY));
  const pageWidth = Math.max(300, width - horizontalPadding * 2);
  const data = useMemo<OnboardingSlide[]>(
    () => [
      {
        id: 'welcome',
        title: t('onboarding.slide1.title'),
        description: t('onboarding.slide1.body'),
        icon: 'sparkles-outline',
        accent: '#5F7FB8',
      },
      {
        id: 'multimodal',
        title: t('onboarding.slide2.title'),
        description: t('onboarding.slide2.body'),
        icon: 'albums-outline',
        accent: '#204079',
      },
      {
        id: 'secure',
        title: t('onboarding.slide3.title'),
        description: t('onboarding.slide3.body'),
        icon: 'shield-checkmark-outline',
        accent: '#2B4F8E',
      },
    ],
    [t],
  );

  useEffect(() => {
    bgPulse.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(bgPulse);
    };
  }, [bgPulse]);

  const orbOneStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(bgPulse.value, [0, 1], [-8, 18], Extrapolation.CLAMP) },
      { translateY: interpolate(bgPulse.value, [0, 1], [0, 22], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(bgPulse.value, [0, 1], [0.28, 0.5], Extrapolation.CLAMP),
  }));

  const orbTwoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(bgPulse.value, [0, 1], [16, -14], Extrapolation.CLAMP) },
      { translateY: interpolate(bgPulse.value, [0, 1], [18, -14], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(bgPulse.value, [0, 1], [0.26, 0.46], Extrapolation.CLAMP),
  }));

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const finish = () => {
    completeOnboarding();
    router.replace('/(drawer)');
  };

  const goNext = () => {
    hapticSelection();
    if (activeIndex >= data.length - 1) {
      finish();
      return;
    }
    const next = activeIndex + 1;
    setActiveIndex(next);
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? ['#07090D', '#10264D', '#06080C'] : ['#FFFFFF', '#EEF4FF', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          paddingHorizontal: horizontalPadding,
          paddingTop: topSpacing,
          paddingBottom: footerSpacing,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            orbOneStyle,
            {
              position: 'absolute',
              right: -24,
              top: 68,
              width: 180,
              height: 180,
              borderRadius: 999,
              backgroundColor: '#204079',
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            orbTwoStyle,
            {
              position: 'absolute',
              left: -54,
              bottom: 180,
              width: 210,
              height: 210,
              borderRadius: 999,
              backgroundColor: '#5F7FB8',
            },
          ]}
        />

        <View className="mb-5 flex-row items-center justify-between">
          <AppLogo compact />
          {activeIndex < data.length - 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.skip')}
              onPress={finish}
              className="rounded-full px-3 py-1.5"
              style={{
                borderWidth: 1,
                borderColor: isDark ? 'rgba(95,127,184,0.35)' : 'rgba(32,64,121,0.28)',
                backgroundColor: isDark ? 'rgba(95,127,184,0.12)' : 'rgba(32,64,121,0.1)',
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>
                {t('onboarding.skip')}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <AnimatedFlatList
          ref={flatListRef}
          data={data}
          horizontal
          pagingEnabled
          bounces={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          onMomentumScrollEnd={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
            setActiveIndex(Math.max(0, Math.min(data.length - 1, next)));
          }}
          getItemLayout={(_, index) => ({ index, length: pageWidth, offset: pageWidth * index })}
          renderItem={({ item, index }) => (
            <SlideCard
              item={item}
              index={index}
              pageWidth={pageWidth}
              cardMinHeight={cardMinHeight}
              scrollX={scrollX}
              isDark={isDark}
              textPrimary={colors.textPrimary}
              textSecondary={colors.textSecondary}
            />
          )}
        />

        <View style={{ marginTop: 16 }}>
          <View className="flex-row items-center justify-center gap-2">
            {data.map((slide, idx) => (
              <View
                key={slide.id}
                className="rounded-full"
                style={{
                  width: idx === activeIndex ? 24 : 8,
                  height: 8,
                  backgroundColor: idx === activeIndex
                    ? colors.primary
                    : isDark
                      ? 'rgba(255,255,255,0.28)'
                      : 'rgba(32,64,121,0.24)',
                }}
              />
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={activeIndex === data.length - 1 ? t('onboarding.start') : t('onboarding.next')}
            onPress={goNext}
            className="mt-5 h-12 items-center justify-center rounded-full"
            style={{
              backgroundColor: colors.primary,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(95,127,184,0.7)' : 'rgba(24,52,97,0.85)',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
              {activeIndex === data.length - 1 ? t('onboarding.start') : t('onboarding.next')}
            </Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

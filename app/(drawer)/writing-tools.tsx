import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppButton, AppPromptModal, AppScreen, RequireAuthRoute } from '@/components';
import { useAppTheme, useI18n } from '@/hooks';
import {
  detectAi,
  getDetectAiQuota,
  getHumanizeQuota,
  humanizeText,
} from '@/features';
import type {
  DetectAiResult,
  HumanizeIntensity,
  HumanizeResult,
  HumanizeStyle,
  WritingToolError,
  WritingToolQuota,
} from '@/types';

type ToolMode = 'detect' | 'humanize';

const HUMANIZE_STYLES: HumanizeStyle[] = ['professional', 'casual', 'academic'];
const HUMANIZE_INTENSITIES: HumanizeIntensity[] = ['light', 'medium', 'heavy'];

function countWords(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function formatTierLabel(value?: string | null) {
  switch (value) {
    case 'cafa_smart':
      return 'Cafa Smart';
    case 'cafa_pro':
      return 'Cafa Pro';
    case 'cafa_max':
      return 'Cafa Max';
    default:
      return 'Free';
  }
}

function formatQuotaLine(quota: WritingToolQuota | null, fallback: string) {
  if (!quota) return fallback;
  const remaining = typeof quota.remaining === 'number'
    ? quota.remaining
    : Math.max(0, quota.limit - quota.used);
  return `${remaining.toLocaleString()} words remaining this month`;
}

export default function WritingToolsScreen() {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const [mode, setMode] = useState<ToolMode>('detect');
  const [detectText, setDetectText] = useState('');
  const [humanizeTextInput, setHumanizeTextInput] = useState('');
  const [humanizeStyle, setHumanizeStyle] = useState<HumanizeStyle>('professional');
  const [humanizeIntensity, setHumanizeIntensity] = useState<HumanizeIntensity>('medium');
  const [detectQuota, setDetectQuota] = useState<WritingToolQuota | null>(null);
  const [humanizeQuota, setHumanizeQuota] = useState<WritingToolQuota | null>(null);
  const [detectResult, setDetectResult] = useState<DetectAiResult | null>(null);
  const [humanizeResult, setHumanizeResult] = useState<HumanizeResult | null>(null);
  const [isRefreshingQuota, setIsRefreshingQuota] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [upgradePrompt, setUpgradePrompt] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({
    visible: false,
    title: '',
    message: '',
  });

  const activeQuota = mode === 'detect' ? detectQuota : humanizeQuota;
  const activeText = mode === 'detect' ? detectText : humanizeTextInput;
  const activeWords = useMemo(() => countWords(activeText), [activeText]);

  const loadQuotas = useCallback(async () => {
    setIsRefreshingQuota(true);
    try {
      const [nextDetectQuota, nextHumanizeQuota] = await Promise.all([
        getDetectAiQuota(),
        getHumanizeQuota(),
      ]);
      setDetectQuota(nextDetectQuota);
      setHumanizeQuota(nextHumanizeQuota);
      setErrorMessage('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load your quota right now.';
      setErrorMessage(message);
    } finally {
      setIsRefreshingQuota(false);
    }
  }, []);

  useEffect(() => {
    void loadQuotas();
  }, [loadQuotas]);

  const openUpgradePrompt = useCallback((toolLabel: string, error: WritingToolError) => {
    const used = typeof error.data?.used === 'number' ? error.data.used.toLocaleString() : '0';
    const limit = typeof error.data?.limit === 'number' ? error.data.limit.toLocaleString() : '0';
    const tier = formatTierLabel(typeof error.data?.tier === 'string' ? error.data.tier : null);
    setUpgradePrompt({
      visible: true,
      title: `${toolLabel} limit reached`,
      message: `${toolLabel} is out of words for this month on ${tier}. Usage: ${used} / ${limit}. Upgrade your plan to keep going.`,
    });
  }, []);

  const handleRefreshQuota = useCallback(() => {
    void loadQuotas();
  }, [loadQuotas]);

  const handleDetect = useCallback(async () => {
    const trimmed = detectText.trim();
    if (!trimmed) {
      setErrorMessage('Paste text to analyze first.');
      return;
    }
    if (trimmed.length < 50) {
      setErrorMessage('Text must be at least 50 characters for accurate detection.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const result = await detectAi({ text: trimmed });
      setDetectResult(result);
      setDetectQuota({
        ...result.usage,
        remaining: Math.max(0, result.usage.limit - result.usage.used),
      });
    } catch (error) {
      const mapped = error as WritingToolError;
      if (mapped.status === 403) {
        openUpgradePrompt('AI Detection', mapped);
      } else {
        setErrorMessage(mapped.message || 'Could not run AI detection right now. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [detectText, openUpgradePrompt]);

  const handleHumanize = useCallback(async () => {
    const trimmed = humanizeTextInput.trim();
    if (!trimmed) {
      setErrorMessage('Paste text to rewrite first.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const result = await humanizeText({
        text: trimmed,
        style: humanizeStyle,
        intensity: humanizeIntensity,
      });
      setHumanizeResult(result);
      setHumanizeQuota({
        ...result.usage,
        remaining: Math.max(0, result.usage.limit - result.usage.used),
      });
    } catch (error) {
      const mapped = error as WritingToolError;
      if (mapped.status === 403) {
        openUpgradePrompt('Humanize', mapped);
      } else {
        setErrorMessage(mapped.message || 'Could not rewrite this text right now. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [humanizeIntensity, humanizeStyle, humanizeTextInput, openUpgradePrompt]);

  const renderOptionChip = (
    value: string,
    selected: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={value}
      accessibilityRole="button"
      accessibilityLabel={value}
      onPress={onPress}
      className="mr-2 rounded-full px-3 py-2"
      style={{
        borderWidth: 1.2,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? `${colors.primary}18` : (isDark ? '#101015' : '#FFFFFF'),
      }}
    >
      <Text style={{ color: selected ? colors.primary : colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
        {value.charAt(0).toUpperCase() + value.slice(1)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <RequireAuthRoute>
      <AppPromptModal
        visible={upgradePrompt.visible}
        title={upgradePrompt.title}
        message={upgradePrompt.message}
        confirmLabel={t('chat.limit.upgradeCta')}
        cancelLabel={t('chat.limit.dismiss')}
        iconName="rocket-outline"
        onCancel={() => {
          setUpgradePrompt((prev) => ({ ...prev, visible: false }));
        }}
        onConfirm={() => {
          setUpgradePrompt((prev) => ({ ...prev, visible: false }));
          router.push('/plans');
        }}
      />

      <AppScreen
        title="Writing Tools"
        subtitle="Run AI detection or rewrite text for more natural flow. Each tool uses its own monthly word quota."
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View
            className="mb-4 rounded-3xl border p-3"
            style={{
              borderColor: colors.border,
              backgroundColor: isDark ? '#101015' : '#FFFFFF',
            }}
          >
            <View className="flex-row">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open AI Detection"
                onPress={() => {
                  setMode('detect');
                  setErrorMessage('');
                }}
                className="mr-2 flex-1 rounded-full px-4 py-3"
                style={{
                  backgroundColor: mode === 'detect' ? colors.primary : 'transparent',
                  borderWidth: mode === 'detect' ? 0 : 1.2,
                  borderColor: mode === 'detect' ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: mode === 'detect' ? '#FFFFFF' : colors.textPrimary, textAlign: 'center', fontWeight: '700' }}>
                  AI Detection
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open Humanize"
                onPress={() => {
                  setMode('humanize');
                  setErrorMessage('');
                }}
                className="flex-1 rounded-full px-4 py-3"
                style={{
                  backgroundColor: mode === 'humanize' ? colors.primary : 'transparent',
                  borderWidth: mode === 'humanize' ? 0 : 1.2,
                  borderColor: mode === 'humanize' ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: mode === 'humanize' ? '#FFFFFF' : colors.textPrimary, textAlign: 'center', fontWeight: '700' }}>
                  Humanize
                </Text>
              </Pressable>
            </View>
          </View>

          <View
            className="mb-4 rounded-3xl border p-4"
            style={{
              borderColor: colors.border,
              backgroundColor: isDark ? '#101015' : '#FFFFFF',
            }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
                  {mode === 'detect' ? 'AI Detection quota' : 'Humanize quota'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                  {formatQuotaLine(activeQuota, 'Checking remaining words...')}
                </Text>
                {activeQuota ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                    Plan: {formatTierLabel(activeQuota.tier)} | Used: {activeQuota.used.toLocaleString()} / {activeQuota.limit.toLocaleString()}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Refresh quota"
                onPress={handleRefreshQuota}
                disabled={isRefreshingQuota}
                className="rounded-full px-3 py-2"
                style={{
                  borderWidth: 1.2,
                  borderColor: colors.primary,
                  opacity: isRefreshingQuota ? 0.7 : 1,
                }}
              >
                {isRefreshingQuota ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            <View
              className="rounded-2xl border px-3 py-3"
              style={{
                borderColor: colors.border,
                backgroundColor: isDark ? '#0B1220' : '#F8FAFC',
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                {mode === 'detect'
                  ? 'Paste at least 50 characters before running detection.'
                  : 'Humanize rewrites text without automatically chaining from detection.'}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
                Current draft: {activeWords.toLocaleString()} words
              </Text>
            </View>
          </View>

          {mode === 'detect' ? (
            <View
              className="mb-4 rounded-3xl border p-4"
              style={{
                borderColor: colors.border,
                backgroundColor: isDark ? '#101015' : '#FFFFFF',
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
                Detect AI-generated text
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                The backend checks whether the pasted text reads as AI-generated and returns human/AI probability with confidence.
              </Text>

              <TextInput
                value={detectText}
                onChangeText={setDetectText}
                multiline
                textAlignVertical="top"
                placeholder="Paste text to analyze..."
                placeholderTextColor={colors.textSecondary}
                style={{
                  minHeight: 180,
                  marginTop: 14,
                  borderWidth: 1.2,
                  borderColor: colors.border,
                  borderRadius: 22,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: colors.textPrimary,
                  backgroundColor: isDark ? '#0C0C0F' : '#FFFFFF',
                }}
              />

              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
                Characters: {detectText.trim().length} | Words: {countWords(detectText)}
              </Text>

              {!!errorMessage && mode === 'detect' ? (
                <Text style={{ color: '#DC2626', fontSize: 12, marginTop: 10 }}>
                  {errorMessage}
                </Text>
              ) : null}

              <View className="mt-4 flex-row">
                <AppButton
                  label={isSubmitting ? 'Checking...' : 'Run AI Detection'}
                  iconName="search-outline"
                  onPress={() => {
                    if (!isSubmitting) void handleDetect();
                  }}
                />
              </View>

              {detectResult ? (
                <View
                  className="mt-4 rounded-2xl border p-4"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: isDark ? '#0B1220' : '#F8FAFC',
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>
                      Result
                    </Text>
                    <View
                      className="rounded-full px-3 py-1.5"
                      style={{ backgroundColor: detectResult.isAiGenerated ? '#FEE2E2' : '#DCFCE7' }}
                    >
                      <Text style={{ color: detectResult.isAiGenerated ? '#B91C1C' : '#166534', fontSize: 12, fontWeight: '700' }}>
                        {detectResult.isAiGenerated ? 'Likely AI-generated' : 'Likely human-written'}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 10 }}>
                    AI probability: {detectResult.aiProbability}%
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    Human probability: {detectResult.humanProbability}%
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    Confidence: {detectResult.confidence}
                  </Text>
                  {typeof detectResult.details?.averageGeneratedProb === 'number' ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
                      Average generated probability: {detectResult.details.averageGeneratedProb.toFixed(4)}
                    </Text>
                  ) : null}
                  {typeof detectResult.details?.completelyGeneratedProb === 'number' ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                      Completely generated probability: {detectResult.details.completelyGeneratedProb.toFixed(4)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <View
              className="mb-4 rounded-3xl border p-4"
              style={{
                borderColor: colors.border,
                backgroundColor: isDark ? '#101015' : '#FFFFFF',
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
                Humanize your writing
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                Rewrite for more natural flow without changing the facts you care about.
              </Text>

              <TextInput
                value={humanizeTextInput}
                onChangeText={setHumanizeTextInput}
                multiline
                textAlignVertical="top"
                placeholder="Paste text to rewrite..."
                placeholderTextColor={colors.textSecondary}
                style={{
                  minHeight: 180,
                  marginTop: 14,
                  borderWidth: 1.2,
                  borderColor: colors.border,
                  borderRadius: 22,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: colors.textPrimary,
                  backgroundColor: isDark ? '#0C0C0F' : '#FFFFFF',
                }}
              />

              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 14 }}>
                Style
              </Text>
              <View className="mt-2 flex-row flex-wrap">
                {HUMANIZE_STYLES.map((value) => renderOptionChip(value, humanizeStyle === value, () => setHumanizeStyle(value)))}
              </View>

              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 14 }}>
                Intensity
              </Text>
              <View className="mt-2 flex-row flex-wrap">
                {HUMANIZE_INTENSITIES.map((value) => renderOptionChip(value, humanizeIntensity === value, () => setHumanizeIntensity(value)))}
              </View>

              {!!errorMessage && mode === 'humanize' ? (
                <Text style={{ color: '#DC2626', fontSize: 12, marginTop: 10 }}>
                  {errorMessage}
                </Text>
              ) : null}

              <View className="mt-4 flex-row">
                <AppButton
                  label={isSubmitting ? 'Rewriting...' : 'Humanize Text'}
                  iconName="create-outline"
                  onPress={() => {
                    if (!isSubmitting) void handleHumanize();
                  }}
                />
              </View>

              {humanizeResult ? (
                <View
                  className="mt-4 rounded-2xl border p-4"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: isDark ? '#0B1220' : '#F8FAFC',
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', flex: 1, paddingRight: 10 }}>
                      Rewrite result
                    </Text>
                    <View
                      className="rounded-full px-3 py-1.5"
                      style={{ backgroundColor: humanizeResult.modelTier === 'enhanced' ? '#DBEAFE' : '#E2E8F0' }}
                    >
                      <Text style={{ color: '#1D4ED8', fontSize: 12, fontWeight: '700' }}>
                        {humanizeResult.modelTier}
                      </Text>
                    </View>
                  </View>

                  {!humanizeResult.factCheckPassed ? (
                    <Text style={{ color: '#B45309', fontSize: 12, marginTop: 10 }}>
                      Please double-check this rewrite before using it. The fact-preservation check flagged it for review.
                    </Text>
                  ) : null}

                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 10 }}>
                    Style: {humanizeResult.style} | Intensity: {humanizeResult.intensity}
                  </Text>

                  <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 22, marginTop: 12 }}>
                    {humanizeResult.result}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          <View
            className="mb-4 rounded-3xl border p-4"
            style={{
              borderColor: colors.border,
              backgroundColor: isDark ? '#101015' : '#FFFFFF',
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>
              Plan usage
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
              These tools share the same monthly cycle shown on your billing page. Use the plans screen to upgrade if you are close to a limit.
            </Text>
            <View className="mt-4 flex-row">
              <AppButton
                label="Open Plans"
                iconName="card-outline"
                variant="outline"
                onPress={() => {
                  router.push('/plans');
                }}
              />
            </View>
          </View>
        </ScrollView>
      </AppScreen>
    </RequireAuthRoute>
  );
}

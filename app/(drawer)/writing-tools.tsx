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
import * as Clipboard from 'expo-clipboard';
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

function formatTierLabel(value: string | null | undefined, t: (key: string) => string) {
  switch (value) {
    case 'cafa_smart':
      return 'Cafa Smart';
    case 'cafa_pro':
      return 'Cafa Pro';
    case 'cafa_max':
      return 'Cafa Max';
    default:
      return t('writingTools.dynamic.free');
  }
}

function formatQuotaLine(quota: WritingToolQuota | null, fallback: string, t: (key: string, params?: Record<string, string>) => string) {
  if (!quota) return fallback;
  const remaining = typeof quota.remaining === 'number'
    ? quota.remaining
    : Math.max(0, quota.limit - quota.used);
  return t('writingTools.dynamic.wordsRemaining', { count: remaining.toLocaleString() });
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
  const [statusMessage, setStatusMessage] = useState('');
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
      setStatusMessage('');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('writingTools.dynamic.quotaLoadError');
      setErrorMessage(message);
    } finally {
      setIsRefreshingQuota(false);
    }
  }, [t]);

  useEffect(() => {
    void loadQuotas();
  }, [loadQuotas]);

  const openUpgradePrompt = useCallback((toolLabel: string, error: WritingToolError) => {
    const used = typeof error.data?.used === 'number' ? error.data.used.toLocaleString() : '0';
    const limit = typeof error.data?.limit === 'number' ? error.data.limit.toLocaleString() : '0';
    const tier = formatTierLabel(typeof error.data?.tier === 'string' ? error.data.tier : null, t);
    setUpgradePrompt({
      visible: true,
      title: t('writingTools.dynamic.limitReached', { tool: toolLabel }),
      message: t('writingTools.dynamic.limitMessage', { tool: toolLabel, tier, used, limit }),
    });
  }, [t]);

  const handleRefreshQuota = useCallback(() => {
    void loadQuotas();
  }, [loadQuotas]);

  const handleDetect = useCallback(async () => {
    const trimmed = detectText.trim();
    if (!trimmed) {
      setErrorMessage(t('writingTools.dynamic.pasteAnalyzeFirst'));
      setStatusMessage('');
      return;
    }
    if (trimmed.length < 50) {
      setErrorMessage(t('writingTools.dynamic.minimumDetectionLength'));
      setStatusMessage('');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('');
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
        openUpgradePrompt(t('writingTools.dynamic.aiDetection'), mapped);
      } else {
        setErrorMessage(mapped.message || t('writingTools.dynamic.detectionError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [detectText, openUpgradePrompt, t]);

  const handleHumanize = useCallback(async () => {
    const trimmed = humanizeTextInput.trim();
    if (!trimmed) {
      setErrorMessage(t('writingTools.dynamic.pasteRewriteFirst'));
      setStatusMessage('');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('');
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
        openUpgradePrompt(t('writingTools.dynamic.humanize'), mapped);
      } else {
        setErrorMessage(mapped.message || t('writingTools.dynamic.rewriteError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [humanizeIntensity, humanizeStyle, humanizeTextInput, openUpgradePrompt, t]);

  const handleClearDetectText = useCallback(() => {
    setDetectText('');
    setDetectResult(null);
    setErrorMessage('');
    setStatusMessage(t('writingTools.dynamic.detectionCleared'));
  }, [t]);

  const handleClearHumanizeText = useCallback(() => {
    setHumanizeTextInput('');
    setHumanizeResult(null);
    setErrorMessage('');
    setStatusMessage(t('writingTools.dynamic.humanizeCleared'));
  }, [t]);

  const handleCopyDetectText = useCallback(async () => {
    const input = detectText.trim();
    if (!input) return;
    await Clipboard.setStringAsync(input);
    setErrorMessage('');
    setStatusMessage(t('writingTools.dynamic.detectionCopied'));
  }, [detectText, t]);

  const handleCopyHumanizeTextInput = useCallback(async () => {
    const input = humanizeTextInput.trim();
    if (!input) return;
    await Clipboard.setStringAsync(input);
    setErrorMessage('');
    setStatusMessage(t('writingTools.dynamic.humanizeCopied'));
  }, [humanizeTextInput, t]);

  const handleCopyHumanizeResult = useCallback(async () => {
    const output = humanizeResult?.result?.trim();
    if (!output) return;
    await Clipboard.setStringAsync(output);
    setErrorMessage('');
    setStatusMessage(t('writingTools.dynamic.resultCopied'));
  }, [humanizeResult?.result, t]);

  const handleSendToHumanize = useCallback(() => {
    const trimmed = detectText.trim();
    if (!trimmed) {
      setErrorMessage(t('writingTools.dynamic.pasteAnalyzeFirst'));
      setStatusMessage('');
      return;
    }
    setHumanizeTextInput(trimmed);
    setMode('humanize');
    setErrorMessage('');
    setStatusMessage(t('writingTools.dynamic.movedToHumanize'));
  }, [detectText, t]);

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
        title={t('writingTools.title.writingTools')}
        subtitle={t('writingTools.subtitle.runAIDetectionOrRewriteTextFor')}
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
                accessibilityLabel={t('writingTools.accessibilityLabel.openAIDetection')}
                accessibilityHint={t('writingTools.accessibilityHint.switchesToTheAIDetectionTool')}
                accessibilityState={{ selected: mode === 'detect' }}
                onPress={() => {
                  setMode('detect');
                  setErrorMessage('');
                  setStatusMessage('');
                }}
                className="mr-2 flex-1 rounded-full px-4 py-3"
                style={{
                  backgroundColor: mode === 'detect' ? colors.primary : 'transparent',
                  borderWidth: mode === 'detect' ? 0 : 1.2,
                  borderColor: mode === 'detect' ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: mode === 'detect' ? '#FFFFFF' : colors.textPrimary, textAlign: 'center', fontWeight: '700' }}>
                  {' '}{t('writingTools.ui.aiDetection')}{' '}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('writingTools.accessibilityLabel.openHumanize')}
                accessibilityHint={t('writingTools.accessibilityHint.switchesToTheHumanizeTool')}
                accessibilityState={{ selected: mode === 'humanize' }}
                onPress={() => {
                  setMode('humanize');
                  setErrorMessage('');
                  setStatusMessage('');
                }}
                className="flex-1 rounded-full px-4 py-3"
                style={{
                  backgroundColor: mode === 'humanize' ? colors.primary : 'transparent',
                  borderWidth: mode === 'humanize' ? 0 : 1.2,
                  borderColor: mode === 'humanize' ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: mode === 'humanize' ? '#FFFFFF' : colors.textPrimary, textAlign: 'center', fontWeight: '700' }}>
                  {' '}{t('writingTools.ui.humanize')}{' '}</Text>
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
                  {t(mode === 'detect' ? 'writingTools.dynamic.detectionQuota' : 'writingTools.dynamic.humanizeQuota')}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                  {formatQuotaLine(activeQuota, t('writingTools.dynamic.checkingWords'), t)}
                </Text>
                {activeQuota ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                    {' '}{t('writingTools.ui.plan')}{' '}{formatTierLabel(activeQuota.tier, t)} {' '}{t('writingTools.ui.used')}{' '}{activeQuota.used.toLocaleString()} / {activeQuota.limit.toLocaleString()}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('writingTools.accessibilityLabel.refreshQuota')}
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
                  ? t('writingTools.dynamic.detectionHelp')
                  : t('writingTools.dynamic.humanizeHelp')}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
                {' '}{t('writingTools.ui.currentDraft')}{' '}{activeWords.toLocaleString()} {' '}{t('writingTools.ui.words')}{' '}</Text>
            </View>
          </View>

          {!!statusMessage ? (
            <View
              className="mb-4 rounded-2xl border px-3 py-3"
              accessible
              accessibilityLiveRegion="polite"
              style={{
                borderColor: colors.border,
                backgroundColor: isDark ? '#0B1220' : '#F8FAFC',
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 12 }}>
                {statusMessage}
              </Text>
            </View>
          ) : null}

          {mode === 'detect' ? (
            <View
              className="mb-4 rounded-3xl border p-4"
              style={{
                borderColor: colors.border,
                backgroundColor: isDark ? '#101015' : '#FFFFFF',
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
                {' '}{t('writingTools.ui.detectAIGeneratedText')}{' '}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                {' '}{t('writingTools.ui.theBackendChecksWhetherThePastedText')}{' '}</Text>

              <View className="mt-4 flex-row items-center justify-between">
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
                  {' '}{t('writingTools.ui.textToAnalyze')}{' '}</Text>
                <View className="flex-row items-center">
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('writingTools.accessibilityLabel.copyAIDetectionText')}
                    accessibilityHint={t('writingTools.accessibilityHint.copiesTheTextInTheAIDetection')}
                    disabled={!detectText.trim()}
                    onPress={() => {
                      void handleCopyDetectText();
                    }}
                    className="rounded-full px-3 py-2"
                    style={{
                      borderWidth: 1.2,
                      borderColor: colors.border,
                      opacity: detectText.trim() ? 1 : 0.45,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
                      {' '}{t('writingTools.ui.copy')}{' '}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('writingTools.accessibilityLabel.clearAIDetectionText')}
                    accessibilityHint={t('writingTools.accessibilityHint.clearsAllPastedTextAndDetectionResults')}
                    disabled={!detectText.trim()}
                    onPress={handleClearDetectText}
                    className="ml-2 rounded-full px-3 py-2"
                    style={{
                      borderWidth: 1.2,
                      borderColor: colors.border,
                      opacity: detectText.trim() ? 1 : 0.45,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
                      {' '}{t('writingTools.ui.clear')}{' '}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TextInput
                value={detectText}
                onChangeText={setDetectText}
                multiline
                textAlignVertical="top"
                placeholder={t('writingTools.placeholder.pasteTextToAnalyze')}
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel={t('writingTools.accessibilityLabel.aiDetectionInput')}
                accessibilityHint={t('writingTools.accessibilityHint.pasteOrTypeTextToCheckWhether')}
                style={{
                  minHeight: 180,
                  marginTop: 10,
                  borderWidth: 1.2,
                  borderColor: colors.border,
                  borderRadius: 22,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.textPrimary,
                  backgroundColor: isDark ? '#0C0C0F' : '#FFFFFF',
                }}
              />

              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
                {' '}{t('writingTools.ui.characters')}{' '}{detectText.trim().length} {' '}{t('writingTools.ui.words2')}{' '}{countWords(detectText)}
              </Text>

              {!!errorMessage && mode === 'detect' ? (
                <Text accessibilityLiveRegion="polite" style={{ color: '#DC2626', fontSize: 12, marginTop: 10 }}>
                  {errorMessage}
                </Text>
              ) : null}

              <View className="mt-4 flex-row flex-wrap items-start">
                <AppButton
                  label={t(isSubmitting ? 'writingTools.dynamic.checking' : 'writingTools.dynamic.runDetection')}
                  iconName="search-outline"
                  onPress={() => {
                    if (!isSubmitting) void handleDetect();
                  }}
                />
                <View style={{ width: '100%', height: 10 }} />
                <AppButton
                  label={t('writingTools.label.humanizeThis')}
                  iconName="arrow-forward-outline"
                  variant="outline"
                  onPress={handleSendToHumanize}
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
                      {' '}{t('writingTools.ui.result')}{' '}</Text>
                    <View
                      className="rounded-full px-3 py-1.5"
                      style={{ backgroundColor: detectResult.isAiGenerated ? '#FEE2E2' : '#DCFCE7' }}
                    >
                      <Text style={{ color: detectResult.isAiGenerated ? '#B91C1C' : '#166534', fontSize: 12, fontWeight: '700' }}>
                        {t(detectResult.isAiGenerated ? 'writingTools.dynamic.likelyAi' : 'writingTools.dynamic.likelyHuman')}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 10 }}>
                    {' '}{t('writingTools.ui.aiProbability')}{' '}{detectResult.aiProbability}%
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    {' '}{t('writingTools.ui.humanProbability')}{' '}{detectResult.humanProbability}%
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    {' '}{t('writingTools.ui.confidence')}{' '}{detectResult.confidence}
                  </Text>
                  {typeof detectResult.details?.averageGeneratedProb === 'number' ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
                      {' '}{t('writingTools.ui.averageGeneratedProbability')}{' '}{detectResult.details.averageGeneratedProb.toFixed(4)}
                    </Text>
                  ) : null}
                  {typeof detectResult.details?.completelyGeneratedProb === 'number' ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                      {' '}{t('writingTools.ui.completelyGeneratedProbability')}{' '}{detectResult.details.completelyGeneratedProb.toFixed(4)}
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('writingTools.accessibilityLabel.humanizeDetectedText')}
                    accessibilityHint={t('writingTools.accessibilityHint.switchesToTheHumanizeTabAndPastes')}
                    onPress={handleSendToHumanize}
                    className="mt-4 self-start rounded-full px-4 py-2.5"
                    style={{
                      borderWidth: 1.2,
                      borderColor: colors.primary,
                      backgroundColor: `${colors.primary}14`,
                    }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                      {' '}{t('writingTools.ui.sendToHumanize')}{' '}</Text>
                  </TouchableOpacity>
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
                {' '}{t('writingTools.ui.humanizeYourWriting')}{' '}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                {' '}{t('writingTools.ui.rewriteForMoreNaturalFlowWithoutChanging')}{' '}</Text>

              <View className="mt-4 flex-row items-center justify-between">
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
                  {' '}{t('writingTools.ui.textToRewrite')}{' '}</Text>
                <View className="flex-row items-center">
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('writingTools.accessibilityLabel.copyHumanizeText')}
                    accessibilityHint={t('writingTools.accessibilityHint.copiesTheTextInTheHumanizeInput')}
                    disabled={!humanizeTextInput.trim()}
                    onPress={() => {
                      void handleCopyHumanizeTextInput();
                    }}
                    className="rounded-full px-3 py-2"
                    style={{
                      borderWidth: 1.2,
                      borderColor: colors.border,
                      opacity: humanizeTextInput.trim() ? 1 : 0.45,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
                      {' '}{t('writingTools.ui.copy')}{' '}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('writingTools.accessibilityLabel.clearHumanizeText')}
                    accessibilityHint={t('writingTools.accessibilityHint.clearsThePastedTextAndAnyHumanize')}
                    disabled={!humanizeTextInput.trim()}
                    onPress={handleClearHumanizeText}
                    className="ml-2 rounded-full px-3 py-2"
                    style={{
                      borderWidth: 1.2,
                      borderColor: colors.border,
                      opacity: humanizeTextInput.trim() ? 1 : 0.45,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
                      {' '}{t('writingTools.ui.clear')}{' '}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TextInput
                value={humanizeTextInput}
                onChangeText={setHumanizeTextInput}
                multiline
                textAlignVertical="top"
                placeholder={t('writingTools.placeholder.pasteTextToRewrite')}
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel={t('writingTools.accessibilityLabel.humanizeInput')}
                accessibilityHint={t('writingTools.accessibilityHint.pasteOrTypeTextToRewriteFor')}
                style={{
                  minHeight: 180,
                  marginTop: 10,
                  borderWidth: 1.2,
                  borderColor: colors.border,
                  borderRadius: 22,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.textPrimary,
                  backgroundColor: isDark ? '#0C0C0F' : '#FFFFFF',
                }}
              />

              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 14 }}>
                {' '}{t('writingTools.ui.style')}{' '}</Text>
              <View className="mt-2 flex-row flex-wrap">
                {HUMANIZE_STYLES.map((value) => renderOptionChip(value, humanizeStyle === value, () => setHumanizeStyle(value)))}
              </View>

              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 14 }}>
                {' '}{t('writingTools.ui.intensity')}{' '}</Text>
              <View className="mt-2 flex-row flex-wrap">
                {HUMANIZE_INTENSITIES.map((value) => renderOptionChip(value, humanizeIntensity === value, () => setHumanizeIntensity(value)))}
              </View>

              {!!errorMessage && mode === 'humanize' ? (
                <Text accessibilityLiveRegion="polite" style={{ color: '#DC2626', fontSize: 12, marginTop: 10 }}>
                  {errorMessage}
                </Text>
              ) : null}

              <View className="mt-4 flex-row">
                <AppButton
                  label={t(isSubmitting ? 'writingTools.dynamic.rewriting' : 'writingTools.dynamic.humanizeText')}
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
                      {' '}{t('writingTools.ui.rewriteResult')}{' '}</Text>
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
                      {' '}{t('writingTools.ui.pleaseDoubleCheckThisRewriteBeforeUsing')}{' '}</Text>
                  ) : null}

                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 10 }}>
                    {' '}{t('writingTools.ui.style2')}{' '}{humanizeResult.style} {' '}{t('writingTools.ui.intensity2')}{' '}{humanizeResult.intensity}
                  </Text>

                  <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 22, marginTop: 12 }}>
                    {humanizeResult.result}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('writingTools.accessibilityLabel.copyHumanizedText')}
                    accessibilityHint={t('writingTools.accessibilityHint.copiesTheRewrittenResultToTheClipboard')}
                    onPress={() => {
                      void handleCopyHumanizeResult();
                    }}
                    className="mt-4 self-start rounded-full px-4 py-2.5"
                    style={{
                      borderWidth: 1.2,
                      borderColor: colors.primary,
                      backgroundColor: `${colors.primary}14`,
                    }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                      {' '}{t('writingTools.ui.copyResult')}{' '}</Text>
                  </TouchableOpacity>
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
              {' '}{t('writingTools.ui.planUsage')}{' '}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
              {' '}{t('writingTools.ui.theseToolsShareTheSameMonthlyCycle')}{' '}</Text>
            <View className="mt-4 flex-row">
              <AppButton
                label={t('writingTools.label.openPlans')}
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

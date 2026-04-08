import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Slider from '@react-native-community/slider';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

import { getUserPersonalization, getVoiceCatalog, synthesizeVoice, updateUserPersonalization } from '@/features';
import type { ThemeColors } from '@/config';
import { getDefaultVoicePreference, setDefaultVoicePreference } from '@/services';
import type {
  AboutYouPersonalization,
  PersonalizationResponseLength,
  PersonalizationTone,
  VoiceDescriptor,
} from '@/types';
import { AppSwitch } from '../AppSwitch';

const TONE_OPTIONS: { value: PersonalizationTone; key: string }[] = [
  { value: 'balanced', key: 'settings.personalization.tone.balanced' },
  { value: 'professional', key: 'settings.personalization.tone.professional' },
  { value: 'friendly', key: 'settings.personalization.tone.friendly' },
  { value: 'concise', key: 'settings.personalization.tone.concise' },
  { value: 'detailed', key: 'settings.personalization.tone.detailed' },
];

const LENGTH_OPTIONS: { value: PersonalizationResponseLength; key: string }[] = [
  { value: 'short', key: 'settings.personalization.length.short' },
  { value: 'medium', key: 'settings.personalization.length.medium' },
  { value: 'long', key: 'settings.personalization.length.long' },
];

const EMPTY_ABOUT: AboutYouPersonalization = { nickname: '', occupation: '', about: '' };

type PersonalizationSectionProps = {
  visible: boolean;
  isAuthenticated: boolean;
  isDark: boolean;
  colors: ThemeColors;
  t: (key: string, params?: Record<string, string>) => string;
};

const eqAbout = (a: AboutYouPersonalization, b: AboutYouPersonalization) =>
  a.nickname === b.nickname && a.occupation === b.occupation && a.about === b.about;

export function PersonalizationSection({ visible, isAuthenticated, isDark, colors, t }: PersonalizationSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toneMenuOpen, setToneMenuOpen] = useState(false);
  const [lengthMenuOpen, setLengthMenuOpen] = useState(false);
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const [toneMenuUpward, setToneMenuUpward] = useState(false);
  const [lengthMenuUpward, setLengthMenuUpward] = useState(false);
  const [voiceMenuUpward, setVoiceMenuUpward] = useState(false);

  const [tone, setTone] = useState<PersonalizationTone>('balanced');
  const [responseLength, setResponseLength] = useState<PersonalizationResponseLength>('medium');
  const [creativity, setCreativity] = useState(0.7);
  const [savedCreativity, setSavedCreativity] = useState(0.7);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [aboutYou, setAboutYou] = useState<AboutYouPersonalization>(EMPTY_ABOUT);
  const [aboutState, setAboutState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [voices, setVoices] = useState<VoiceDescriptor[]>([]);
  const [voiceId, setVoiceId] = useState('');
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [previewNotice, setPreviewNotice] = useState('');
  const { height: viewportHeight } = useWindowDimensions();

  const lastAboutRef = useRef<AboutYouPersonalization>(EMPTY_ABOUT);
  const aboutDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aboutPulseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);
  const voicePreviewUriByIdRef = useRef<Record<string, string>>({});
  const voicePreviewFileByIdRef = useRef<Record<string, File>>({});
  const toneTriggerRef = useRef<View | null>(null);
  const lengthTriggerRef = useRef<View | null>(null);
  const voiceTriggerRef = useRef<View | null>(null);

  const resolveMenuDirection = useCallback(
    (
      triggerRef: React.MutableRefObject<View | null>,
      estimatedHeight: number,
      setDirectionUpward: (value: boolean) => void,
    ) => {
      requestAnimationFrame(() => {
        const triggerNode = triggerRef.current as unknown as {
          measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
        } | null;
        if (!triggerNode || typeof triggerNode.measureInWindow !== 'function') return;
        try {
          triggerNode.measureInWindow((_x, y, _width, height) => {
            const spaceBelow = viewportHeight - (y + height);
            const spaceAbove = y;
            const shouldOpenUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
            setDirectionUpward(shouldOpenUp);
          });
        } catch {
          // Keep default downward placement if native measurement is unavailable.
        }
      });
    },
    [viewportHeight],
  );

  const stopPreview = useCallback(() => {
    try { subRef.current?.remove(); } catch {}
    subRef.current = null;
    try { playerRef.current?.pause(); } catch {}
    try { playerRef.current?.remove(); } catch {}
    playerRef.current = null;
    setPreviewVoiceId(null);
    setPreviewState('idle');
  }, []);

  const apply = useCallback((next: Awaited<ReturnType<typeof getUserPersonalization>>) => {
    setTone(next.tone);
    setResponseLength(next.responseLength);
    setCreativity(next.creativity);
    setSavedCreativity(next.creativity);
    setVoiceEnabled(next.voiceEnabled);
    setMemoryEnabled(next.memoryEnabled);
    setAboutYou(next.aboutYou);
    lastAboutRef.current = next.aboutYou;
  }, []);

  const hydrate = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const [personalization, catalog, storedVoice] = await Promise.all([
        getUserPersonalization(),
        getVoiceCatalog(),
        getDefaultVoicePreference(),
      ]);
      apply(personalization);
      setVoices(catalog);
      const fallback = catalog[0]?.id ?? '';
      const selected = storedVoice && catalog.some((entry) => entry.id === storedVoice) ? storedVoice : fallback;
      setVoiceId(selected);
      if (selected && selected !== storedVoice) await setDefaultVoicePreference(selected);
    } finally {
      setIsLoading(false);
    }
  }, [apply, isAuthenticated]);

  const patch = useCallback(async (payload: Parameters<typeof updateUserPersonalization>[0]) => {
    setIsSaving(true);
    try {
      const updated = await updateUserPersonalization(payload);
      apply(updated);
    } finally {
      setIsSaving(false);
    }
  }, [apply]);

  const previewVoice = useCallback(async (nextVoiceId: string) => {
    if (!voiceEnabled || isLoading || isSaving) return;
    if (previewVoiceId === nextVoiceId && previewState === 'playing') { stopPreview(); return; }
    stopPreview();
    setPreviewNotice('');
    setPreviewVoiceId(nextVoiceId);
    try {
      let uri = voicePreviewUriByIdRef.current[nextVoiceId];
      if (!uri) {
        setPreviewState('loading');
        const bytes = await synthesizeVoice({
          text: t('settings.personalization.voice.previewText'),
          voice: nextVoiceId,
          speed: 1,
        });
        const file = new File(Paths.cache, `voice-preview-cache-${nextVoiceId}.wav`);
        file.create({ intermediates: true, overwrite: true });
        file.write(bytes);
        voicePreviewFileByIdRef.current[nextVoiceId] = file;
        uri = file.uri;
        voicePreviewUriByIdRef.current[nextVoiceId] = uri;
      }

      const player = createAudioPlayer(uri, { keepAudioSessionActive: true });
      playerRef.current = player;
      setPreviewState('playing');
      subRef.current = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) stopPreview();
      });
      player.play();
    } catch {
      stopPreview();
      setPreviewState('error');
      setPreviewNotice(t('settings.personalization.previewFailed'));
    }
  }, [isLoading, isSaving, previewState, previewVoiceId, stopPreview, t, voiceEnabled]);

  useEffect(() => {
    if (!visible) return;
    void hydrate();
  }, [hydrate, visible]);

  useEffect(() => () => {
    if (aboutDebounceRef.current) clearTimeout(aboutDebounceRef.current);
    if (aboutPulseRef.current) clearTimeout(aboutPulseRef.current);
    stopPreview();
    Object.values(voicePreviewFileByIdRef.current).forEach((file) => {
      try {
        if (file.exists) file.delete();
      } catch {
        // Ignore cache cleanup errors.
      }
    });
    voicePreviewFileByIdRef.current = {};
    voicePreviewUriByIdRef.current = {};
  }, [stopPreview]);

  useEffect(() => {
    if (!visible || !isAuthenticated || isLoading) return;
    if (eqAbout(aboutYou, lastAboutRef.current)) return;
    if (aboutDebounceRef.current) clearTimeout(aboutDebounceRef.current);
    if (aboutPulseRef.current) clearTimeout(aboutPulseRef.current);
    setAboutState('saving');
    aboutDebounceRef.current = setTimeout(() => {
      void updateUserPersonalization({ aboutYou })
        .then((updated) => {
          lastAboutRef.current = updated.aboutYou;
          setAboutYou(updated.aboutYou);
          setAboutState('saved');
          aboutPulseRef.current = setTimeout(() => setAboutState('idle'), 1300);
        })
        .catch(() => setAboutState('error'))
        .finally(() => { aboutDebounceRef.current = null; });
    }, 600);
  }, [aboutYou, isAuthenticated, isLoading, visible]);

  const toneLabel = useMemo(
    () => t(TONE_OPTIONS.find((entry) => entry.value === tone)?.key ?? TONE_OPTIONS[0].key),
    [t, tone],
  );

  const lengthLabel = useMemo(
    () => t(LENGTH_OPTIONS.find((entry) => entry.value === responseLength)?.key ?? LENGTH_OPTIONS[1].key),
    [responseLength, t],
  );

  if (isLoading) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>{t('settings.personalization.loading')}</Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="py-1">
        <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{t('settings.personalization.aiTone')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('settings.personalization.aiToneHint')}</Text>
        <View className="relative mt-2" style={{ zIndex: toneMenuOpen ? 50 : 2, elevation: toneMenuOpen ? 20 : 0 }}>
          <Pressable ref={toneTriggerRef} className="h-10 flex-row items-center justify-between rounded-xl border px-3" style={{ borderColor: colors.primary, backgroundColor: isDark ? '#101015' : '#FFF' }} onPress={() => { if (!toneMenuOpen) resolveMenuDirection(toneTriggerRef, 210, setToneMenuUpward); setToneMenuOpen((v) => !v); setLengthMenuOpen(false); setVoiceMenuOpen(false); }}>
            <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{toneLabel}</Text>
            <Ionicons name={toneMenuOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={16} color={colors.textSecondary} />
          </Pressable>
          {toneMenuOpen ? (
            <View className="absolute left-0 right-0 rounded-xl border p-1" style={{ borderColor: colors.border, backgroundColor: isDark ? '#101015' : '#FFF', top: toneMenuUpward ? undefined : 44, bottom: toneMenuUpward ? 44 : undefined }}>
              {TONE_OPTIONS.map((entry) => (
                <Pressable key={entry.value} className="rounded-lg px-3 py-2" style={{ backgroundColor: tone === entry.value ? `${colors.primary}20` : 'transparent' }} onPress={() => { setToneMenuOpen(false); const prev = tone; setTone(entry.value); void patch({ tone: entry.value }).catch(() => setTone(prev)); }}>
                  <Text style={{ color: tone === entry.value ? colors.primary : colors.textPrimary, fontSize: 13 }}>{t(entry.key)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        {previewState === 'loading' ? (
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 8 }} accessibilityLiveRegion="polite">
            {t('settings.personalization.previewLoadingHint')}
          </Text>
        ) : null}
        {previewNotice ? (
          <Text style={{ color: '#F87171', fontSize: 11, marginTop: 6 }} accessibilityLiveRegion="polite">
            {previewNotice}
          </Text>
        ) : null}
      </View>
      <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.45 }} />

      <View className="py-1">
        <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{t('settings.personalization.responseLength')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('settings.personalization.responseLengthHint')}</Text>
        <View className="relative mt-2" style={{ zIndex: lengthMenuOpen ? 40 : 1, elevation: lengthMenuOpen ? 18 : 0 }}>
          <Pressable ref={lengthTriggerRef} className="h-10 flex-row items-center justify-between rounded-xl border px-3" style={{ borderColor: colors.primary, backgroundColor: isDark ? '#101015' : '#FFF' }} onPress={() => { if (!lengthMenuOpen) resolveMenuDirection(lengthTriggerRef, 150, setLengthMenuUpward); setLengthMenuOpen((v) => !v); setToneMenuOpen(false); setVoiceMenuOpen(false); }}>
            <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{lengthLabel}</Text>
            <Ionicons name={lengthMenuOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={16} color={colors.textSecondary} />
          </Pressable>
          {lengthMenuOpen ? (
            <View className="absolute left-0 right-0 rounded-xl border p-1" style={{ borderColor: colors.border, backgroundColor: isDark ? '#101015' : '#FFF', top: lengthMenuUpward ? undefined : 44, bottom: lengthMenuUpward ? 44 : undefined }}>
              {LENGTH_OPTIONS.map((entry) => (
                <Pressable key={entry.value} className="rounded-lg px-3 py-2" style={{ backgroundColor: responseLength === entry.value ? `${colors.primary}20` : 'transparent' }} onPress={() => { setLengthMenuOpen(false); const prev = responseLength; setResponseLength(entry.value); void patch({ responseLength: entry.value }).catch(() => setResponseLength(prev)); }}>
                  <Text style={{ color: responseLength === entry.value ? colors.primary : colors.textPrimary, fontSize: 13 }}>{t(entry.key)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <View className="mt-3">
          <View className="mb-1 flex-row items-center justify-between">
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{t('settings.personalization.creativity')}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{`${Math.round(creativity * 100)}%`}</Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('settings.personalization.creativityHint')}</Text>
          <Slider value={creativity} minimumValue={0} maximumValue={1} step={0.01} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primary} onValueChange={setCreativity} onSlidingComplete={(value) => { const clamped = Math.max(0, Math.min(1, value)); if (Math.abs(clamped - savedCreativity) < 0.001) return; const prev = savedCreativity; setSavedCreativity(clamped); void patch({ creativity: clamped }).catch(() => { setSavedCreativity(prev); setCreativity(prev); }); }} />
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.45 }} />

      <View className="py-1">
        <View className="flex-row items-center justify-between">
          <View className="mr-3 flex-1">
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{t('settings.personalization.voiceMode')}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('settings.personalization.voiceModeHint')}</Text>
          </View>
          <AppSwitch value={voiceEnabled} onValueChange={(next) => { const prev = voiceEnabled; setVoiceEnabled(next); void patch({ voiceEnabled: next }).catch(() => setVoiceEnabled(prev)); }} />
        </View>
        <Text style={{ color: colors.textPrimary, fontWeight: '700', marginTop: 10 }}>{t('settings.personalization.defaultVoice')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('settings.personalization.defaultVoiceHint')}</Text>
        <View className="relative mt-2" style={{ zIndex: voiceMenuOpen ? 30 : 1, elevation: voiceMenuOpen ? 16 : 0 }}>
          <Pressable ref={voiceTriggerRef} disabled={!voiceEnabled || !voices.length} className="h-10 flex-row items-center justify-between rounded-xl border px-3" style={{ borderColor: colors.primary, backgroundColor: isDark ? '#101015' : '#FFF', opacity: !voiceEnabled || !voices.length ? 0.55 : 1 }} onPress={() => { if (!voiceMenuOpen) resolveMenuDirection(voiceTriggerRef, 180, setVoiceMenuUpward); setVoiceMenuOpen((v) => !v); }}>
            <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{voices.find((entry) => entry.id === voiceId)?.name ?? t('settings.personalization.voice.none')}</Text>
            <Ionicons name={voiceMenuOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={16} color={colors.textSecondary} />
          </Pressable>
          {voiceMenuOpen ? (
            <View className="absolute left-0 right-0 max-h-40 rounded-xl border p-1" style={{ borderColor: colors.border, backgroundColor: isDark ? '#101015' : '#FFF', top: voiceMenuUpward ? undefined : 44, bottom: voiceMenuUpward ? 44 : undefined }}>
              <ScrollView nestedScrollEnabled>
                {voices.map((entry) => (
                  <Pressable key={entry.id} className="rounded-lg px-3 py-2" style={{ backgroundColor: voiceId === entry.id ? `${colors.primary}20` : 'transparent' }} onPress={() => { setVoiceId(entry.id); setVoiceMenuOpen(false); void setDefaultVoicePreference(entry.id); }}>
                    <Text style={{ color: voiceId === entry.id ? colors.primary : colors.textPrimary, fontSize: 13 }}>{entry.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
        <View className="mt-2 gap-2">
          {voices.map((entry) => {
            const selected = voiceId === entry.id;
            const isTarget = previewVoiceId === entry.id;
            const isLoadingPreview = isTarget && previewState === 'loading';
            const isPlaying = isTarget && previewState === 'playing';
            return (
              <View key={entry.id} className="rounded-lg border px-2.5 py-2" style={{ borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? `${colors.primary}12` : 'transparent' }}>
                <View className="flex-row items-start justify-between">
                  <View className="mr-2 flex-1">
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{entry.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{`${entry.gender ?? '—'} · ${entry.accent ?? '—'}`}</Text>
                  </View>
                  <Pressable className="h-8 min-w-[84px] items-center justify-center rounded-md border px-2" style={{ borderColor: colors.border, opacity: !voiceEnabled ? 0.5 : 1 }} disabled={!voiceEnabled || isSaving} onPress={() => { void previewVoice(entry.id); }}>
                    {isLoadingPreview ? (
                      <View className="flex-row items-center">
                        <ActivityIndicator size="small" color={colors.textPrimary} />
                        <Text style={{ color: colors.textPrimary, fontSize: 11, marginLeft: 6 }}>{t('settings.personalization.previewLoading')}</Text>
                      </View>
                    ) : (
                      <Text style={{ color: colors.textPrimary, fontSize: 11 }}>{isPlaying ? t('settings.personalization.stopPreview') : t('settings.personalization.preview')}</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.45 }} />

      <View className="py-1">
        <View className="flex-row items-center justify-between">
          <View className="mr-3 flex-1">
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{t('settings.personalization.memory')}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('settings.personalization.memoryHint')}</Text>
          </View>
          <AppSwitch value={memoryEnabled} onValueChange={(next) => { const prev = memoryEnabled; setMemoryEnabled(next); void patch({ memoryEnabled: next }).catch(() => setMemoryEnabled(prev)); }} />
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.45 }} />

      <View className="py-1">
        <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{t('settings.personalization.aboutYou')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('settings.personalization.aboutYouHint')}</Text>
        {aboutState !== 'idle' ? (
          <Text style={{ color: aboutState === 'error' ? '#F87171' : colors.textSecondary, fontSize: 11, marginTop: 6 }}>
            {aboutState === 'saving' ? t('settings.personalization.saving') : aboutState === 'saved' ? t('settings.personalization.saved') : t('settings.personalization.saveFailed')}
          </Text>
        ) : null}
        <View className="mt-3 gap-3">
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{t('settings.personalization.nickname')}</Text>
            <TextInput value={aboutYou.nickname} onChangeText={(text) => setAboutYou((prev) => ({ ...prev, nickname: text }))} placeholder={t('settings.personalization.nicknamePlaceholder')} placeholderTextColor={colors.textSecondary} className="h-10 rounded-lg border px-3" style={{ borderColor: colors.border, color: colors.textPrimary, paddingVertical: 0, textAlignVertical: 'center' }} />
          </View>
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{t('settings.personalization.occupation')}</Text>
            <TextInput value={aboutYou.occupation} onChangeText={(text) => setAboutYou((prev) => ({ ...prev, occupation: text }))} placeholder={t('settings.personalization.occupation')} placeholderTextColor={colors.textSecondary} className="h-10 rounded-lg border px-3" style={{ borderColor: colors.border, color: colors.textPrimary, paddingVertical: 0, textAlignVertical: 'center' }} />
          </View>
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{t('settings.personalization.moreAboutYou')}</Text>
            <TextInput value={aboutYou.about} onChangeText={(text) => setAboutYou((prev) => ({ ...prev, about: text }))} placeholder={t('settings.personalization.moreAboutYou')} placeholderTextColor={colors.textSecondary} multiline textAlignVertical="top" className="rounded-lg border px-3 py-2" style={{ borderColor: colors.border, color: colors.textPrimary, minHeight: 96 }} />
          </View>
        </View>
      </View>
    </View>
  );
}

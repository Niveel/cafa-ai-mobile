import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import { useAppTheme, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib/client/base-url';

import { movieStudioApi } from '../data/api';
import { useLatest } from '../hooks/useLatest';
import {
  TRANSITION_STEP,
  TRIM_STEP,
  buildDefaultTimeline,
  clipSourceSeconds,
  moveClip,
  normalizeTimeline,
  reconcileTimeline,
  resolveAssetUrl,
  resolveSceneImage,
  timelineTotalSeconds,
  updateClip,
} from '../domain/rules';
import type { Project, Scene, Timeline, TimelineClip, TransitionKind } from '../domain/types';
import { SceneClipPlayer } from './SceneClipPlayer';
import { StudioButton } from './StudioButton';
import { StudioIcon } from './StudioIcon';
import { ICON, useStudioPalette } from '../theme';


const ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return API_BASE_URL;
  }
})();
const TRANSITIONS: TransitionKind[] = ['cut', 'crossfade', 'fadeToBlack'];

type Props = { project: Project; onContinue: () => void; onOpenScenes: () => void; onBack?: () => void };

const messageOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

function Stepper({
  label,
  value,
  step,
  onChange,
  decreaseLabel,
  increaseLabel,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (next: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  const { colors } = useAppTheme();
  const P = useStudioPalette();
  const button = (glyph: string, a11y: string, delta: number) => (
    <Pressable
      onPress={() => onChange(value + delta)}
      accessibilityRole="button"
      accessibilityLabel={`${a11y} ${label}`}
      style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: colors.textPrimary, fontSize: 20, lineHeight: 22 }}>{glyph}</Text>
    </Pressable>
  );
  return (
    <View className="mb-3">
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        {button('−', decreaseLabel, -step)}
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', minWidth: 52, textAlign: 'center' }}>{value.toFixed(1)}s</Text>
        {button('+', increaseLabel, step)}
      </View>
    </View>
  );
}

export function EditorStage({ project, onContinue, onOpenScenes, onBack }: Props) {
  const { colors } = useAppTheme();
  const P = useStudioPalette();
  const { t } = useI18n();
  const tRef = useLatest(t);
  const surface = P.surface;

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [selected, setSelected] = useState(0);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<'load' | 'save' | 'continue' | null>('load');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy('load');
    setError(null);
    try {
      const [list, existing] = await Promise.all([movieStudioApi.listScenes(project.id), movieStudioApi.getTimeline(project.id)]);
      setScenes(list);
      const usable = existing ? reconcileTimeline(existing, list) : null;
      setTimeline(usable && usable.clips.length ? usable : buildDefaultTimeline(list));
      // Continue to Export unlocks only after a save in this session.
      setSaved(false);
    } catch (e) {
      setError(messageOf(e, tRef.current('studio.editor.loadFailed')));
    } finally {
      setBusy(null);
    }
  }, [project.id, tRef]);

  useEffect(() => {
    void load();
  }, [load]);

  const sceneById = (id: string) => scenes.find((s) => s.id === id);
  const sceneNumber = (id: string) => scenes.findIndex((s) => s.id === id) + 1;
  const clips = timeline?.clips ?? [];
  const index = Math.min(selected, Math.max(0, clips.length - 1));
  const clip: TimelineClip | undefined = clips[index];
  const clipScene = clip ? sceneById(clip.shotId) : undefined;
  const source = clipSourceSeconds(clipScene);
  const working = busy !== null;

  const edit = (next: Timeline) => {
    setTimeline(next);
    setSaved(false);
    setError(null);
  };

  const save = async () => {
    if (!timeline || timeline.clips.length === 0 || working) return;
    setBusy('save');
    setError(null);
    try {
      const result = await movieStudioApi.saveTimeline(project.id, normalizeTimeline(timeline));
      setTimeline(result.clips.length ? result : normalizeTimeline(timeline));
      setSaved(true);
    } catch (e) {
      setError(messageOf(e, tRef.current('studio.editor.saveFailed')));
    } finally {
      setBusy(null);
    }
  };

  const goNext = async () => {
    if (!saved || working) return;
    setBusy('continue');
    setError(null);
    try {
      await movieStudioApi.setWizardStep(project.id, 'export');
      onContinue();
    } catch (e) {
      setError(messageOf(e, tRef.current('studio.editor.continueFailed')));
      setBusy(null);
    }
  };

  if (busy === 'load') return <ActivityIndicator color={ICON} style={{ marginTop: 24 }} />;

  if (!timeline || clips.length === 0) {
    return (
      <View className="items-center rounded-2xl border p-6" style={{ borderColor: P.border, backgroundColor: surface }}>
        <StudioIcon name="film" size={32} color={colors.textSecondary} />
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 8 }}>{t('studio.editor.emptyTitle')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: 'center' }}>{t('studio.editor.emptyBody')}</Text>
        {error ? <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 8 }}>{error}</Text> : null}
        <View style={{ marginTop: 12 }}>
          <StudioButton label={t('studio.editor.openScenes')} onPress={onOpenScenes} />
        </View>
      </View>
    );
  }

  const clipUri = clipScene?.rawClipUrl ? resolveAssetUrl(clipScene.rawClipUrl, ORIGIN) : null;
  const totalSeconds = timelineTotalSeconds(timeline);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="flex-row items-center justify-between">
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>{t('studio.editor.title')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
            {project.title}
          </Text>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {t(clips.length === 1 ? 'studio.editor.summaryOne' : 'studio.editor.summary', { count: String(clips.length), seconds: totalSeconds.toFixed(1) })}
        </Text>
      </View>

      <View className="mt-3 flex-row flex-wrap items-center" style={{ gap: 10 }}>
        {onBack ? <StudioButton label={t('studio.common.back')} icon="arrow-left" variant="outline" compact disabled={working} onPress={onBack} /> : null}
        <StudioButton
          label={saved && busy !== 'save' ? t('studio.editor.saved') : t('studio.editor.save')}
          icon={saved && busy !== 'save' ? 'check' : 'save'}
          variant="outline"
          compact
          loading={busy === 'save'}
          loadingLabel={t('studio.editor.saving')}
          disabled={saved || (working && busy !== 'save')}
          onPress={() => void save()}
        />
      </View>

      <View style={{ marginTop: 12 }}>
        {clipUri ? <SceneClipPlayer key={clip.shotId} uri={clipUri} /> : (
          <View className="items-center justify-center rounded-2xl border" style={{ height: 200, borderColor: P.border, backgroundColor: surface }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('studio.editor.selectClip')}</Text>
          </View>
        )}
      </View>

      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 16 }}>{t('studio.editor.media')}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 8 }}>{t('studio.editor.subtitle')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {clips.map((c, i) => {
          const s = sceneById(c.shotId);
          const thumb = s ? resolveAssetUrl(resolveSceneImage(s), ORIGIN) : null;
          const active = i === index;
          return (
            <Pressable
              key={`${c.shotId}-${i}`}
              onPress={() => setSelected(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t('studio.editor.clipLabel', { number: String(i + 1) })}
              style={{ width: 120 }}
            >
              <View
                className="items-center justify-center overflow-hidden rounded-xl border"
                style={{ width: 120, height: 68, borderColor: active ? P.accent : P.border, borderWidth: active ? 2 : 1, backgroundColor: surface }}
              >
                {thumb ? <ExpoImage source={{ uri: thumb }} style={{ width: 120, height: 68 }} contentFit="cover" /> : null}
                <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' }}>
                  <StudioIcon name="play" size={28} color="#FFFFFF" fill="#FFFFFF" />
                </View>
              </View>
              <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600', marginTop: 4 }}>
                {t('studio.scenes.sceneNumber', { number: String(sceneNumber(c.shotId)) })}
              </Text>
              <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 10 }}>
                {s?.location || t('studio.scenes.untitled')}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="mt-4 rounded-2xl border p-3" style={{ borderColor: P.border, backgroundColor: surface }}>
        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 10 }}>
          {t('studio.editor.clipLabel', { number: String(index + 1) })}
        </Text>
        <Stepper
          label={t('studio.editor.trimStart')}
          value={clip.trimStart}
          step={TRIM_STEP}
          decreaseLabel={t('studio.editor.decrease')}
          increaseLabel={t('studio.editor.increase')}
          onChange={(v) => edit(updateClip(timeline, index, { trimStart: v }, source))}
        />
        <Stepper
          label={t('studio.editor.trimEnd')}
          value={clip.trimEnd ?? source}
          step={TRIM_STEP}
          decreaseLabel={t('studio.editor.decrease')}
          increaseLabel={t('studio.editor.increase')}
          onChange={(v) => edit(updateClip(timeline, index, { trimEnd: v }, source))}
        />

        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{t('studio.editor.transition')}</Text>
        <View className="mb-3 flex-row flex-wrap" style={{ gap: 8 }}>
          {TRANSITIONS.map((kind) => {
            const on = clip.transitionIn === kind;
            return (
              <Pressable
                key={kind}
                onPress={() => edit(updateClip(timeline, index, { transitionIn: kind, transitionDuration: kind === 'cut' ? 0 : clip.transitionDuration || 0.5 }, source))}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                className="rounded-full border px-3 py-2"
                style={{ minHeight: 40, justifyContent: 'center', borderColor: on ? P.accent : P.border, backgroundColor: on ? `${P.accent}55` : 'transparent' }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: on ? '700' : '500' }}>{t(`studio.editor.transition.${kind}`)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ opacity: clip.transitionIn === 'cut' ? 0.4 : 1 }} pointerEvents={clip.transitionIn === 'cut' ? 'none' : 'auto'}>
          <Stepper
            label={t('studio.editor.transitionDuration')}
            value={clip.transitionDuration}
            step={TRANSITION_STEP}
            decreaseLabel={t('studio.editor.decrease')}
            increaseLabel={t('studio.editor.increase')}
            onChange={(v) => edit(updateClip(timeline, index, { transitionDuration: v }, source))}
          />
        </View>
      </View>

      <View className="mt-4 rounded-2xl border p-3" style={{ borderColor: P.border, backgroundColor: surface }}>
        <View className="mb-2 flex-row items-center" style={{ gap: 6 }}>
          <StudioIcon name="scissors" size={16} color={colors.textSecondary} />
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{t('studio.editor.timeline')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{`· ${t('studio.editor.videoTrack')}`}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {clips.map((c, i) => {
            const s = sceneById(c.shotId);
            const length = Math.max(0, (c.trimEnd ?? 0) - c.trimStart);
            const active = i === index;
            return (
              <View
                key={`${c.shotId}-${i}`}
                className="rounded-xl border p-2"
                style={{ width: 150, borderColor: active ? P.accent : P.border, backgroundColor: active ? `${P.accent}30` : 'transparent' }}
              >
                <Pressable onPress={() => setSelected(i)} accessibilityRole="button">
                  <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                    {t('studio.scenes.sceneNumber', { number: String(sceneNumber(c.shotId)) })}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 10 }}>
                    {s?.location || t('studio.scenes.untitled')}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>
                    {`${length.toFixed(1)}s · ${t(`studio.editor.transition.${c.transitionIn}`)}`}
                  </Text>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: `${P.accent}55`, marginTop: 6 }}>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: P.accent, width: `${Math.min(100, (length / Math.max(0.1, clipSourceSeconds(s))) * 100)}%` }} />
                  </View>
                </Pressable>
                <View className="mt-1 flex-row justify-between">
                  <Pressable
                    disabled={i === 0 || working}
                    onPress={() => {
                      edit(moveClip(timeline, i, -1));
                      setSelected(i - 1);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('studio.editor.moveEarlier')}
                    style={{ opacity: i === 0 || working ? 0.3 : 1, minWidth: 44, minHeight: 40, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <StudioIcon name="arrow-left" size={14} color={colors.textPrimary} />
                  </Pressable>
                  <Pressable
                    disabled={i === clips.length - 1 || working}
                    onPress={() => {
                      edit(moveClip(timeline, i, 1));
                      setSelected(i + 1);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('studio.editor.moveLater')}
                    style={{ opacity: i === clips.length - 1 || working ? 0.3 : 1, minWidth: 44, minHeight: 40, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <StudioIcon name="arrow-right" size={14} color={colors.textPrimary} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {error ? (
        <View className="mt-3 flex-row" style={{ gap: 6 }} accessibilityLiveRegion="assertive">
          <View style={{ marginTop: 2 }}>
            <StudioIcon name="triangle-alert" size={16} color="#EF4444" />
          </View>
          <Text style={{ color: '#EF4444', fontSize: 12, flex: 1 }}>{error}</Text>
        </View>
      ) : null}

      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 16 }}>{t('studio.editor.footer')}</Text>
      <View className="mt-3 flex-row flex-wrap items-center" style={{ gap: 10 }}>
        <StudioButton
          label={t('studio.editor.continue')}
          icon="arrow-right"
          iconAfter
          loading={busy === 'continue'}
          loadingLabel={t('studio.common.saving')}
          disabled={!saved || (working && busy !== 'continue')}
          onPress={() => void goNext()}
        />
      </View>
    </ScrollView>
  );
}

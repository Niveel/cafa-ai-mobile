import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import { useAppTheme, useI18n, useReducedMotionPreference } from '@/hooks';
import { API_BASE_URL } from '@/lib/client/base-url';

import {
  VIDEO_LENGTHS,
  applyDraft,
  isSceneDraftComplete,
  resolveAssetUrl,
  resolveCharacterImage,
  resolveSceneImage,
  videoBlockReason,
  type SceneDraft,
} from '../domain/rules';
import { SCENE_TEXT_FIELDS, type Character, type Scene } from '../domain/types';
import { SceneClipPlayer } from './SceneClipPlayer';
import { StudioButton } from './StudioButton';
import { StudioIcon } from './StudioIcon';
import { StudioImageViewer } from './StudioImageViewer';
import { StudioPushNudge } from './StudioPushNudge';
import { ICON, useStudioPalette } from '../theme';

// Every scene field holds sentences, so all of them wrap onto several lines; only the location stays a single line.
const WIDE: readonly string[] = ['description', 'actions', 'dialogue', 'cameraDirection', 'lighting', 'environment', 'mood', 'sound'];

const ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return API_BASE_URL;
  }
})();
const CAPTION_INTERVAL_MS = 3_200;

type Props = {
  scene: Scene;
  /** All scenes (sorted), for the switcher so users can jump straight to another scene. */
  scenes: Scene[];
  onSelectScene: (scene: Scene) => void;
  draft: SceneDraft;
  characters: Character[];
  dirty: boolean;
  videoBusy: boolean;
  busy: 'save' | 'image' | 'delete' | null;
  error: string | null;
  notice: string | null;
  onChange: (patch: Partial<SceneDraft>) => void;
  onToggleCharacter: (id: string) => void;
  onSetCharacters: (ids: string[]) => void;
  onSave: () => void;
  onGenerateImage: () => void;
  onGenerateVideo: () => void;
  onCancelVideo: () => void;
  onDelete: () => void;
  onBack: () => void;
};

export function SceneEditor({
  scene,
  scenes,
  onSelectScene,
  draft,
  characters,
  dirty,
  videoBusy,
  busy,
  error,
  notice,
  onChange,
  onToggleCharacter,
  onSetCharacters,
  onSave,
  onGenerateImage,
  onGenerateVideo,
  onCancelVideo,
  onDelete,
  onBack,
}: Props) {
  const { colors } = useAppTheme();
  const P = useStudioPalette();
  const { t } = useI18n();
  const reduceMotion = useReducedMotionPreference();
  const surface = P.surface;

  const applied = applyDraft(scene, draft);
  const image = resolveAssetUrl(resolveSceneImage(scene), ORIGIN);
  const clip = scene.status === 'ready' && scene.rawClipUrl ? resolveAssetUrl(scene.rawClipUrl, ORIGIN) : null;
  const block = videoBlockReason(applied, characters);
  const working = busy !== null || videoBusy;
  const imageReady = isSceneDraftComplete(applied);
  const allSelected = characters.length > 0 && characters.every((c) => draft.ingredientIds.includes(c.id));

  const [viewer, setViewer] = useState<string | null>(null);
  const [captionIndex, setCaptionIndex] = useState(0);
  useEffect(() => {
    if (!videoBusy || reduceMotion) return;
    const timer = setInterval(() => setCaptionIndex((i) => (i + 1) % 4), CAPTION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [videoBusy, reduceMotion]);

  const inputStyle = (wide: boolean) => ({
    borderColor: P.border,
    color: colors.textPrimary,
    backgroundColor: surface,
    minHeight: wide ? 80 : 44,
    paddingVertical: wide ? 10 : 0,
  });

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="mb-3 self-start">
        <StudioButton label={t('studio.scenes.backToList')} icon="arrow-left" variant="outline" compact onPress={onBack} />
      </View>

      {scenes.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
          {scenes.map((s, i) => {
            const on = s.id === scene.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => onSelectScene(s)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                className="flex-row items-center rounded-full border px-3"
                style={{ minHeight: 40, gap: 6, borderColor: on ? P.accent : P.border, backgroundColor: on ? `${P.accent}55` : surface }}
              >
                {s.status === 'ready' ? <StudioIcon name="check" size={14} color="#16A34A" /> : null}
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: on ? '700' : '500' }}>
                  {t('studio.scenes.sceneNumber', { number: String(i + 1) })}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Preview: the finished clip, else the scene image (with the progress overlay while the video renders), else the empty text. */}
      {clip && !videoBusy ? (
        <SceneClipPlayer uri={clip} />
      ) : (
        <Pressable
          disabled={!image || videoBusy}
          onPress={() => image && setViewer(image)}
          accessibilityRole="imagebutton"
          className="items-center justify-center overflow-hidden rounded-2xl border"
          style={{ borderColor: P.border, backgroundColor: surface, height: 240 }}
        >
          {image ? (
            <ExpoImage source={{ uri: image }} style={{ width: '100%', height: '100%', opacity: videoBusy ? 0.3 : 1 }} contentFit="cover" transition={200} />
          ) : busy === 'image' ? (
            <StudioIcon name="loader-circle" size={24} color={ICON} />
          ) : (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <StudioIcon name="image" size={28} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('studio.scenes.noImage')}</Text>
            </View>
          )}
          {videoBusy ? (
            <View
              style={{ position: 'absolute', alignItems: 'center', paddingHorizontal: 16 }}
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={t('studio.scenes.generatingVideoA11y')}
            >
              <View>
                <View style={{ width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: `${P.accent}33` }}>
                  <StudioIcon name="clapperboard" size={28} color={ICON} />
                </View>
                <View
                  style={{ position: 'absolute', right: -8, top: -8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB' }}
                >
                  <StudioIcon name="wand-sparkles" size={20} color="#FFFFFF" />
                </View>
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 14 }}>{t('studio.scenes.videoOverlayTitle')}</Text>
              {/* Hidden from screen readers: the container announces once instead of on every caption. */}
              <Text
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
                style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'center' }}
              >
                {t(`studio.scenes.caption${captionIndex + 1}`)}
              </Text>
            </View>
          ) : null}
        </Pressable>
      )}
      {videoBusy ? <StudioPushNudge /> : null}
      {busy === 'image' ? <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>{t('studio.scenes.generatingImage')}</Text> : null}

      <View className="mt-3 flex-row flex-wrap" style={{ gap: 10 }}>
        <StudioButton
          label={image ? t('studio.scenes.regenerateImage') : t('studio.scenes.generateImage')}
          icon="image-plus"
          variant="outline"
          loading={busy === 'image'}
          loadingLabel={t('studio.scenes.generatingImage')}
          disabled={!imageReady || (working && busy !== 'image')}
          onPress={onGenerateImage}
        />
        <StudioButton
          label={scene.status === 'ready' ? t('studio.scenes.regenerateVideo') : t('studio.scenes.generateVideo')}
          icon="video"
          loading={videoBusy}
          loadingLabel={t('studio.scenes.generatingVideo')}
          disabled={block !== null || (working && !videoBusy)}
          onPress={onGenerateVideo}
        />
      </View>
      {block ? (
        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }}>{t(`studio.scenes.block.${block}`)}</Text>
      ) : (
        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }}>{t('studio.scenes.costNote')}</Text>
      )}
      {videoBusy ? (
        <View className="mt-3 self-start">
          <StudioButton label={t('studio.scenes.cancelVideo')} icon="x" variant="outline" compact onPress={onCancelVideo} />
        </View>
      ) : null}
      {error ? (
        <View className="mt-2 flex-row" style={{ gap: 6 }} accessibilityLiveRegion="assertive">
          <View style={{ marginTop: 2 }}>
            <StudioIcon name="triangle-alert" size={16} color="#EF4444" />
          </View>
          <Text style={{ color: '#EF4444', fontSize: 12, flex: 1 }}>{error}</Text>
        </View>
      ) : null}
      {notice ? (
        <View className="mt-2 flex-row items-center" style={{ gap: 6 }}>
          <StudioIcon name="circle-check" size={16} color="#16A34A" />
          <Text style={{ color: '#16A34A', fontSize: 12 }}>{notice}</Text>
        </View>
      ) : null}


      <View style={{ marginTop: 16 }}>
        {SCENE_TEXT_FIELDS.map((field) => {
          const wide = WIDE.includes(field);
          return (
            <View key={field} style={{ marginBottom: 14 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{t(`studio.scene.field.${field}`)}</Text>
              <TextInput
                value={draft[field]}
                onChangeText={(v) => onChange({ [field]: v })}
                editable={!working}
                multiline={wide}
                textAlignVertical={wide ? 'top' : 'center'}
                placeholderTextColor={colors.textSecondary}
                className="rounded-xl border px-3"
                style={inputStyle(wide)}
              />
            </View>
          );
        })}

        <View style={{ marginBottom: 14 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{t('studio.scenes.duration')}</Text>
          <TextInput
            value={draft.targetDurationSeconds}
            onChangeText={(v) => onChange({ targetDurationSeconds: v.replace(/[^0-9]/g, '') })}
            editable={!working}
            keyboardType="number-pad"
            className="rounded-xl border px-3"
            style={inputStyle(false)}
          />
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>{t('studio.scenes.durationHint')}</Text>
        </View>

        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{t('studio.scenes.videoLength')}</Text>
        <View className="mb-4 flex-row flex-wrap" style={{ gap: 8 }}>
          {VIDEO_LENGTHS.map((seconds) => {
            const selected = draft.videoDurationSeconds === seconds;
            return (
              <Pressable
                key={seconds}
                disabled={working}
                onPress={() => onChange({ videoDurationSeconds: seconds })}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className="rounded-full border px-3 py-2"
                style={{ minHeight: 40, justifyContent: 'center', borderColor: selected ? P.accent : P.border, backgroundColor: selected ? `${P.accent}55` : surface }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: selected ? '700' : '500' }}>
                  {t('studio.scenes.videoLengthOption', { seconds: String(seconds) })}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mb-2 flex-row items-center justify-between">
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{t('studio.scenes.characters')}</Text>
          {characters.length > 0 ? (
            <Pressable
              disabled={working}
              onPress={() => onSetCharacters(allSelected ? [] : characters.map((c) => c.id))}
              accessibilityRole="button"
              className="flex-row items-center"
              style={{ gap: 6, minHeight: 36 }}
            >
              <StudioIcon name={allSelected ? 'square' : 'check-check'} size={14} color={ICON} />
              <Text style={{ color: P.accentText, fontSize: 12, fontWeight: '600' }}>{allSelected ? t('studio.scenes.clearAll') : t('studio.scenes.selectAll')}</Text>
            </Pressable>
          ) : null}
        </View>
        <View className="mb-2 flex-row flex-wrap" style={{ gap: 8 }}>
          {characters.map((c) => {
            const selected = draft.ingredientIds.includes(c.id);
            const thumb = resolveAssetUrl(resolveCharacterImage(c), ORIGIN);
            return (
              <Pressable
                key={c.id}
                disabled={working}
                onPress={() => onToggleCharacter(c.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                className="flex-row items-center rounded-full border"
                style={{
                  gap: 8,
                  minHeight: 44,
                  paddingVertical: 4,
                  paddingLeft: 6,
                  paddingRight: 14,
                  maxWidth: '100%',
                  borderColor: selected ? P.accent : P.border,
                  backgroundColor: selected ? `${P.accent}55` : surface,
                }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: `${P.accent}38` }}>
                  {thumb ? <ExpoImage source={{ uri: thumb }} style={{ width: 32, height: 32 }} contentFit="cover" /> : <StudioIcon name="user-round" size={14} color={ICON} />}
                </View>
                <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 12, fontWeight: selected ? '700' : '500', flexShrink: 1 }}>{c.name || '—'}</Text>
                {selected ? <StudioIcon name="check" size={14} color={ICON} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap items-center" style={{ gap: 12 }}>
        <StudioButton
          label={t('studio.scenes.save')}
          icon="save"
          loading={busy === 'save'}
          loadingLabel={t('studio.scenes.saving')}
          disabled={!dirty || (working && busy !== 'save')}
          onPress={onSave}
        />
        <StudioButton label={t('studio.scenes.delete')} icon="trash-2" variant="danger" disabled={working} onPress={onDelete} />
      </View>

      <StudioImageViewer uri={viewer} title={t('studio.scenes.title')} onClose={() => setViewer(null)} />
    </ScrollView>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import { AppPromptModal } from '@/components';
import { useAppTheme, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib/client/base-url';

import { movieStudioApi } from '../data/api';
import {
  canContinueToScenes,
  characterDraftPayload,
  characterReadyForScenes,
  characterToDraft,
  isCharacterComplete,
  isCharacterDraftComplete,
  isCharacterDraftDirty,
  resolveAssetUrl,
  resolveCharacterImage,
  type CharacterDraft,
} from '../domain/rules';
import { CHARACTER_FIELDS, type Character, type CharacterField, type Project } from '../domain/types';
import { useLatest } from '../hooks/useLatest';
import { StudioButton } from './StudioButton';
import { StudioIcon } from './StudioIcon';
import { StudioImageViewer } from './StudioImageViewer';
import { pickAndUploadStudioPhoto, type StudioPhoto } from '../data/photo';
import { ICON, useStudioPalette } from '../theme';

const WIDE_FIELDS: readonly CharacterField[] = ['appearance', 'clothing', 'personality', 'background', 'otherCharacteristics'];

const ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return API_BASE_URL;
  }
})();

type Props = {
  project: Project;
  onContinue: () => void;
  /** Auto flow only: Manual navigates with the workspace nav. */
  onBack?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};
type Busy = 'load' | 'create' | 'save' | 'image' | 'continue' | 'delete' | 'photo' | null;

const messageOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
const imageOf = (c: Character) => resolveAssetUrl(resolveCharacterImage(c), ORIGIN);

export function CharactersStage({ project, onContinue, onBack, onDirtyChange }: Props) {
  const { colors } = useAppTheme();
  const P = useStudioPalette();
  const { t } = useI18n();
  const tRef = useLatest(t);
  const surface = P.surface;

  const [characters, setCharacters] = useState<Character[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CharacterDraft | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState<Busy>('load');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Character the user tapped in the switcher while the open one had unsaved edits.
  const [pendingOpen, setPendingOpen] = useState<Character | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Photo chosen for the character being created (already uploaded; sent as referenceImageUrl on create).
  const [newPhoto, setNewPhoto] = useState<StudioPhoto | null>(null);

  const open = characters.find((c) => c.id === openId) ?? null;
  const dirty = open !== null && draft !== null && isCharacterDraftDirty(open, draft);
  const working = busy !== null;
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  const load = useCallback(async () => {
    setBusy('load');
    setError(null);
    try {
      setCharacters(await movieStudioApi.listCharacters(project.id));
    } catch (e) {
      setError(messageOf(e, tRef.current('studio.characters.loadFailed')));
    } finally {
      setBusy(null);
    }
  }, [project.id, tRef]);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (updated: Character) => setCharacters((list) => list.map((c) => (c.id === updated.id ? updated : c)));

  const openCharacter = (c: Character) => {
    setOpenId(c.id);
    setDraft(characterToDraft(c));
    setError(null);
    setNotice(null);
  };

  const switchTo = (c: Character) => {
    if ((open && c.id === open.id) || busy !== null) return;
    if (dirty) {
      setPendingOpen(c);
      setConfirmDiscard(true);
      return;
    }
    openCharacter(c);
  };

  const closeCharacter = () => {
    setOpenId(null);
    setDraft(null);
    setConfirmDiscard(false);
    setPendingOpen(null);
    setError(null);
    setNotice(null);
  };

  const create = async () => {
    const name = newName.trim();
    if (!name || working) return;
    setBusy('create');
    setError(null);
    try {
      const created = await movieStudioApi.createCharacter(project.id, name, newPhoto?.url ?? null);
      setCharacters((list) => [...list, created]);
      setNewName('');
      setNewPhoto(null);
      openCharacter({ ...created, name: created.name || name });
    } catch (e) {
      setError(messageOf(e, t('studio.characters.createFailed')));
    } finally {
      setBusy(null);
    }
  };

  const saveDraft = async (): Promise<Character | null> => {
    if (!open || !draft) return null;
    try {
      const updated = await movieStudioApi.patchCharacter(project.id, open.id, characterDraftPayload(draft));
      // The PATCH response carries the saved fields; keep the image URLs from the previous copy if absent.
      const merged = {
        ...open,
        ...updated,
        referenceImageUrl: updated.referenceImageUrl || open.referenceImageUrl,
        cloudinaryImageUrl: updated.cloudinaryImageUrl || open.cloudinaryImageUrl,
      };
      replace(merged);
      setDraft(characterToDraft(merged));
      return merged;
    } catch (e) {
      setError(messageOf(e, t('studio.characters.saveFailed')));
      return null;
    }
  };

  const save = async () => {
    if (!dirty || working) return;
    setBusy('save');
    setError(null);
    setNotice(null);
    if (await saveDraft()) setNotice(t('studio.characters.saved'));
    setBusy(null);
  };

  const generateImage = async () => {
    if (!open || !draft || !isCharacterDraftComplete(draft) || working) return;
    setBusy('image');
    setError(null);
    setNotice(null);
    try {
      // Save first so the image is generated from what is on screen.
      if (dirty && !(await saveDraft())) return;
      const updated = await movieStudioApi.generateCharacterImage(project.id, open.id);
      replace(updated);
      setDraft(characterToDraft(updated));
    } catch (e) {
      setError(messageOf(e, t('studio.characters.imageFailed')));
    } finally {
      setBusy(null);
    }
  };

  const pickNewPhoto = async () => {
    if (working) return;
    setBusy('photo');
    setError(null);
    try {
      const photo = await pickAndUploadStudioPhoto();
      if (photo) setNewPhoto(photo);
    } catch (e) {
      setError(messageOf(e, t('studio.characters.photoFailed')));
    } finally {
      setBusy(null);
    }
  };

  /** Use a photo from the phone as the open character's reference image instead of generating one. */
  const attachPhotoToOpen = async () => {
    if (!open || working) return;
    setBusy('photo');
    setError(null);
    setNotice(null);
    try {
      const photo = await pickAndUploadStudioPhoto();
      if (!photo) return;
      const updated = await movieStudioApi.patchCharacter(project.id, open.id, { referenceImageUrl: photo.url });
      if (!updated.referenceImageUrl && !updated.cloudinaryImageUrl) throw new Error(t('studio.characters.photoNotAccepted'));
      const merged = { ...open, ...updated, cloudinaryImageUrl: '' };
      replace(merged);
      setDraft(characterToDraft(merged));
      setNotice(t('studio.characters.photoSaved'));
    } catch (e) {
      setError(messageOf(e, t('studio.characters.photoFailed')));
    } finally {
      setBusy(null);
    }
  };

  const removeCharacter = async () => {
    if (!open || busy === 'delete') return;
    setBusy('delete');
    setError(null);
    try {
      await movieStudioApi.deleteCharacter(project.id, open.id);
      setCharacters((list) => list.filter((c) => c.id !== open.id));
      setConfirmDelete(false);
      closeCharacter();
    } catch (e) {
      setError(messageOf(e, t('studio.characters.deleteFailed')));
      setConfirmDelete(false);
    } finally {
      setBusy(null);
    }
  };

  const goNext = async () => {
    if (!canContinueToScenes(characters, dirty) || working) return;
    setBusy('continue');
    setError(null);
    try {
      await movieStudioApi.setWizardStep(project.id, 'scenes');
      onContinue();
    } catch (e) {
      setError(messageOf(e, t('studio.characters.continueFailed')));
    } finally {
      setBusy(null);
    }
  };

  const badge = (c: Character) =>
    !isCharacterComplete(c)
      ? { label: t('studio.characters.needsDetails'), color: '#D97706' }
      : !characterReadyForScenes(c)
        ? { label: t('studio.characters.needsImage'), color: '#D97706' }
        : { label: t('studio.characters.complete'), color: '#16A34A' };

  const errorBanner = error ? (
    <View className="mb-3 flex-row" style={{ gap: 6 }} accessibilityLiveRegion="assertive">
      <View style={{ marginTop: 2 }}>
        <StudioIcon name="triangle-alert" size={16} color="#EF4444" />
      </View>
      <Text style={{ color: '#EF4444', fontSize: 12, flex: 1 }}>{error}</Text>
    </View>
  ) : null;

  // Hardware back inside a character closes the character first (with the unsaved-changes check) instead of leaving the step.
  useEffect(() => {
    if (!openId) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dirty) setConfirmDiscard(true);
      else {
        setOpenId(null);
        setDraft(null);
      }
      return true;
    });
    return () => sub.remove();
  }, [openId, dirty]);

  // ---------- detail ----------
  if (open && draft) {
    const image = imageOf(open);
    const canImage = isCharacterDraftComplete(draft);
    return (
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-3 self-start">
          <StudioButton
            label={t('studio.characters.backToList')}
            icon="arrow-left"
            variant="outline"
            compact
            onPress={() => (dirty ? setConfirmDiscard(true) : closeCharacter())}
          />
        </View>

        {characters.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
            {characters.map((c) => {
              const on = c.id === open.id;
              const ready = characterReadyForScenes(c);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => switchTo(c)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  className="flex-row items-center rounded-full border px-3"
                  style={{ minHeight: 40, gap: 6, borderColor: on ? P.accent : P.border, backgroundColor: on ? `${P.accent}55` : surface }}
                >
                  <StudioIcon name={ready ? 'check' : 'user-round'} size={14} color={ready ? '#16A34A' : on ? ICON : colors.textSecondary} />
                  <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 12, fontWeight: on ? '700' : '500', maxWidth: 140 }}>
                    {c.name || '—'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View className="rounded-2xl border p-3" style={{ borderColor: P.border, backgroundColor: surface }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{t('studio.characters.imagePanel')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2, marginBottom: 10 }}>
            {t('studio.characters.imageHelp')}
          </Text>
          <Pressable
            disabled={!image || busy === 'image'}
            onPress={() => image && setViewer(image)}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('studio.characters.viewImage')}
            className="items-center justify-center overflow-hidden rounded-xl border"
            style={{ borderColor: P.border, height: 220 }}
          >
            {busy === 'image' ? (
              <View style={{ alignItems: 'center', paddingHorizontal: 16 }} accessibilityLiveRegion="polite">
                <View>
                  <StudioIcon name="image" size={20} color={ICON} />
                  <View style={{ position: 'absolute', right: -10, top: -10 }}>
                    <StudioIcon name="layers" size={16} color={ICON} />
                  </View>
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>
                  {t('studio.characters.buildingTitle')}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                  {t('studio.characters.buildingBody')}
                </Text>
              </View>
            ) : image ? (
              <ExpoImage source={{ uri: image }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
            ) : (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <StudioIcon name="image-plus" size={28} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('studio.characters.noImage')}</Text>
              </View>
            )}
          </Pressable>

          <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
            <StudioButton
              label={image ? t('studio.characters.regenerateImage') : t('studio.characters.generateImage')}
              icon="image-plus"
              variant="outline"
              loading={busy === 'image'}
              loadingLabel={t('studio.characters.generatingImage')}
              disabled={!canImage || (working && busy !== 'image')}
              onPress={() => void generateImage()}
            />
          </View>
          <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
            <StudioButton
              label={t('studio.characters.usePhoto')}
              icon="image"
              variant="outline"
              loading={busy === 'photo'}
              loadingLabel={t('studio.characters.photoUploading')}
              disabled={working && busy !== 'photo'}
              onPress={() => void attachPhotoToOpen()}
            />
          </View>
          {!canImage ? <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>{t('studio.characters.imageNeedsFields')}</Text> : null}
        </View>

        <View style={{ marginTop: 16 }}>
          {CHARACTER_FIELDS.map((field) => {
            const wide = WIDE_FIELDS.includes(field);
            const placeholderKey = `studio.character.placeholder.${field}`;
            const placeholder = field === 'name' || field === 'age' ? t(placeholderKey) : '';
            return (
              <View key={field} style={{ marginBottom: 14 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                  {t(`studio.character.field.${field}`)}
                </Text>
                <TextInput
                  value={draft[field]}
                  onChangeText={(v) => {
                    setDraft((d) => (d ? { ...d, [field]: v } : d));
                    setNotice(null);
                  }}
                  editable={!working}
                  multiline={wide}
                  textAlignVertical={wide ? 'top' : 'center'}
                  placeholder={placeholder}
                  placeholderTextColor={colors.textSecondary}
                  className="rounded-xl border px-3"
                  style={{
                    borderColor: P.border,
                    color: colors.textPrimary,
                    backgroundColor: surface,
                    minHeight: wide ? 80 : 44,
                    paddingVertical: wide ? 10 : 0,
                  }}
                />
              </View>
            );
          })}
        </View>

        {errorBanner}
        {notice ? (
          <View className="mb-3 flex-row items-center" style={{ gap: 6 }}>
            <StudioIcon name="circle-check" size={16} color="#16A34A" />
            <Text style={{ color: '#16A34A', fontSize: 12 }}>{notice}</Text>
          </View>
        ) : null}

        <View className="flex-row flex-wrap items-center" style={{ gap: 12 }}>
          <StudioButton
            label={t('studio.characters.save')}
            icon="save"
            loading={busy === 'save'}
            loadingLabel={t('studio.characters.saving')}
            disabled={!dirty || (working && busy !== 'save')}
            onPress={() => void save()}
          />
          <StudioButton label={t('studio.characters.delete')} icon="trash-2" variant="danger" disabled={working} onPress={() => setConfirmDelete(true)} />
        </View>

        <StudioImageViewer uri={viewer} title={draft.name || t('studio.characters.imagePanel')} onClose={() => setViewer(null)} />

        <AppPromptModal
          visible={confirmDelete}
          icon={<StudioIcon name="trash-2" size={20} color="#EF4444" />}
          iconBackground="#EF444422"
          confirmTone="danger"
          title={t('studio.characters.deleteTitle')}
          message={t('studio.characters.deleteMessage')}
          confirmLabel={busy === 'delete' ? t('studio.common.deleting') : t('studio.characters.delete')}
          cancelLabel={t('studio.common.cancel')}
          onConfirm={() => void removeCharacter()}
          onCancel={() => setConfirmDelete(false)}
          onDismiss={() => setConfirmDelete(false)}
        />

        <AppPromptModal
          visible={confirmDiscard}
          icon={<StudioIcon name="triangle-alert" size={20} color="#F59E0B" />}
          iconBackground="#F59E0B22"
          confirmTone="danger"
          title={t('studio.characters.discardTitle')}
          message={t('studio.characters.discardMessage')}
          confirmLabel={t('studio.characters.discard')}
          cancelLabel={t('studio.common.cancel')}
          onConfirm={() => {
            const next = pendingOpen;
            setConfirmDiscard(false);
            setPendingOpen(null);
            if (next) openCharacter(next);
            else closeCharacter();
          }}
          onCancel={() => {
            setConfirmDiscard(false);
            setPendingOpen(null);
          }}
          onDismiss={() => {
            setConfirmDiscard(false);
            setPendingOpen(null);
          }}
        />
      </ScrollView>
    );
  }

  // ---------- list ----------
  const allReady = canContinueToScenes(characters, false);
  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>{t('studio.characters.title')}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 16 }}>
        {t('studio.characters.subtitle')}
      </Text>

      {busy === 'load' ? (
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <ActivityIndicator color={ICON} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('studio.characters.loading')}</Text>
        </View>
      ) : null}
      {busy !== 'load' && characters.length === 0 && !error ? (
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>{t('studio.characters.empty')}</Text>
      ) : null}

      {characters.map((c) => {
        const image = imageOf(c);
        const b = badge(c);
        return (
          <Pressable
            key={c.id}
            onPress={() => openCharacter(c)}
            accessibilityRole="button"
            className="mb-3 flex-row items-center rounded-2xl border p-3"
            style={{ borderColor: P.border, backgroundColor: surface }}
          >
            <View className="mr-3 items-center justify-center overflow-hidden rounded-xl" style={{ width: 56, height: 56, backgroundColor: `${P.accent}38` }}>
              {image ? <ExpoImage source={{ uri: image }} style={{ width: 56, height: 56 }} contentFit="cover" /> : <StudioIcon name="user-round" size={16} color={ICON} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>
                {c.name || '—'}
              </Text>
              <Text style={{ color: b.color, fontSize: 12, fontWeight: '600', marginTop: 2 }}>{b.label}</Text>
            </View>
            <StudioIcon name="arrow-right" size={16} color={colors.textSecondary} />
          </Pressable>
        );
      })}

      <View className="mt-2 flex-row items-center" style={{ gap: 8 }}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          editable={!working}
          placeholder={t('studio.characters.namePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          className="rounded-xl border px-3"
          style={{ flex: 1, borderColor: P.border, color: colors.textPrimary, backgroundColor: surface, height: 44 }}
        />
        <Pressable
          disabled={working}
          onPress={() => void pickNewPhoto()}
          accessibilityRole="button"
          accessibilityLabel={newPhoto ? t('studio.characters.changePhotoA11y') : t('studio.characters.addPhotoA11y')}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: newPhoto ? P.accent : P.border,
            backgroundColor: surface,
            opacity: working && busy !== 'photo' ? 0.5 : 1,
          }}
        >
          {newPhoto ? (
            <ExpoImage source={{ uri: newPhoto.localUri }} style={{ width: 44, height: 44 }} contentFit="cover" />
          ) : (
            <StudioIcon name={busy === 'photo' ? 'loader-circle' : 'image-plus'} size={16} color={ICON} />
          )}
        </Pressable>
        <Pressable
          disabled={!newName.trim() || working}
          onPress={() => void create()}
          accessibilityRole="button"
          accessibilityLabel={t('studio.characters.createA11y')}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: P.accent,
            opacity: !newName.trim() || working ? 0.5 : 1,
          }}
        >
          <StudioIcon name={busy === 'create' ? 'loader-circle' : 'plus'} size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={{ marginTop: 12 }}>{errorBanner}</View>

      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 12 }}>
        {allReady ? t('studio.characters.ready') : t('studio.characters.continueHint')}
      </Text>
      {!allReady && characters.some((c) => !characterReadyForScenes(c)) ? (
        <Text style={{ color: '#D97706', fontSize: 12, fontWeight: '600', marginTop: 4 }}>
          {t('studio.characters.missing', {
            names: characters
              .filter((c) => !characterReadyForScenes(c))
              .map((c) => c.name || '—')
              .join(', '),
          })}
        </Text>
      ) : null}
      <View className="mt-3 flex-row flex-wrap items-center" style={{ gap: 10 }}>
        {onBack ? <StudioButton label={t('studio.common.back')} icon="arrow-left" variant="outline" disabled={working} onPress={onBack} /> : null}
        <StudioButton
          label={t('studio.characters.continue')}
          icon="arrow-right"
          iconAfter
          loading={busy === 'continue'}
          loadingLabel={t('studio.characters.preparing')}
          disabled={!allReady || (working && busy !== 'continue')}
          onPress={() => void goNext()}
        />
      </View>
    </ScrollView>
  );
}

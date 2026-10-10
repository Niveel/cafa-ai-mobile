import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import { AppPromptModal } from '@/components';
import { useAppTheme, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib/client/base-url';

import { movieStudioApi } from '../data/api';
import { emitStudioGate } from '../data/events';
import { runSceneVideoJob, isSceneBusy } from '../domain/jobs';
import {
  applyDraft,
  canContinueToEditor,
  isSceneDraftComplete,
  isSceneDraftDirty,
  nextSceneOrder,
  resolveAssetUrl,
  resolveSceneImage,
  sceneDraftPayload,
  sceneToDraft,
  sortScenes,
  swapOrders,
  videoBlockReason,
  type SceneDraft,
} from '../domain/rules';
import type { Character, Project, Scene } from '../domain/types';
import { useLatest } from '../hooks/useLatest';
import { SceneEditor } from './SceneEditor';
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

type Props = {
  project: Project;
  onContinue: () => void;
  /** Auto flow only: Manual navigates with the workspace nav. */
  onBack?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};
type ListBusy = 'load' | 'extract' | 'add' | 'reorder' | 'continue' | null;
type DetailBusy = 'save' | 'image' | 'delete' | null;

const messageOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function ScenesStage({ project, onContinue, onBack, onDirtyChange }: Props) {
  const { colors, isDark } = useAppTheme();
  const P = useStudioPalette();
  const { t } = useI18n();
  const tRef = useLatest(t);
  const surface = P.surface;

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SceneDraft | null>(null);
  // The draft as it was when the scene was opened (or last saved): the unsaved-changes guard compares against this,
  // so the automatic "all characters" default does not count as the user having edited something.
  const [baseDraft, setBaseDraft] = useState<SceneDraft | null>(null);
  const [listBusy, setListBusy] = useState<ListBusy>('load');
  const [detailBusy, setDetailBusy] = useState<DetailBusy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emptyNotice, setEmptyNotice] = useState(false);
  const [videoErrors, setVideoErrors] = useState<Record<string, string>>({});
  const [pendingVideo, setPendingVideo] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Scene | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Scene the user tapped in the switcher while the open one had unsaved edits.
  const [pendingScene, setPendingScene] = useState<Scene | null>(null);

  // Scene ids whose character selection the user has touched (stops re-defaulting to "all characters").
  const touched = useRef(new Set<string>());
  // Per-scene lock: one active job per scene. Cancelled on unmount; the server job keeps running.
  const jobs = useRef(new Map<string, { aborted: boolean }>());
  const scenesRef = useRef<Scene[]>([]);
  scenesRef.current = scenes;

  const open = scenes.find((s) => s.id === openId) ?? null;
  const dirty = open !== null && draft !== null && isSceneDraftDirty(open, draft);
  const edited = draft !== null && baseDraft !== null && JSON.stringify(draft) !== JSON.stringify(baseDraft);
  const listWorking = listBusy !== null;
  useEffect(() => {
    onDirtyChange?.(edited);
    return () => onDirtyChange?.(false);
  }, [edited, onDirtyChange]);

  const replaceScene = useCallback((updated: Scene) => {
    setScenes((list) => sortScenes(list.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))));
  }, []);

  // ---------- video jobs ----------
  const startJob = useCallback(
    (scene: Scene) => {
      if (jobs.current.has(scene.id)) return;
      const signal = { aborted: false };
      jobs.current.set(scene.id, signal);
      setPendingVideo((p) => new Set(p).add(scene.id));
      setVideoErrors((e) => {
        const { [scene.id]: _removed, ...rest } = e;
        return rest;
      });

      // The charge lands when the job starts, so refresh the balance chip as soon as the server reports the clip running.
      let announced = false;
      const onUpdate = (updated: Scene) => {
        if (!announced && isSceneBusy(updated)) {
          announced = true;
          emitStudioGate('credits_changed');
        }
        replaceScene(updated);
      };

      runSceneVideoJob(
        scene,
        { start: (id) => movieStudioApi.startSceneVideo(project.id, id), status: (id) => movieStudioApi.sceneStatus(project.id, id) },
        { sleep, signal, onUpdate },
      )
        .then((outcome) => {
          if (outcome.kind === 'aborted') return;
          // The charge lands when the job starts, so the balance chip changes on success as well.
          emitStudioGate('credits_changed');
          if (outcome.kind === 'ready') return replaceScene(outcome.value);
          // A failed or cancelled job should be refunded server-side.
          const fallback = tRef.current(outcome.kind === 'timedOut' ? 'studio.scenes.videoSlow' : 'studio.scenes.videoFailed');
          setVideoErrors((e) => ({ ...e, [scene.id]: outcome.message || fallback }));
        })
        .catch((e) => setVideoErrors((errs) => ({ ...errs, [scene.id]: messageOf(e, tRef.current('studio.scenes.videoFailed')) })))
        .finally(() => {
          jobs.current.delete(scene.id);
          setPendingVideo((p) => {
            const next = new Set(p);
            next.delete(scene.id);
            return next;
          });
        });
    },
    [project.id, replaceScene, tRef],
  );

  /** Re-attach to any scene the server is still rendering (screen entry and app resume). */
  const resumeBusyJobs = useCallback(() => {
    scenesRef.current.filter(isSceneBusy).forEach(startJob);
  }, [startJob]);

  const load = useCallback(async () => {
    setListBusy('load');
    setError(null);
    try {
      const [list, chars] = await Promise.all([movieStudioApi.listScenes(project.id), movieStudioApi.listCharacters(project.id)]);
      setCharacters(chars);
      setScenes(sortScenes(list));
      scenesRef.current = sortScenes(list);
      resumeBusyJobs();
    } catch (e) {
      setError(messageOf(e, tRef.current('studio.scenes.loadFailed')));
    } finally {
      setListBusy(null);
    }
  }, [project.id, resumeBusyJobs, tRef]);

  useEffect(() => {
    void load();
    const active = jobs.current;
    return () => {
      active.forEach((signal) => {
        signal.aborted = true;
      });
    };
  }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') resumeBusyJobs();
    });
    return () => sub.remove();
  }, [resumeBusyJobs]);

  // ---------- list actions ----------
  const openScene = (scene: Scene) => {
    const initial = sceneToDraft(scene, characters, touched.current.has(scene.id));
    setOpenId(scene.id);
    setDraft(initial);
    setBaseDraft(initial);
    setError(null);
    setNotice(null);
  };

  const switchScene = (scene: Scene) => {
    if ((open && scene.id === open.id) || detailBusy !== null) return;
    if (edited) {
      setPendingScene(scene);
      setConfirmDiscard(true);
      return;
    }
    openScene(scene);
  };

  const closeScene = () => {
    setOpenId(null);
    setDraft(null);
    setBaseDraft(null);
    setConfirmDiscard(false);
    setPendingScene(null);
    setError(null);
    setNotice(null);
  };

  const extract = async () => {
    if (scenes.length > 0 || listWorking) return; // extraction appends; only run on an empty list
    setListBusy('extract');
    setError(null);
    setEmptyNotice(false);
    try {
      await movieStudioApi.extractScenes(project.id);
      const list = sortScenes(await movieStudioApi.listScenes(project.id));
      setScenes(list);
      if (list.length === 0) setEmptyNotice(true);
    } catch (e) {
      setError(messageOf(e, t('studio.scenes.createFailed')));
    } finally {
      setListBusy(null);
    }
  };

  const addManual = async () => {
    if (listWorking) return;
    setListBusy('add');
    setError(null);
    try {
      const created = await movieStudioApi.createScene(project.id, nextSceneOrder(scenes));
      setScenes((list) => sortScenes([...list, created]));
      setEmptyNotice(false);
      openScene(created);
    } catch (e) {
      setError(messageOf(e, t('studio.scenes.createFailed')));
    } finally {
      setListBusy(null);
    }
  };

  const move = async (index: number, delta: -1 | 1) => {
    const a = scenes[index];
    const b = scenes[index + delta];
    if (!a || !b || listWorking) return;
    setListBusy('reorder');
    setError(null);
    const [first, second] = swapOrders(a, b);
    try {
      // Two independent PATCHes (not atomic): any failure reloads the list from the server.
      await Promise.all([
        movieStudioApi.patchScene(project.id, first.id, { order: first.order }),
        movieStudioApi.patchScene(project.id, second.id, { order: second.order }),
      ]);
      setScenes((list) =>
        sortScenes(list.map((s) => (s.id === first.id ? { ...s, order: first.order } : s.id === second.id ? { ...s, order: second.order } : s))),
      );
    } catch {
      try {
        setScenes(sortScenes(await movieStudioApi.listScenes(project.id)));
      } catch {
        // keep current list
      }
      setError(t('studio.scenes.reorderFailed'));
    } finally {
      setListBusy(null);
    }
  };

  const goNext = async () => {
    if (!canContinueToEditor(scenes, false) || listWorking) return;
    setListBusy('continue');
    setError(null);
    try {
      await movieStudioApi.setWizardStep(project.id, 'video_editor');
      await movieStudioApi.patchProject(project.id, { status: 'in_progress' }).catch(() => undefined);
      onContinue();
    } catch (e) {
      setError(messageOf(e, t('studio.scenes.continueFailed')));
      setListBusy(null);
    }
  };

  // ---------- detail actions ----------
  const saveDraft = async (): Promise<Scene | null> => {
    if (!open || !draft) return null;
    try {
      const updated = await movieStudioApi.patchScene(project.id, open.id, sceneDraftPayload(open, draft));
      touched.current.add(open.id);
      const merged = { ...open, ...updated };
      replaceScene(merged);
      const saved = sceneToDraft(merged, characters, true);
      setDraft(saved);
      setBaseDraft(saved);
      return merged;
    } catch (e) {
      setError(messageOf(e, t('studio.scenes.saveFailed')));
      return null;
    }
  };

  const withDetailBusy = async (kind: Exclude<DetailBusy, null>, work: () => Promise<void>) => {
    setDetailBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await work();
    } finally {
      setDetailBusy(null);
    }
  };

  const save = () =>
    withDetailBusy('save', async () => {
      if (await saveDraft()) setNotice(t('studio.scenes.saved'));
    });

  const generateImage = () =>
    withDetailBusy('image', async () => {
      if (!open || !draft) return;
      if (!isSceneDraftComplete(applyDraft(open, draft))) {
        setError(tRef.current('studio.scenes.block.incomplete'));
        return;
      }
      try {
        const current = dirty ? await saveDraft() : open;
        if (!current) return;
        replaceScene(await movieStudioApi.generateSceneImage(project.id, current.id));
      } catch (e) {
        setError(messageOf(e, t('studio.scenes.imageFailed')));
      }
    });

  const generateVideo = async () => {
    if (!open || !draft || jobs.current.has(open.id)) return;
    if (videoBlockReason(applyDraft(open, draft), characters) !== null) return;
    setError(null);
    setNotice(null);
    let current: Scene | null = open;
    if (dirty) {
      setDetailBusy('save');
      current = await saveDraft();
      setDetailBusy(null);
    }
    // Resumes polling (no second start) if the server already has this scene queued or generating.
    if (current) startJob(current);
  };

  const cancelVideo = async () => {
    if (!open) return;
    const sceneId = open.id;
    setError(null);
    try {
      const updated = await movieStudioApi.cancelSceneVideo(project.id, sceneId);
      replaceScene(updated);
      // Stop polling only once the server confirms the clip is no longer running.
      if (!isSceneBusy(updated)) {
        const signal = jobs.current.get(sceneId);
        if (signal) signal.aborted = true;
        setPendingVideo((p) => {
          const next = new Set(p);
          next.delete(sceneId);
          return next;
        });
      }
      emitStudioGate('credits_changed');
    } catch (e) {
      setError(messageOf(e, tRef.current('studio.scenes.cancelFailed')));
    }
  };

  const deleteScene = async (scene: Scene) => {
    setDetailBusy('delete');
    setError(null);
    try {
      await movieStudioApi.deleteScene(project.id, scene.id);
      setScenes((list) => list.filter((s) => s.id !== scene.id));
      setDeleteTarget(null);
      if (openId === scene.id) closeScene();
    } catch (e) {
      setError(messageOf(e, t('studio.scenes.deleteFailed')));
      setDeleteTarget(null);
    } finally {
      setDetailBusy(null);
    }
  };

  const deleteModal = (
    <AppPromptModal
      visible={deleteTarget !== null}
      icon={<StudioIcon name="trash-2" size={20} color="#EF4444" />}
      iconBackground="#EF444422"
      confirmTone="danger"
      title={t('studio.scenes.deleteTitle')}
      message={t('studio.scenes.deleteMessage')}
      confirmLabel={detailBusy === 'delete' ? t('studio.common.deleting') : t('studio.scenes.delete')}
      cancelLabel={t('studio.common.cancel')}
      onConfirm={() => deleteTarget && void deleteScene(deleteTarget)}
      onCancel={() => setDeleteTarget(null)}
      onDismiss={() => setDeleteTarget(null)}
    />
  );

  // Hardware back inside a scene closes the scene first (with the unsaved-changes check) instead of leaving the step.
  useEffect(() => {
    if (!openId) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (edited) setConfirmDiscard(true);
      else {
        setOpenId(null);
        setDraft(null);
        setBaseDraft(null);
      }
      return true;
    });
    return () => sub.remove();
  }, [openId, edited]);

  // ---------- detail view ----------
  if (open && draft) {
    return (
      <>
        <SceneEditor
          scene={open}
          scenes={scenes}
          onSelectScene={switchScene}
          draft={draft}
          characters={characters}
          dirty={dirty}
          videoBusy={pendingVideo.has(open.id) || isSceneBusy(open)}
          busy={detailBusy}
          error={error ?? videoErrors[open.id] ?? null}
          notice={notice}
          onChange={(patch) => {
            setDraft((d) => (d ? { ...d, ...patch } : d));
            setNotice(null);
          }}
          onToggleCharacter={(id) => {
            touched.current.add(open.id);
            setDraft((d) =>
              d ? { ...d, ingredientIds: d.ingredientIds.includes(id) ? d.ingredientIds.filter((x) => x !== id) : [...d.ingredientIds, id] } : d,
            );
          }}
          onSetCharacters={(ids) => {
            touched.current.add(open.id);
            setDraft((d) => (d ? { ...d, ingredientIds: ids } : d));
          }}
          onSave={() => void save()}
          onGenerateImage={() => void generateImage()}
          onGenerateVideo={() => void generateVideo()}
          onCancelVideo={() => void cancelVideo()}
          onDelete={() => setDeleteTarget(open)}
          onBack={() => (edited ? setConfirmDiscard(true) : closeScene())}
        />
        {deleteModal}
        <AppPromptModal
          visible={confirmDiscard}
          icon={<StudioIcon name="triangle-alert" size={20} color="#F59E0B" />}
          iconBackground="#F59E0B22"
          confirmTone="danger"
          title={t('studio.scenes.discardTitle')}
          message={t('studio.scenes.discardMessage')}
          confirmLabel={t('studio.scenes.discard')}
          cancelLabel={t('studio.common.cancel')}
          onConfirm={() => {
            const next = pendingScene;
            setConfirmDiscard(false);
            setPendingScene(null);
            if (next) openScene(next);
            else closeScene();
          }}
          onCancel={() => {
            setConfirmDiscard(false);
            setPendingScene(null);
          }}
          onDismiss={() => {
            setConfirmDiscard(false);
            setPendingScene(null);
          }}
        />
      </>
    );
  }

  // ---------- list view ----------
  const allDone = canContinueToEditor(scenes, false);
  const statusColor = (s: Scene) =>
    s.status === 'ready' ? '#16A34A' : s.status === 'failed' || s.status === 'cancelled' ? '#EF4444' : isSceneBusy(s) ? P.accentText : colors.textSecondary;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>{t('studio.scenes.title')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 16 }}>{t('studio.scenes.subtitle')}</Text>

        {listBusy === 'load' ? <ActivityIndicator color={ICON} style={{ marginTop: 16 }} /> : null}

        {listBusy !== 'load' && scenes.length === 0 ? (
          <View className="rounded-2xl border p-4" style={{ borderColor: P.border, backgroundColor: surface }}>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>{t('studio.scenes.emptyTitle')}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{t('studio.scenes.emptyBody')}</Text>
            {emptyNotice ? <Text style={{ color: '#D97706', fontSize: 12, marginTop: 10 }}>{t('studio.scenes.noneCreated')}</Text> : null}
            <View className="mt-3 flex-row flex-wrap" style={{ gap: 10 }}>
              <StudioButton
                label={t('studio.scenes.create')}
                loading={listBusy === 'extract'}
                loadingLabel={t('studio.scenes.creating')}
                disabled={listWorking && listBusy !== 'extract'}
                onPress={() => void extract()}
              />
              <StudioButton
                label={t('studio.scenes.addManual')}
                icon="plus"
                variant="outline"
                loading={listBusy === 'add'}
                disabled={listWorking && listBusy !== 'add'}
                onPress={() => void addManual()}
              />
            </View>
          </View>
        ) : null}

        {scenes.map((scene, index) => {
          const image = resolveAssetUrl(resolveSceneImage(scene), ORIGIN);
          const busyVideo = pendingVideo.has(scene.id) || isSceneBusy(scene);
          return (
            <View
              key={scene.id}
              className="mb-3 flex-row items-center rounded-2xl border p-3"
              style={{ borderColor: P.border, backgroundColor: surface }}
            >
              <Pressable onPress={() => openScene(scene)} accessibilityRole="button" className="flex-1 flex-row items-center">
                <View className="mr-3 items-center justify-center overflow-hidden rounded-xl" style={{ width: 64, height: 48, backgroundColor: `${P.accent}38` }}>
                  {image ? <ExpoImage source={{ uri: image }} style={{ width: 64, height: 48 }} contentFit="cover" /> : <StudioIcon name="image" size={20} color={ICON} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                    {t('studio.scenes.sceneNumber', { number: String(index + 1) })}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>
                    {scene.location || t('studio.scenes.untitled')}
                  </Text>
                  <Text style={{ color: statusColor(scene), fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                    {t(`studio.scenes.videoStatus.${busyVideo && !isSceneBusy(scene) ? 'queued' : scene.status}`)}
                  </Text>
                </View>
              </Pressable>
              <View style={{ marginLeft: 4, alignItems: 'center' }}>
                <Pressable
                  disabled={index === 0 || listWorking}
                  onPress={() => void move(index, -1)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('studio.scenes.moveUp')}
                  style={{ opacity: index === 0 || listWorking ? 0.3 : 1, minWidth: 40, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}
                >
                  <StudioIcon name="arrow-up" size={16} color={colors.textPrimary} />
                </Pressable>
                <Pressable
                  disabled={index === scenes.length - 1 || listWorking}
                  onPress={() => void move(index, 1)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('studio.scenes.moveDown')}
                  style={{ opacity: index === scenes.length - 1 || listWorking ? 0.3 : 1, minWidth: 40, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}
                >
                  <StudioIcon name="arrow-down" size={16} color={colors.textPrimary} />
                </Pressable>
                <Pressable
                  disabled={listWorking}
                  onPress={() => setDeleteTarget(scene)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('studio.scenes.deleteA11y', { number: String(index + 1) })}
                  style={{ minWidth: 40, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}
                >
                  <StudioIcon name="trash-2" size={16} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          );
        })}

        {scenes.length > 0 ? (
          <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            <StudioButton
              label={t('studio.scenes.add')}
              icon="plus"
              variant="outline"
              loading={listBusy === 'add'}
              disabled={listWorking && listBusy !== 'add'}
              onPress={() => void addManual()}
            />
          </View>
        ) : null}

        {error ? (
          <View className="mt-3 flex-row" style={{ gap: 6 }} accessibilityLiveRegion="assertive">
            <View style={{ marginTop: 2 }}>
              <StudioIcon name="triangle-alert" size={16} color="#EF4444" />
            </View>
            <Text style={{ color: '#EF4444', fontSize: 12, flex: 1 }}>{error}</Text>
          </View>
        ) : null}

        {scenes.length > 0 ? (
          <>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 20 }}>{allDone ? t('studio.scenes.ready') : t('studio.scenes.continueHint')}</Text>
            <View className="mt-3 flex-row flex-wrap items-center" style={{ gap: 10 }}>
              {onBack ? <StudioButton label={t('studio.common.back')} icon="arrow-left" variant="outline" disabled={listWorking} onPress={onBack} /> : null}
              <StudioButton
                label={t('studio.scenes.continue')}
                icon="arrow-right"
                iconAfter
                loading={listBusy === 'continue'}
                loadingLabel={t('studio.scenes.opening')}
                disabled={!allDone || (listWorking && listBusy !== 'continue')}
                onPress={() => void goNext()}
              />
            </View>
          </>
        ) : null}
        {deleteModal}
      </ScrollView>

      {listBusy === 'continue' ? (
        <View
          pointerEvents="auto"
          accessibilityViewIsModal
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(8,9,18,0.92)' : 'rgba(255,255,255,0.92)' }}
        >
          <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute' }}>
              <StudioIcon name="loader-circle" size={72} color={`${ICON}66`} />
            </View>
            <StudioIcon name="clapperboard" size={32} color={ICON} />
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 16 }}>{t('studio.scenes.opening')}</Text>
        </View>
      ) : null}
    </View>
  );
}

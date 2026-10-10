import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { AppPromptModal, AppScreen, RequireAuthRoute } from '@/components';
import { useAppTheme, useI18n } from '@/hooks';
import { movieStudioApi } from '@/features/movieStudio/data/api';
import { StudioButton } from '@/features/movieStudio/components/StudioButton';
import { StudioGateModals } from '@/features/movieStudio/components/StudioGateModals';
import { StudioHeaderActions } from '@/features/movieStudio/components/StudioHeaderActions';
import { StudioIcon } from '@/features/movieStudio/components/StudioIcon';
import { StudioProgress } from '@/features/movieStudio/components/StudioProgress';
import { formatHistoryDate } from '@/features/movieStudio/domain/rules';
import type { Project } from '@/features/movieStudio/domain/types';
import { AUTO_VIDEO_TYPES, MAX_TITLE_LENGTH, humanizeStep, humanizeVideoType } from '@/features/movieStudio/domain/videoTypes';
import { ICON, useStudioPalette } from '@/features/movieStudio/theme';

type Mode = 'home' | 'history' | 'auto' | 'manual';
const VISIBLE_TYPES = 6;


// Server step ids -> the same translated names the progress bar uses.
const STEP_KEYS: Record<string, string> = {
  video_type: 'studio.progress.videoType',
  script: 'studio.progress.script',
  characters: 'studio.progress.characters',
  scenes: 'studio.progress.scenes',
  video_editor: 'studio.progress.editor',
  export: 'studio.progress.export',
};
const stepLabel = (t: (key: string) => string, step: string) => (STEP_KEYS[step] ? t(STEP_KEYS[step]) : humanizeStep(step));

const byUpdatedDesc =(a: Project, b: Project) => (a.updatedAt < b.updatedAt ? 1 : -1);

export default function StudioScreen() {
  const { colors } = useAppTheme();
  const P = useStudioPalette();
  const { t } = useI18n();
  const surface = P.surface;

  const [mode, setMode] = useState<Mode>('home');
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [videoType, setVideoType] = useState<string | null>(null);
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [chooser, setChooser] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const list = await movieStudioApi.listProjects();
      setProjects(list);
      // Nothing else marks a project finished: if a project sitting at Export already has a completed
      // render (e.g. it finished on another device), mark it complete so it appears in History.
      const candidates = list.filter((p) => p.status !== 'complete' && p.currentStep === 'export').slice(0, 5);
      if (candidates.length) {
        const done = await Promise.all(
          candidates.map(async (p) => {
            try {
              const renders = await movieStudioApi.listRenders(p.id);
              return renders.some((r) => r.status === 'complete') ? await movieStudioApi.patchProject(p.id, { status: 'complete' }) : null;
            } catch {
              return null;
            }
          }),
        );
        const updates = done.filter((p): p is Project => p !== null);
        if (updates.length) setProjects((cur) => (cur ?? list).map((p) => updates.find((u) => u.id === p.id) ?? p));
      }
    } catch {
      setLoadError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openProject = (project: Project) => router.push({ pathname: '/(drawer)/studio-project', params: { id: project.id } });

  const reset = () => {
    setMode('home');
    setVideoType(null);
    setTitle('');
    setFormError(null);
    setShowAllTypes(false);
  };

  const startFlow = (flow: 'auto' | 'manual') => {
    setChooser(false);
    setFormError(null);
    setMode(flow);
  };

  const create = async () => {
    const trimmed = title.trim();
    if (!trimmed || busy || (mode === 'auto' && !videoType)) return;
    setBusy(true);
    setFormError(null);
    try {
      const project = await movieStudioApi.createProject({
        title: trimmed,
        videoType: mode === 'manual' ? 'custom_video' : (videoType as string),
        config: { workflowMode: mode === 'manual' ? 'manual' : 'auto' },
      });
      reset();
      openProject(project);
    } catch (error) {
      setFormError(error instanceof Error && error.message ? error.message : t('studio.create.failed'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await movieStudioApi.deleteProject(pendingDelete.id);
      setPendingDelete(null);
      setDeleteError(null);
      await load();
    } catch (error) {
      setDeleteError(error instanceof Error && error.message ? error.message : t('studio.delete.failed'));
    } finally {
      setDeleting(false);
    }
  };

  const unfinished = (projects ?? []).filter((p) => p.status !== 'complete').sort(byUpdatedDesc);
  const completed = (projects ?? []).filter((p) => p.status === 'complete').sort(byUpdatedDesc);
  const card = { borderColor: P.border, backgroundColor: surface };
  const typesShown = showAllTypes ? AUTO_VIDEO_TYPES : AUTO_VIDEO_TYPES.slice(0, VISIBLE_TYPES);
  const inFlowCreation = mode === 'auto' || mode === 'manual';

  const tile = (icon: 'route' | 'sliders-horizontal' | 'folder-clock' | 'film', size: number, glyph: number) => (
    <View
      style={{ width: size, height: size, borderRadius: size / 3, alignItems: 'center', justifyContent: 'center', backgroundColor: `${P.accent}55`, marginRight: 12 }}
    >
      <StudioIcon name={icon} size={glyph} color={ICON} />
    </View>
  );

  const workflowCard = (flow: 'auto' | 'manual') => (
    <View key={flow} className="mb-3 rounded-2xl border p-4" style={card}>
      <View className="flex-row items-start">
        {tile(flow === 'auto' ? 'route' : 'sliders-horizontal', 48, 24)}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>{t(`studio.workflow.${flow}.title`)}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>{t(`studio.workflow.${flow}.description`)}</Text>
        </View>
      </View>
      <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
        <StudioButton label={t(`studio.workflow.${flow}.start`)} icon="arrow-right" iconAfter onPress={() => startFlow(flow)} />
      </View>
    </View>
  );

  const projectCard = (project: Project, historyView: boolean) => (
    <View key={project.id} className="mb-3 rounded-2xl border p-3" style={card}>
      <View className="flex-row items-center">
        {tile(historyView ? 'film' : 'folder-clock', 40, 20)}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }} numberOfLines={2}>
            {project.title}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>
            {project.videoType ? humanizeVideoType(project.videoType) : t('studio.customVideo')}
          </Text>
        </View>
      </View>
      {historyView ? (
        <View className="mt-2 flex-row items-center" style={{ gap: 6 }}>
          <StudioIcon name="calendar-days" size={14} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formatHistoryDate(project.updatedAt)}</Text>
        </View>
      ) : (
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
          {t('studio.currentStep', { step: stepLabel(t, project.currentStep) })}
        </Text>
      )}
      <View className="mt-3 flex-row items-center justify-between">
        <StudioButton
          label={historyView ? t('studio.history.open') : t('studio.continue')}
          icon="arrow-right"
          iconAfter
          compact
          onPress={() => openProject(project)}
        />
        <Pressable
          onPress={() => {
            setDeleteError(null);
            setPendingDelete(project);
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('studio.delete.a11y', { title: project.title })}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <StudioIcon name="trash-2" size={16} color="#EF4444" />
        </Pressable>
      </View>
    </View>
  );

  const nav = (
    <View className="mb-4 flex-row" style={{ gap: 8 }}>
      {(
        [
          ['home', 'house', 'studio.nav.home'],
          ['history', 'history', 'studio.nav.history'],
        ] as const
      ).map(([target, glyph, key]) => {
        const on = mode === target;
        return (
          <Pressable
            key={target}
            onPress={() => setMode(target)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            className="flex-row items-center rounded-full border px-4"
            style={{ minHeight: 40, gap: 6, borderColor: on ? P.accent : P.border, backgroundColor: on ? `${P.accent}55` : 'transparent' }}
          >
            <StudioIcon name={glyph} size={16} color={on ? ICON : colors.textSecondary} />
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: on ? '700' : '500' }}>{t(key)}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderCreate = () => (
    <View>
      {mode === 'auto' ? (
        <>
          <StudioProgress stage="video-type" />
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800' }}>{t('studio.create.heading')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 12 }}>{t('studio.create.hint')}</Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {typesShown.map((type) => {
              const selected = videoType === type.id;
              return (
                <Pressable
                  key={type.id}
                  onPress={() => setVideoType(type.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className="rounded-2xl border p-3"
                  style={{ width: '48.5%', minHeight: 84, borderColor: selected ? P.accent : P.border, backgroundColor: selected ? `${P.accent}38` : surface }}
                >
                  <StudioIcon name={type.icon} size={20} color={selected ? ICON : colors.textSecondary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 8 }}>{t(`studio.type.${type.id}`)}</Text>
                </Pressable>
              );
            })}
          </View>
          {AUTO_VIDEO_TYPES.length > VISIBLE_TYPES ? (
            <Pressable
              onPress={() => setShowAllTypes((v) => !v)}
              className="flex-row items-center"
              style={{ marginTop: 12, minHeight: 44, gap: 6 }}
              accessibilityRole="button"
            >
              <Text style={{ color: P.accentText, fontSize: 13, fontWeight: '600' }}>
                {showAllTypes ? t('studio.create.viewLess') : t('studio.create.viewMore')}
              </Text>
              <View style={{ transform: [{ rotate: showAllTypes ? '180deg' : '0deg' }] }}>
                <StudioIcon name="chevron-down" size={16} color={ICON} />
              </View>
            </Pressable>
          ) : null}
        </>
      ) : (
        <View style={{ marginBottom: 14 }}>
          <View className="flex-row items-center self-start rounded-full px-3 py-1" style={{ backgroundColor: `${P.accent}55`, gap: 6 }}>
            <StudioIcon name="film" size={16} color={ICON} />
            <Text style={{ color: P.accentText, fontSize: 12, fontWeight: '700' }}>{t('studio.manual.badge')}</Text>
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 10 }}>{t('studio.manual.headline')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{t('studio.manual.intro')}</Text>
        </View>
      )}

      {mode === 'manual' || videoType ? (
        <View className={mode === 'manual' ? 'rounded-2xl border p-4' : ''} style={mode === 'manual' ? card : { marginTop: 16 }}>
          {mode === 'manual' ? (
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 10 }}>{t('studio.manual.nameCard')}</Text>
          ) : null}
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
            {mode === 'manual' ? t('studio.create.nameLabel') : t('studio.create.titleLabel')}
          </Text>
          <TextInput
            value={title}
            onChangeText={(v) => setTitle(v.slice(0, MAX_TITLE_LENGTH))}
            placeholder={mode === 'manual' ? t('studio.manual.namePlaceholder') : t('studio.create.titlePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            maxLength={MAX_TITLE_LENGTH}
            className="rounded-xl border px-3"
            style={{ borderColor: P.border, color: colors.textPrimary, height: 44, backgroundColor: P.inputBg }}
          />
          {formError ? <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 8 }}>{formError}</Text> : null}
          <View style={{ marginTop: 14, alignSelf: 'flex-start' }}>
            <StudioButton
              label={t('studio.create.submit')}
              icon={mode === 'manual' ? 'panel-top' : 'chevron-right'}
              iconAfter={mode === 'auto'}
              loading={busy}
              loadingLabel={t('studio.create.creating')}
              disabled={!title.trim() || (mode === 'auto' && !videoType)}
              onPress={() => void create()}
            />
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderHome = () => (
    <>
      <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '800' }}>{t('studio.home.title')}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 14 }}>{t('studio.home.subtitle')}</Text>

      {(['auto', 'manual'] as const).map(workflowCard)}

      {loadError ? (
        <View style={{ alignItems: 'flex-start', marginTop: 8 }}>
          <Text style={{ color: '#EF4444', fontSize: 13, marginBottom: 8 }}>{t('studio.loadFailed')}</Text>
          <StudioButton label={t('studio.retry')} variant="outline" compact onPress={() => void load()} />
        </View>
      ) : null}
      {projects === null && !loadError ? <ActivityIndicator color={ICON} style={{ marginTop: 16 }} /> : null}

      {unfinished.length > 0 ? (
        <>
          <View className="mb-2 mt-3 flex-row items-center justify-between">
            <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800', flex: 1, marginRight: 8 }}>
              {t('studio.unfinished')}
            </Text>
            <StudioButton label={t('studio.newProject')} icon="plus" variant="outline" compact onPress={() => setChooser(true)} />
          </View>
          {unfinished.map((p) => projectCard(p, false))}
        </>
      ) : null}
    </>
  );

  const renderHistory = () => (
    <>
      <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '800' }}>{t('studio.nav.history')}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 14 }}>{t('studio.history.subtitle')}</Text>
      {projects === null && !loadError ? (
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <ActivityIndicator color={ICON} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('studio.history.loading')}</Text>
        </View>
      ) : null}
      {projects !== null && completed.length === 0 ? (
        <View className="items-center rounded-2xl border p-6" style={card}>
          <StudioIcon name="film" size={32} color={colors.textSecondary} />
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 8 }}>{t('studio.history.empty')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{t('studio.history.emptyBody')}</Text>
        </View>
      ) : null}
      {completed.map((p) => projectCard(p, true))}
    </>
  );

  const screenTitle = mode === 'history' ? t('studio.nav.history') : inFlowCreation ? t('drawer.studio') : t('studio.nav.home');

  return (
    <RequireAuthRoute>
      <AppScreen
        title={screenTitle}
        onBackPress={inFlowCreation ? reset : () => router.replace('/(drawer)/tools')}
        topAuthRightContent={<StudioHeaderActions />}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          {!inFlowCreation ? nav : null}
          {mode === 'home' ? renderHome() : mode === 'history' ? renderHistory() : renderCreate()}
        </ScrollView>

        <Modal visible={chooser} transparent animationType="fade" onRequestClose={() => setChooser(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 16 }}>
            <View style={{ backgroundColor: P.sheet, borderRadius: 20, padding: 16 }}>
              <View className="mb-3 flex-row items-center justify-between">
                <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800', flex: 1 }}>{t('studio.choose.title')}</Text>
                <Pressable
                  onPress={() => setChooser(false)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('studio.common.close')}
                  style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <StudioIcon name="x" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
              {(['auto', 'manual'] as const).map(workflowCard)}
            </View>
          </View>
        </Modal>

        <AppPromptModal
          visible={pendingDelete !== null}
          icon={<StudioIcon name="trash-2" size={20} color="#EF4444" />}
          iconBackground="#EF444422"
          confirmTone="danger"
          title={t('studio.delete.title')}
          message={deleteError ?? t('studio.delete.message', { title: pendingDelete?.title ?? '' })}
          confirmLabel={deleting ? t('studio.common.deleting') : t('studio.delete.confirm')}
          cancelLabel={t('studio.common.cancel')}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
          onDismiss={() => setPendingDelete(null)}
        />
        <StudioGateModals />
      </AppScreen>
    </RequireAuthRoute>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from 'react-native';

import { useAppTheme, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib/client/base-url';
import { downloadAndSaveFile, shareAssetFile } from '@/utils';
import { getAccessToken } from '@/services/storage/session';

import { movieStudioApi } from '../data/api';
import { pollRenderJob } from '../domain/jobs';
import {
  EXPORT_DEFAULTS,
  EXPORT_FRAME_RATES,
  exportDimensions,
  exportFileName,
  isRenderActive,
  pickRenderJob,
  resolveAssetUrl,
  type ExportAspect,
  type ExportResolution,
} from '../domain/rules';
import type { Project, RenderJob } from '../domain/types';
import { useLatest } from '../hooks/useLatest';
import { SceneClipPlayer } from './SceneClipPlayer';
import { StudioButton } from './StudioButton';
import { StudioIcon } from './StudioIcon';
import { ICON, useStudioPalette } from '../theme';


const RESOLUTIONS: ExportResolution[] = ['720p', '1080p', '4K'];
const ASPECTS: ExportAspect[] = ['16:9', '9:16', '1:1'];
const FORMATS = ['mp4', 'webm'] as const;
const ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return API_BASE_URL;
  }
})();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const messageOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

type Props = {
  project: Project;
  onOpenEditor: () => void;
  onProjectCompleted: (project: Project) => void;
  /** Auto flow only: Manual navigates with the workspace nav. */
  onBack?: () => void;
};

export function ExportStage({ project, onOpenEditor, onProjectCompleted, onBack }: Props) {
  const { colors } = useAppTheme();
  const P = useStudioPalette();
  const { t } = useI18n();
  const tRef = useLatest(t);
  const projectRef = useLatest(project);
  // Callback props change identity every host render; refs keep the poll loop and load effect stable.
  const completedRef = useLatest(onProjectCompleted);
  const surface = P.surface;

  const [hasTimeline, setHasTimeline] = useState<boolean | null>(null);
  const [resolution, setResolution] = useState<ExportResolution>(EXPORT_DEFAULTS.resolution);
  const [aspect, setAspect] = useState<ExportAspect>(EXPORT_DEFAULTS.aspect);
  const [frameRate, setFrameRate] = useState<number>(EXPORT_DEFAULTS.frameRate);
  const [format, setFormat] = useState<'mp4' | 'webm'>(EXPORT_DEFAULTS.format);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState<'save' | 'share' | null>(null);

  const signal = useRef<{ aborted: boolean } | null>(null);
  const jobRef = useLatest(job);

  const poll = useCallback(
    (target: RenderJob) => {
      if (signal.current && !signal.current.aborted) return; // one poll loop at a time
      const mine = { aborted: false };
      signal.current = mine;
      pollRenderJob(target.id, { status: (id) => movieStudioApi.renderStatus(projectRef.current.id, id) }, { sleep, signal: mine, onUpdate: setJob })
        .then(async (outcome) => {
          if (outcome.kind === 'aborted') return;
          if (outcome.kind === 'failed' || outcome.kind === 'cancelled') {
            setError(outcome.message || tRef.current('studio.export.fallbackError'));
            return;
          }
          if (outcome.kind === 'ready' && projectRef.current.status !== 'complete') {
            // Nothing else marks a project finished; a completed render does.
            try {
              completedRef.current(await movieStudioApi.patchProject(projectRef.current.id, { status: 'complete' }));
            } catch {
              // the render itself succeeded; completion is retried next time the screen opens
            }
          }
        })
        .catch((e) => setError(messageOf(e, tRef.current('studio.export.loadFailed'))))
        .finally(() => {
          if (signal.current === mine) signal.current = null;
        });
    },
    [completedRef, projectRef, tRef],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [timeline, renders] = await Promise.all([movieStudioApi.getTimeline(project.id), movieStudioApi.listRenders(project.id)]);
        if (cancelled) return;
        setHasTimeline(Boolean(timeline && timeline.clips.length > 0));
        const current = pickRenderJob(renders);
        if (current) {
          setJob(current);
          if (isRenderActive(current.status)) poll(current);
        }
      } catch (e) {
        if (!cancelled) {
          setHasTimeline(true);
          setError(messageOf(e, tRef.current('studio.export.loadFailed')));
        }
      }
    })();
    return () => {
      cancelled = true;
      if (signal.current) signal.current.aborted = true;
      signal.current = null;
    };
  }, [project.id, poll, tRef]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const current = jobRef.current;
      if (state === 'active' && current && isRenderActive(current.status)) poll(current);
    });
    return () => sub.remove();
  }, [jobRef, poll]);

  const start = async () => {
    if (starting || (job && isRenderActive(job.status))) return;
    setStarting(true);
    setError(null);
    setNotice(null);
    try {
      const { width, height } = exportDimensions(resolution, aspect);
      // Width and height are always sent: the backend default is 1280x720 and would silently downscale.
      const created = await movieStudioApi.startRender(project.id, { width, height, frameRate, format });
      setJob(created);
      poll(created);
    } catch (e) {
      setError(messageOf(e, t('studio.export.startFailed')));
    } finally {
      setStarting(false);
    }
  };

  const cancel = async () => {
    if (!job || cancelling) return;
    setCancelling(true);
    try {
      setJob(await movieStudioApi.cancelRender(project.id, job.id));
    } catch (e) {
      setError(messageOf(e, t('studio.export.fallbackError')));
    } finally {
      setCancelling(false);
    }
  };

  const withFile = async (kind: 'save' | 'share') => {
    if (!job || fileBusy) return;
    setFileBusy(kind);
    setError(null);
    setNotice(null);
    try {
      const url = (await movieStudioApi.renderDownloadUrl(project.id, job.id)) ?? job.outputVideoUrl;
      if (!url) throw new Error(t('studio.export.downloadFailed'));
      const token = await getAccessToken();
      const options = {
        url,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        fileName: exportFileName(project.title, job.format),
        mimeType: job.format === 'webm' ? 'video/webm' : 'video/mp4',
      };
      if (kind === 'share') {
        await shareAssetFile(options);
      } else {
        const saved = await downloadAndSaveFile({ ...options, registryKey: `movie-studio:${job.id}` });
        setNotice(saved.persisted ? t('studio.export.savedTo', { path: saved.displayPath }) : t('studio.export.readySaveOrShare'));
      }
    } catch (e) {
      setError(messageOf(e, t('studio.export.downloadFailed')));
    } finally {
      setFileBusy(null);
    }
  };

  if (hasTimeline === null) return <ActivityIndicator color={ICON} style={{ marginTop: 24 }} />;

  if (!hasTimeline) {
    return (
      <View className="items-center rounded-2xl border p-6" style={{ borderColor: P.border, backgroundColor: surface }}>
        <StudioIcon name="film" size={32} color={colors.textSecondary} />
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 8 }}>{t('studio.export.noTimelineTitle')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: 'center' }}>{t('studio.export.noTimelineBody')}</Text>
        <View style={{ marginTop: 12 }}>
          <StudioButton label={t('studio.export.openEditor')} icon="arrow-left" onPress={onOpenEditor} />
        </View>
      </View>
    );
  }

  const active = job ? isRenderActive(job.status) : false;
  const dims = exportDimensions(resolution, aspect);
  const outputUri = job?.status === 'complete' && job.outputVideoUrl ? resolveAssetUrl(job.outputVideoUrl, ORIGIN) : null;

  const chip = <T extends string | number>(value: T, current: T, onPress: (v: T) => void, label?: string) => {
    const on = value === current;
    return (
      <Pressable
        key={String(value)}
        disabled={active}
        onPress={() => onPress(value)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        className="rounded-full border px-3 py-2"
        style={{ minHeight: 40, justifyContent: 'center', borderColor: on ? P.accent : P.border, backgroundColor: on ? `${P.accent}55` : surface, opacity: active ? 0.6 : 1 }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: on ? '700' : '500' }}>{label ?? String(value)}</Text>
      </Pressable>
    );
  };

  const group = (title: string, children: React.ReactNode) => (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{title}</Text>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {children}
      </View>
    </View>
  );

  const preview = () => {
    if (job && active) {
      return (
        <View className="items-center rounded-2xl border p-5" style={{ borderColor: P.border, backgroundColor: surface }} accessibilityLiveRegion="polite">
          <StudioIcon name="loader-circle" size={32} color={ICON} />
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 10 }}>{t('studio.export.activeTitle')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 2 }}>{t('studio.export.activeBody')}</Text>
          <View style={{ height: 4, borderRadius: 2, alignSelf: 'stretch', backgroundColor: `${P.accent}55`, marginTop: 14 }}>
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: P.accent,
                width: job.progress !== null ? `${Math.max(5, Math.min(100, job.progress > 1 ? job.progress : job.progress * 100))}%` : job.status === 'queued' ? '15%' : '55%',
              }}
            />
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600', marginTop: 8 }}>
            {job.status === 'queued' ? t('studio.export.queuedLabel') : t('studio.export.renderingLabel')}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t('studio.export.severalMinutes')}</Text>
        </View>
      );
    }
    if (job && (job.status === 'failed' || job.status === 'cancelled')) {
      return (
        <View className="items-center rounded-2xl border p-5" style={{ borderColor: P.border, backgroundColor: surface }}>
          <StudioIcon name="circle-x" size={48} color="#F87171" />
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 10 }}>
            {job.status === 'failed' ? t('studio.export.failedTitle') : t('studio.export.cancelledTitle')}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 2 }}>{job.errorMessage || t('studio.export.fallbackError')}</Text>
        </View>
      );
    }
    if (job && job.status === 'complete') {
      return (
        <View>
          {outputUri ? <SceneClipPlayer uri={outputUri} /> : null}
          <View className="mt-2 flex-row items-center" style={{ gap: 6 }}>
            <StudioIcon name="circle-check" size={16} color="#16A34A" />
            <Text style={{ color: '#16A34A', fontSize: 13, fontWeight: '700' }}>{t('studio.export.readyTitle')}</Text>
          </View>
        </View>
      );
    }
    return (
      <View className="items-center rounded-2xl border p-5" style={{ borderColor: P.border, backgroundColor: surface }}>
        <StudioIcon name="film" size={48} color="#D8B4FE" />
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 10 }}>{t('studio.export.idleTitle')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 2 }}>{t('studio.export.idleBody')}</Text>
      </View>
    );
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 12 }}>{t('studio.export.title')}</Text>

      {preview()}

      <View style={{ marginTop: 16 }}>
        {group(t('studio.export.resolution'), RESOLUTIONS.map((r) => chip(r, resolution, setResolution)))}
        {group(t('studio.export.aspect'), ASPECTS.map((a) => chip(a, aspect, setAspect)))}
        {group(t('studio.export.frameRate'), EXPORT_FRAME_RATES.map((f) => chip<number>(f, frameRate, setFrameRate, t('studio.export.frameRateOption', { fps: String(f) }))))}
        {group(t('studio.export.format'), FORMATS.map((f) => chip(f, format, setFormat, f.toUpperCase())))}
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: -6 }}>
          {t('studio.export.readoutSize', { width: String(dims.width), height: String(dims.height) })}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
          {t('studio.export.readoutFormat', { fps: String(frameRate), format: format.toUpperCase() })}
        </Text>
      </View>

      {error ? (
        <View className="mt-3 flex-row" style={{ gap: 6 }} accessibilityLiveRegion="assertive">
          <View style={{ marginTop: 2 }}>
            <StudioIcon name="triangle-alert" size={16} color="#EF4444" />
          </View>
          <Text style={{ color: '#EF4444', fontSize: 12, flex: 1 }}>{error}</Text>
        </View>
      ) : null}
      {notice ? (
        <View className="mt-3 flex-row items-center" style={{ gap: 6 }}>
          <StudioIcon name="circle-check" size={16} color="#16A34A" />
          <Text style={{ color: '#16A34A', fontSize: 12 }}>{notice}</Text>
        </View>
      ) : null}

      <View className="mt-4 flex-row flex-wrap items-center" style={{ gap: 10 }}>
        {onBack ? <StudioButton label={t('studio.common.back')} icon="arrow-left" variant="outline" disabled={starting} onPress={onBack} /> : null}
        {active ? (
          <StudioButton
            label={t('studio.export.cancel')}
            icon="square"
            variant="outline"
            loading={cancelling}
            loadingLabel={t('studio.export.cancelling')}
            onPress={() => void cancel()}
          />
        ) : (
          <StudioButton
            label={job ? t('studio.export.again') : t('studio.export.start')}
            icon={job ? 'rotate-ccw' : 'film'}
            loading={starting}
            loadingLabel={t('studio.export.starting')}
            onPress={() => void start()}
          />
        )}
        {job?.status === 'complete' ? (
          <>
            <StudioButton
              label={t('studio.export.download')}
              icon="download"
              variant="outline"
              loading={fileBusy === 'save'}
              loadingLabel={t('studio.export.preparing')}
              disabled={fileBusy === 'share'}
              onPress={() => void withFile('save')}
            />
            <StudioButton
              label={t('studio.export.share')}
              variant="outline"
              loading={fileBusy === 'share'}
              disabled={fileBusy === 'save'}
              onPress={() => void withFile('share')}
            />
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

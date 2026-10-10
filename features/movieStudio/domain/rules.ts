import { CHARACTER_FIELDS, SCENE_TEXT_FIELDS } from './types';
import type { Character, Scene, Timeline, TimelineClip } from './types';

const filled = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** "pending" is the web sentinel for "no image yet"; the cloudinary copy wins. */
export function resolveCharacterImage(c: Pick<Character, 'cloudinaryImageUrl' | 'referenceImageUrl'>): string | null {
  for (const url of [c.cloudinaryImageUrl, c.referenceImageUrl]) {
    if (filled(url) && url.trim().toLowerCase() !== 'pending') return url.trim();
  }
  return null;
}

export function resolveSceneImage(s: Pick<Scene, 'sceneImageCloudinaryUrl' | 'sceneImageUrl'>): string | null {
  for (const url of [s.sceneImageCloudinaryUrl, s.sceneImageUrl]) if (filled(url)) return url.trim();
  return null;
}

export const isCharacterComplete = (c: Character) => CHARACTER_FIELDS.every((f) => filled(c[f]));
export const characterReadyForScenes = (c: Character) => isCharacterComplete(c) && resolveCharacterImage(c) !== null;

export const isSceneDraftComplete = (s: Scene) =>
  SCENE_TEXT_FIELDS.every((f) => filled(s[f])) && (s.targetDurationSeconds ?? 0) > 0;

export function canContinueToScenes(characters: Character[], hasUnsavedEdits: boolean) {
  return characters.length > 0 && !hasUnsavedEdits && characters.every(characterReadyForScenes);
}

export const canGenerateSceneImage = (s: Scene) => isSceneDraftComplete(s);
export const canGenerateSceneVideo = (s: Scene) => isSceneDraftComplete(s) && resolveSceneImage(s) !== null;

/** cafa_motion is image-to-video: at least one selected character needs a reference image. */
export function sceneHasReferenceImage(s: Scene, characters: Character[]) {
  const selected = new Set(s.ingredientIds);
  return characters.some((c) => selected.has(c.id) && resolveCharacterImage(c) !== null);
}

export function canContinueToEditor(scenes: Scene[], hasUnsavedEdits: boolean) {
  return (
    scenes.length > 0 &&
    !hasUnsavedEdits &&
    scenes.every(
      (s) => isSceneDraftComplete(s) && resolveSceneImage(s) !== null && s.status === 'ready' && filled(s.rawClipUrl),
    )
  );
}

export const sortScenes = (scenes: Scene[]) => [...scenes].sort((a, b) => a.order - b.order);
export const nextSceneOrder = (scenes: Scene[]) => (scenes.length ? Math.max(...scenes.map((s) => s.order)) : -10) + 10;

export function swapOrders(a: Scene, b: Scene): [{ id: string; order: number }, { id: string; order: number }] {
  return [
    { id: a.id, order: b.order },
    { id: b.id, order: a.order },
  ];
}

// ---- Timeline ----
export function buildDefaultTimeline(scenes: Scene[]): Timeline {
  const clips = sortScenes(scenes)
    .filter((s) => s.status === 'ready' && filled(s.rawClipUrl))
    .map<TimelineClip>((s, order) => ({
      shotId: s.id,
      order,
      trimStart: 0,
      trimEnd: s.videoDurationSeconds ?? s.targetDurationSeconds ?? undefined,
      transitionIn: 'cut',
      transitionDuration: 0,
    }));
  return { clips, audioTracks: [], textOverlays: [] };
}

export function normalizeTimeline(t: Timeline): Timeline {
  return {
    ...t,
    clips: t.clips.map((c, i) => ({
      ...c,
      order: i,
      transitionDuration: c.transitionIn === 'cut' ? 0 : Math.max(0.1, c.transitionDuration || 0.5),
    })),
  };
}

export const timelineTotalSeconds = (t: Timeline) =>
  t.clips.reduce((sum, c) => sum + Math.max(0, (c.trimEnd ?? 0) - c.trimStart), 0);

// ---- Export ----
export type ExportResolution = '720p' | '1080p' | '4K';
export type ExportAspect = '16:9' | '9:16' | '1:1';
const SIZES: Record<ExportResolution, [number, number]> = { '720p': [1280, 720], '1080p': [1920, 1080], '4K': [3840, 2160] };

export function exportDimensions(resolution: ExportResolution, aspect: ExportAspect) {
  const [long, short] = SIZES[resolution];
  if (aspect === '16:9') return { width: long, height: short };
  if (aspect === '9:16') return { width: short, height: long };
  return { width: short, height: short };
}

// ---- Resume routing ----
export type ResumeStage = 'video-type' | 'configuration' | 'script' | 'characters' | 'scenes' | 'editor' | 'export';

export function resolveResume(
  project: { status: string; currentStep: string; config?: Record<string, unknown> },
  localMode?: 'manual' | 'auto' | null,
): { mode: 'auto' | 'manual'; stage: ResumeStage } {
  const mode = project.config?.workflowMode === 'manual' || localMode === 'manual' ? 'manual' : 'auto';
  const step = project.currentStep;
  if (project.status === 'complete' || step === 'export') return { mode, stage: 'export' };
  if (step === 'editor' || step === 'video_editor') return { mode, stage: 'editor' };
  if (step === 'scenes') return { mode, stage: 'scenes' };
  if (step === 'characters') return { mode, stage: 'characters' };
  if (step === 'script') return { mode, stage: 'script' };
  if (step === 'configuration') return { mode, stage: 'configuration' };
  return { mode, stage: 'video-type' };
}

// ---- Script payload ----
const IDEA_KEYS = ['premise', 'topic', 'description', 'productDescription', 'mainMessage', 'keyMessage'];

export function buildScriptPayload(videoType: string, config: Record<string, unknown>) {
  const str = (k: string) => {
    const v = config[k];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  const idea = IDEA_KEYS.map(str).find(Boolean);
  const raw = config.durationSeconds ?? config.targetDurationSeconds;
  const duration = raw === '' || raw == null ? NaN : Number(raw);
  const payload: Record<string, unknown> = {
    videoType,
    idea,
    instructions: str('instructions'),
    tone: str('tone'),
    genre: str('genre'),
  };
  if (Number.isFinite(duration)) payload.durationSeconds = duration;
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
}

/** `movie` scripts are per-sequence only; the endpoint 400s for them. */
export const canGenerateScriptFor = (videoType: string | null) => videoType !== 'movie';

export const formatCredits = (value: number) => `${Math.round(value * 100) / 100}`;

export function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const part = (n: number, unit: string) => (n ? `${n} ${unit}${n === 1 ? '' : 's'}` : '');
  return [part(h, 'hour'), part(m, 'minute'), part(s, 'second')].filter(Boolean).join(' ');
}

// ---- Script editor gating ----
export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
export const readingMinutes = (text: string) => Math.max(1, Math.round(wordCount(text) / 130));

export function canSaveScript(state: { hasScript: boolean; content: string; saved: string; freshlyGenerated: boolean }) {
  return state.hasScript && state.content.trim().length > 0 && (state.content !== state.saved || state.freshlyGenerated);
}

export const canContinueToCharacters = (hasScript: boolean, content: string) => hasScript && content.trim().length > 0;

// ---- Characters / assets ----
export type CharacterDraft = Record<(typeof CHARACTER_FIELDS)[number], string>;

export const characterToDraft = (c: Character): CharacterDraft =>
  Object.fromEntries(CHARACTER_FIELDS.map((f) => [f, c[f]])) as CharacterDraft;

export const isCharacterDraftComplete = (d: CharacterDraft) => CHARACTER_FIELDS.every((f) => filled(d[f]));

export const isCharacterDraftDirty = (c: Character, d: CharacterDraft) => CHARACTER_FIELDS.some((f) => (c[f] ?? '') !== (d[f] ?? ''));

/** Trims every field; blanks go as empty strings. */
export const characterDraftPayload = (d: CharacterDraft): Record<string, string> =>
  Object.fromEntries(CHARACTER_FIELDS.map((f) => [f, (d[f] ?? '').trim()]));

/** Relative asset paths resolve against the backend origin; absolute URLs pass through. */
export function resolveAssetUrl(url: string | null, origin: string): string | null {
  if (!url) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  const base = origin.replace(/\/+$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

// ---- Scene drafts ----
export type SceneDraft = Record<(typeof SCENE_TEXT_FIELDS)[number], string> & {
  targetDurationSeconds: string;
  ingredientIds: string[];
  videoDurationSeconds: number;
};

export const VIDEO_LENGTHS = [4, 6, 8] as const;

/** A scene with no characters chosen yet defaults to every project character until the user touches the selection. */
export function sceneToDraft(s: Scene, characters: Character[], touched: boolean): SceneDraft {
  const base = Object.fromEntries(SCENE_TEXT_FIELDS.map((f) => [f, s[f] ?? ''])) as Record<(typeof SCENE_TEXT_FIELDS)[number], string>;
  return {
    ...base,
    targetDurationSeconds: s.targetDurationSeconds === null ? '' : String(s.targetDurationSeconds),
    ingredientIds: s.ingredientIds.length || touched ? [...s.ingredientIds] : characters.map((c) => c.id),
    videoDurationSeconds: (VIDEO_LENGTHS as readonly number[]).includes(s.videoDurationSeconds ?? 0) ? (s.videoDurationSeconds as number) : 4,
  };
}

const parseDuration = (v: string): number | null => {
  const n = Number(v.trim());
  return v.trim() && Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
};

/** Overlay a draft onto its scene so the Scene-based rules apply to what is on screen. */
export function applyDraft(s: Scene, d: SceneDraft): Scene {
  return {
    ...s,
    ...Object.fromEntries(SCENE_TEXT_FIELDS.map((f) => [f, d[f]])),
    targetDurationSeconds: parseDuration(d.targetDurationSeconds),
    ingredientIds: d.ingredientIds,
    videoDurationSeconds: d.videoDurationSeconds,
  } as Scene;
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

export function isSceneDraftDirty(s: Scene, d: SceneDraft) {
  const a = applyDraft(s, d);
  return (
    SCENE_TEXT_FIELDS.some((f) => (s[f] ?? '') !== (a[f] ?? '')) ||
    s.targetDurationSeconds !== a.targetDurationSeconds ||
    s.videoDurationSeconds !== a.videoDurationSeconds ||
    !sameIds(s.ingredientIds, a.ingredientIds)
  );
}

export function sceneDraftPayload(s: Scene, d: SceneDraft) {
  const a = applyDraft(s, d);
  return {
    ...Object.fromEntries(SCENE_TEXT_FIELDS.map((f) => [f, (a[f] ?? '').trim()])),
    targetDurationSeconds: a.targetDurationSeconds as number,
    ingredientIds: a.ingredientIds,
    engine: s.engine || 'cafa_motion',
    resolution: s.resolution || '720p',
    videoDurationSeconds: a.videoDurationSeconds as number,
  };
}

export type VideoBlock = 'incomplete' | 'noImage' | 'noReference' | null;

/** Why "Generate scene video" is blocked (null = allowed). Reference check: cafa_motion needs a character image. */
export function videoBlockReason(s: Scene, characters: Character[]): VideoBlock {
  if (!isSceneDraftComplete(s)) return 'incomplete';
  if (resolveSceneImage(s) === null) return 'noImage';
  if (!sceneHasReferenceImage(s, characters)) return 'noReference';
  return null;
}

// ---- Editor operations ----
export const TRIM_STEP = 0.5;
export const TRANSITION_STEP = 0.1;
export const MAX_TRANSITION_SECONDS = 3;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Longest usable trim for a clip: the scene's rendered length. */
export const clipSourceSeconds = (scene: Pick<Scene, 'videoDurationSeconds' | 'targetDurationSeconds'> | undefined) =>
  scene?.videoDurationSeconds ?? scene?.targetDurationSeconds ?? 4;

/** Keeps only clips whose scene still exists and is ready (the PUT 400s otherwise), re-indexed. */
export function reconcileTimeline(timeline: Timeline, scenes: Scene[]): Timeline {
  const usable = new Set(scenes.filter((s) => s.status === 'ready' && filled(s.rawClipUrl)).map((s) => s.id));
  return {
    ...timeline,
    clips: timeline.clips.filter((c) => usable.has(c.shotId)).map((c, i) => ({ ...c, order: i })),
  };
}

export function updateClip(timeline: Timeline, index: number, patch: Partial<TimelineClip>, sourceSeconds: number): Timeline {
  const clips = timeline.clips.map((c, i) => {
    if (i !== index) return c;
    const next = { ...c, ...patch };
    const max = sourceSeconds;
    let start = Math.min(Math.max(0, round1(next.trimStart)), max - TRIM_STEP);
    let end = round1(Math.min(max, next.trimEnd ?? max));
    if (end < start + TRIM_STEP) {
      if (patch.trimStart !== undefined) start = Math.max(0, end - TRIM_STEP);
      else end = Math.min(max, start + TRIM_STEP);
    }
    const transitionDuration = next.transitionIn === 'cut' ? 0 : Math.min(MAX_TRANSITION_SECONDS, Math.max(0, round1(next.transitionDuration)));
    return { ...next, trimStart: start, trimEnd: end, transitionDuration };
  });
  return { ...timeline, clips };
}

export function moveClip(timeline: Timeline, index: number, delta: -1 | 1): Timeline {
  const to = index + delta;
  if (to < 0 || to >= timeline.clips.length) return timeline;
  const clips = [...timeline.clips];
  [clips[index], clips[to]] = [clips[to], clips[index]];
  return { ...timeline, clips: clips.map((c, i) => ({ ...c, order: i })) };
}

// ---- Export ----
export const EXPORT_DEFAULTS = { resolution: '1080p' as ExportResolution, aspect: '16:9' as ExportAspect, frameRate: 30, format: 'mp4' as 'mp4' | 'webm' };
export const EXPORT_FRAME_RATES = [24, 30, 60] as const;
export const isRenderActive = (status: string) => status === 'queued' || status === 'rendering';

/** Pick the job to re-attach to: an active one, else the newest finished one. */
export function pickRenderJob<T extends { status: string; createdAt: string }>(jobs: T[]): T | null {
  const byNewest = [...jobs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return byNewest.find((j) => isRenderActive(j.status)) ?? byNewest.find((j) => j.status === 'complete') ?? byNewest[0] ?? null;
}

/** Safe download file name: project title + format, stripped of path/illegal characters. */
export function exportFileName(title: string, format: string) {
  const base = title.replace(/[<>:"/\|?*\u0000-\u001F]/g, '').trim().slice(0, 80) || 'cafa-movie';
  return `${base}.${format}`;
}

// ---- Top-up ----
export const MIN_CUSTOM_TOPUP_USD = 4;
export const MAX_CUSTOM_TOPUP_USD = 500;

/** Whole dollars only, within the backend's $4-$500 bounds. Returns the amount or null. */
export function parseCustomTopup(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= MIN_CUSTOM_TOPUP_USD && n <= MAX_CUSTOM_TOPUP_USD ? n : null;
}

// ---- Formatting ----
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ordinal = (n: number) => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10] ?? 'th'}`;
};

/** History card date, e.g. "4th Oct 2026, 3:20 PM" (device local time). */
export function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${ordinal(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hours % 12 || 12}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
}

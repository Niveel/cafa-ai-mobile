import { CHARACTER_FIELDS, SCENE_TEXT_FIELDS } from '../domain/types';
import type {
  Character,
  CreditBalance,
  Project,
  RenderJob,
  Scene,
  Script,
  Timeline,
  TimelineClip,
} from '../domain/types';

type Raw = Record<string, unknown>;
const rec = (v: unknown): Raw => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Lists arrive as a bare array or { items: [] }. */
export function unwrapList(data: unknown): Raw[] {
  if (Array.isArray(data)) return data.map(rec);
  const items = rec(data).items;
  return Array.isArray(items) ? items.map(rec) : [];
}

export function mapProject(raw: unknown): Project {
  const r = rec(raw);
  return {
    id: str(r.id),
    title: str(r.title),
    videoType: typeof r.videoType === 'string' && r.videoType ? r.videoType : null,
    config: rec(r.config),
    status: (['draft', 'in_progress', 'complete'].includes(str(r.status)) ? str(r.status) : 'draft') as Project['status'],
    currentStep: str(r.currentStep),
    updatedAt: str(r.updatedAt),
  };
}

export function mapScript(raw: unknown): Script {
  const r = rec(raw);
  return {
    id: str(r.id),
    projectId: str(r.projectId),
    videoType: str(r.videoType),
    content: str(r.content),
    generationCount: num(r.generationCount) ?? 0,
  };
}

export function mapCharacter(raw: unknown): Character {
  const r = rec(raw);
  const out = { id: str(r.id), referenceImageUrl: str(r.referenceImageUrl), cloudinaryImageUrl: str(r.cloudinaryImageUrl) } as Character;
  for (const f of CHARACTER_FIELDS) out[f] = str(r[f]);
  return out;
}

export function mapScene(raw: unknown): Scene {
  const r = rec(raw);
  const out = {
    id: str(r.id),
    order: num(r.order) ?? 0,
    targetDurationSeconds: num(r.targetDurationSeconds),
    ingredientIds: Array.isArray(r.ingredientIds) ? r.ingredientIds.map(str) : [],
    engine: str(r.engine),
    resolution: str(r.resolution),
    videoDurationSeconds: num(r.videoDurationSeconds),
    status: (str(r.status) || 'draft') as Scene['status'],
    rawClipUrl: str(r.rawClipUrl),
    errorMessage: str(r.errorMessage),
    sceneImageUrl: str(r.sceneImageUrl),
    sceneImageCloudinaryUrl: str(r.sceneImageCloudinaryUrl),
  } as Scene;
  for (const f of SCENE_TEXT_FIELDS) out[f] = str(r[f]);
  return out;
}

export function mapTimeline(raw: unknown): Timeline {
  const r = rec(raw);
  const track = rec(r.videoTrack);
  const clips = (Array.isArray(track.clips) ? track.clips : []).map((c, i): TimelineClip => {
    const cr = rec(c);
    const trimEnd = num(cr.trimEnd);
    return {
      clipId: typeof cr.clipId === 'string' ? cr.clipId : undefined,
      shotId: str(cr.shotId),
      order: num(cr.order) ?? i,
      trimStart: num(cr.trimStart) ?? 0,
      ...(trimEnd === null ? {} : { trimEnd }),
      transitionIn: (['cut', 'crossfade', 'fadeToBlack'].includes(str(cr.transitionIn)) ? str(cr.transitionIn) : 'cut') as TimelineClip['transitionIn'],
      transitionDuration: num(cr.transitionDuration) ?? 0,
    };
  });
  return {
    clips,
    audioTracks: Array.isArray(r.audioTracks) ? r.audioTracks : [],
    textOverlays: Array.isArray(r.textOverlays) ? r.textOverlays : [],
  };
}

export function timelineToRequest(t: Timeline) {
  return { videoTrack: { clips: t.clips }, audioTracks: t.audioTracks, textOverlays: t.textOverlays };
}

export function mapRenderJob(raw: unknown): RenderJob {
  const r = rec(raw);
  return {
    id: str(r.id),
    status: (str(r.status) || 'queued') as RenderJob['status'],
    width: num(r.width) ?? 0,
    height: num(r.height) ?? 0,
    frameRate: num(r.frameRate) ?? 30,
    format: str(r.format) === 'webm' ? 'webm' : 'mp4',
    outputVideoUrl: str(r.outputVideoUrl),
    errorMessage: str(r.errorMessage),
    progress: num(r.progress),
    createdAt: str(r.createdAt),
  };
}

export function mapCreditBalance(raw: unknown): CreditBalance {
  const r = rec(raw);
  const next = rec(r.nextExpiring);
  return {
    balance: num(r.balance) ?? 0,
    nextExpiring: num(next.credits) === null ? null : { credits: num(next.credits) ?? 0, expiresAt: str(next.expiresAt) },
    topupPacks: (Array.isArray(r.topupPacks) ? r.topupPacks : []).map((p) => {
      const pr = rec(p);
      return { packId: str(pr.packId), credits: num(pr.credits) ?? 0, priceUsd: num(pr.priceUsd) ?? 0 };
    }),
  };
}

export type ProjectStatus = 'draft' | 'in_progress' | 'complete';
export type ShotStatus = 'draft' | 'queued' | 'generating' | 'ready' | 'failed' | 'cancelled';
export type RenderStatus = 'queued' | 'rendering' | 'complete' | 'failed' | 'cancelled';
export type TransitionKind = 'cut' | 'crossfade' | 'fadeToBlack';

export type Project = {
  id: string;
  title: string;
  videoType: string | null;
  config: Record<string, unknown>;
  status: ProjectStatus;
  currentStep: string;
  updatedAt: string;
};

export type Script = {
  id: string;
  projectId: string;
  videoType: string;
  content: string;
  generationCount: number;
};

export const CHARACTER_FIELDS = [
  'name',
  'age',
  'gender',
  'appearance',
  'hair',
  'skinTone',
  'bodyType',
  'clothing',
  'personality',
  'background',
  'otherCharacteristics',
] as const;
export type CharacterField = (typeof CHARACTER_FIELDS)[number];

export type Character = Record<CharacterField, string> & {
  id: string;
  referenceImageUrl: string;
  cloudinaryImageUrl: string;
};

export const SCENE_TEXT_FIELDS = [
  'description',
  'location',
  'actions',
  'dialogue',
  'cameraDirection',
  'lighting',
  'environment',
  'mood',
  'sound',
] as const;
export type SceneTextField = (typeof SCENE_TEXT_FIELDS)[number];

export type Scene = Record<SceneTextField, string> & {
  id: string;
  order: number;
  targetDurationSeconds: number | null;
  ingredientIds: string[];
  engine: string;
  resolution: string;
  videoDurationSeconds: number | null;
  status: ShotStatus;
  rawClipUrl: string;
  errorMessage: string;
  sceneImageUrl: string;
  sceneImageCloudinaryUrl: string;
};

export type TimelineClip = {
  clipId?: string;
  shotId: string;
  order: number;
  trimStart: number;
  trimEnd?: number;
  transitionIn: TransitionKind;
  transitionDuration: number;
};

export type Timeline = {
  clips: TimelineClip[];
  audioTracks: unknown[];
  textOverlays: unknown[];
};

export type RenderJob = {
  id: string;
  status: RenderStatus;
  width: number;
  height: number;
  frameRate: number;
  format: 'mp4' | 'webm';
  outputVideoUrl: string;
  errorMessage: string;
  progress: number | null;
  createdAt: string;
};

export type TopupPack = { packId: string; credits: number; priceUsd: number };
export type CreditBalance = {
  balance: number;
  nextExpiring: { credits: number; expiresAt: string } | null;
  topupPacks: TopupPack[];
};

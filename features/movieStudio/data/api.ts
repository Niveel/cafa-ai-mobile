import { AxiosError } from 'axios';

import { apiClient } from '@/services/api';

import { INSUFFICIENT_CREDITS, StudioError, UPGRADE_REQUIRED, parseStudioError } from '../domain/errors';
import type { Scene, Timeline } from '../domain/types';
import { emitStudioGate } from './events';
import {
  mapCharacter,
  mapCreditBalance,
  mapProject,
  mapRenderJob,
  mapScene,
  mapScript,
  mapTimeline,
  timelineToRequest,
  unwrapList,
} from './mappers';

const BASE = '/movie-studio';
const LONG_TIMEOUT_MS = 120_000;

type Opts = { method: 'get' | 'post' | 'patch' | 'put' | 'delete'; path: string; body?: unknown; timeoutMs?: number; allow404?: boolean };

/** The single request path: every error goes through parseStudioError and the gate bus. */
async function call(o: Opts): Promise<unknown> {
  try {
    const res = await apiClient.request({
      method: o.method,
      url: `${BASE}${o.path}`,
      data: o.body,
      timeout: o.timeoutMs,
    });
    const payload = res.data as { data?: unknown } | undefined;
    return payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
  } catch (error) {
    if (!(error instanceof AxiosError)) throw error;
    if (o.allow404 && error.response?.status === 404) return null;
    const mapped = error.response
      ? parseStudioError(error.response.data, error.response.status)
      : new StudioError('Could not connect. Please check your connection and try again.', 'NETWORK_ERROR');
    if (mapped.code === UPGRADE_REQUIRED) emitStudioGate('upgrade_required');
    if (mapped.code === INSUFFICIENT_CREDITS) emitStudioGate('insufficient_credits');
    throw mapped;
  }
}

const p = (id: string) => `/projects/${id}`;

export const movieStudioApi = {
  // projects
  listProjects: async () => unwrapList(await call({ method: 'get', path: '/projects' })).map(mapProject),
  createProject: async (input: { title: string; videoType: string; config?: Record<string, unknown> }) =>
    mapProject(await call({ method: 'post', path: '/projects', body: { config: {}, ...input } })),
  patchProject: async (id: string, patch: Record<string, unknown>) =>
    mapProject(await call({ method: 'patch', path: p(id), body: patch })),
  /** 404 = already deleted elsewhere; treated as success. */
  deleteProject: async (id: string) => {
    await call({ method: 'delete', path: p(id), allow404: true });
  },
  setWizardStep: async (id: string, step: string) => call({ method: 'patch', path: `${p(id)}/wizard-step`, body: { step } }),

  // script
  getScript: async (id: string) => {
    const data = await call({ method: 'get', path: `${p(id)}/script`, allow404: true });
    return data ? mapScript(data) : null;
  },
  generateScript: async (id: string, payload: Record<string, unknown>) =>
    mapScript(await call({ method: 'post', path: `${p(id)}/script/generate`, body: payload, timeoutMs: LONG_TIMEOUT_MS })),
  saveScript: async (id: string, content: string) => mapScript(await call({ method: 'patch', path: `${p(id)}/script`, body: { content } })),
  refineScript: async (id: string, content: string, instructions: string) => {
    const data = (await call({ method: 'post', path: `${p(id)}/script/transform`, body: { action: 'rewrite', content, instructions }, timeoutMs: LONG_TIMEOUT_MS })) as { content?: unknown } | null;
    return typeof data?.content === 'string' ? data.content : null;
  },
  extractCharacters: async (id: string) => call({ method: 'post', path: `${p(id)}/script/extract-characters`, body: {}, timeoutMs: LONG_TIMEOUT_MS }),
  extractScenes: async (id: string) => call({ method: 'post', path: `${p(id)}/script/extract-scenes`, body: {}, timeoutMs: LONG_TIMEOUT_MS }),

  // characters
  listCharacters: async (id: string) =>
    unwrapList(await call({ method: 'get', path: `${p(id)}/ingredients` }))
      .filter((r) => r.type === 'character')
      .map(mapCharacter),
  createCharacter: async (id: string, name: string, referenceImageUrl: string | null = null) =>
    mapCharacter(await call({ method: 'post', path: `${p(id)}/ingredients`, body: { type: 'character', name, referenceImageUrl } })),
  patchCharacter: async (id: string, characterId: string, fields: Record<string, string>) =>
    mapCharacter(await call({ method: 'patch', path: `${p(id)}/ingredients/${characterId}`, body: fields })),
  /** 404 = already removed; treated as success. A 405 (endpoint not deployed) surfaces as an error. */
  deleteCharacter: async (id: string, characterId: string) => {
    await call({ method: 'delete', path: `${p(id)}/ingredients/${characterId}`, allow404: true });
  },
  generateCharacterImage: async (id: string, characterId: string) =>
    mapCharacter(await call({ method: 'post', path: `${p(id)}/ingredients/${characterId}/generate-reference-image`, body: {}, timeoutMs: LONG_TIMEOUT_MS })),

  // scenes
  listRenders: async (id: string) => unwrapList(await call({ method: 'get', path: `${p(id)}/render` })).map(mapRenderJob),
  listScenes: async (id: string) => unwrapList(await call({ method: 'get', path: `${p(id)}/shots` })).map(mapScene),
  createScene: async (id: string, order: number) =>
    mapScene(await call({ method: 'post', path: `${p(id)}/shots`, body: { order, engine: 'cafa_motion', resolution: '720p', videoDurationSeconds: 4 } })),
  patchScene: async (id: string, sceneId: string, patch: Partial<Scene>) =>
    mapScene(await call({ method: 'patch', path: `${p(id)}/shots/${sceneId}`, body: patch })),
  deleteScene: async (id: string, sceneId: string) => {
    await call({ method: 'delete', path: `${p(id)}/shots/${sceneId}` });
  },
  generateSceneImage: async (id: string, sceneId: string) =>
    mapScene(await call({ method: 'post', path: `${p(id)}/shots/${sceneId}/generate-scene-image`, body: {}, timeoutMs: LONG_TIMEOUT_MS })),
  /** Credit-consuming. Never auto-retried. */
  startSceneVideo: async (id: string, sceneId: string) =>
    mapScene(await call({ method: 'post', path: `${p(id)}/shots/${sceneId}/generate`, body: {} })),
  /** The server flips the shot to `cancelled`; refunds are the server's job. */
  cancelSceneVideo: async (id: string, sceneId: string) =>
    mapScene(await call({ method: 'post', path: `${p(id)}/shots/${sceneId}/cancel`, body: {} })),
  sceneStatus: async (id: string, sceneId: string) => mapScene(await call({ method: 'get', path: `${p(id)}/shots/${sceneId}/status` })),

  // timeline
  getTimeline: async (id: string) => {
    const data = await call({ method: 'get', path: `${p(id)}/timeline`, allow404: true });
    return data ? mapTimeline(data) : null;
  },
  saveTimeline: async (id: string, timeline: Timeline) =>
    mapTimeline(await call({ method: 'put', path: `${p(id)}/timeline`, body: timelineToRequest(timeline) })),

  // render
  startRender: async (id: string, input: { width: number; height: number; frameRate: number; format: string }) =>
    mapRenderJob(await call({ method: 'post', path: `${p(id)}/render`, body: input })),
  renderStatus: async (id: string, jobId: string) => mapRenderJob(await call({ method: 'get', path: `${p(id)}/render/${jobId}/status` })),
  cancelRender: async (id: string, jobId: string) => mapRenderJob(await call({ method: 'post', path: `${p(id)}/render/${jobId}/cancel`, body: {} })),
  renderDownloadUrl: async (id: string, jobId: string) => {
    const data = (await call({ method: 'get', path: `${p(id)}/render/${jobId}/download` })) as { downloadUrl?: unknown } | null;
    return typeof data?.downloadUrl === 'string' ? data.downloadUrl : null;
  },

  // credits
  getBalance: async () => mapCreditBalance(await call({ method: 'get', path: '/credits/balance' })),
  createTopupIntent: async (input: { packId: string } | { customAmountUsd: number }) =>
    (await call({ method: 'post', path: '/credits/topup/payment-intent', body: input })) as { clientSecret: string; amountUsd: number; credits: number },
};

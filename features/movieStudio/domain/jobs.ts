import type { RenderJob, Scene } from './types';

export const SCENE_POLL_INTERVAL_MS = 2_000;
export const SCENE_POLL_MAX_ATTEMPTS = 300; // 10 minutes
export const RENDER_POLL_INTERVAL_MS = 2_500;

export type PollOutcome<T> =
  | { kind: 'ready'; value: T }
  | { kind: 'failed'; message: string }
  | { kind: 'cancelled'; message: string }
  | { kind: 'timedOut'; message: string }
  | { kind: 'aborted' };

type Deps = {
  sleep: (ms: number) => Promise<void>;
  signal?: { aborted: boolean };
};

const SCENE_FAILED = 'Scene video generation failed.';
const SCENE_TIMEOUT = 'Scene video generation is taking longer than expected. Check again shortly.';
const RENDER_FAILED = 'Review the timeline and export settings, then try again.';

export const isSceneBusy = (s: Pick<Scene, 'status'>) => s.status === 'queued' || s.status === 'generating';

/**
 * Drives one scene's video job. If the scene is already queued/generating the
 * start call is skipped and polling resumes (never starts a second job).
 * A timeout does NOT cancel the server job.
 */
export async function runSceneVideoJob(
  scene: Scene,
  api: { start: (id: string) => Promise<Scene>; status: (id: string) => Promise<Scene> },
  deps: Deps & { onUpdate?: (scene: Scene) => void },
  options: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<PollOutcome<Scene>> {
  const interval = options.intervalMs ?? SCENE_POLL_INTERVAL_MS;
  const max = options.maxAttempts ?? SCENE_POLL_MAX_ATTEMPTS;

  if (!isSceneBusy(scene)) await api.start(scene.id);

  for (let attempt = 0; attempt < max; attempt += 1) {
    if (deps.signal?.aborted) return { kind: 'aborted' };
    await deps.sleep(interval);
    if (deps.signal?.aborted) return { kind: 'aborted' };
    const current = await api.status(scene.id);
    deps.onUpdate?.(current);
    if (current.status === 'ready') return { kind: 'ready', value: current };
    if (current.status === 'failed') return { kind: 'failed', message: current.errorMessage || SCENE_FAILED };
    if (current.status === 'cancelled') return { kind: 'cancelled', message: current.errorMessage || SCENE_FAILED };
  }
  return { kind: 'timedOut', message: SCENE_TIMEOUT };
}

/** Render jobs are polled with no client timeout; the terminal success value is "complete". */
export async function pollRenderJob(
  jobId: string,
  api: { status: (id: string) => Promise<RenderJob> },
  deps: Deps & { onUpdate?: (job: RenderJob) => void },
  options: { intervalMs?: number } = {},
): Promise<PollOutcome<RenderJob>> {
  const interval = options.intervalMs ?? RENDER_POLL_INTERVAL_MS;
  for (;;) {
    if (deps.signal?.aborted) return { kind: 'aborted' };
    const job = await api.status(jobId);
    deps.onUpdate?.(job);
    if (job.status === 'complete') return { kind: 'ready', value: job };
    if (job.status === 'failed') return { kind: 'failed', message: job.errorMessage || RENDER_FAILED };
    if (job.status === 'cancelled') return { kind: 'cancelled', message: job.errorMessage || RENDER_FAILED };
    await deps.sleep(interval);
  }
}

/** Credit landing poll after a top-up: 5 x 1.5s against a baseline taken before confirming. */
export async function waitForCreditsToLand(
  baseline: number,
  readBalance: () => Promise<number>,
  sleep: (ms: number) => Promise<void>,
  attempts = 5,
  intervalMs = 1_500,
): Promise<{ landed: boolean; balance: number | null }> {
  let last: number | null = null;
  for (let i = 0; i < attempts; i += 1) {
    await sleep(intervalMs);
    try {
      last = await readBalance();
      if (last > baseline) return { landed: true, balance: last };
    } catch {
      // keep polling; webhook delay is normal
    }
  }
  return { landed: false, balance: last };
}

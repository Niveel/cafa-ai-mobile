import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { INSUFFICIENT_CREDITS, parseStudioError } from '../domain/errors';
import { pollRenderJob, runSceneVideoJob, waitForCreditsToLand } from '../domain/jobs';
import {
  buildDefaultTimeline,
  buildScriptPayload,
  canContinueToEditor,
  canContinueToScenes,
  canGenerateScriptFor,
  canGenerateSceneVideo,
  exportDimensions,
  formatCredits,
  formatDuration,
  nextSceneOrder,
  normalizeTimeline,
  resolveCharacterImage,
  resolveResume,
  sceneHasReferenceImage,
  timelineTotalSeconds,
} from '../domain/rules';
import { CHARACTER_FIELDS, SCENE_TEXT_FIELDS } from '../domain/types';
import type { Character, RenderJob, Scene } from '../domain/types';

const makeScene = (over: Partial<Scene> = {}): Scene => {
  const base = Object.fromEntries(SCENE_TEXT_FIELDS.map((f) => [f, 'x'])) as Record<string, string>;
  return {
    ...base,
    id: 's1',
    order: 0,
    targetDurationSeconds: 5,
    ingredientIds: ['c1'],
    engine: 'cafa_motion',
    resolution: '720p',
    videoDurationSeconds: 4,
    status: 'draft',
    rawClipUrl: '',
    errorMessage: '',
    sceneImageUrl: '',
    sceneImageCloudinaryUrl: '',
    ...over,
  } as Scene;
};

const makeCharacter = (over: Partial<Character> = {}): Character => {
  const base = Object.fromEntries(CHARACTER_FIELDS.map((f) => [f, 'x'])) as Record<string, string>;
  return { ...base, id: 'c1', referenceImageUrl: '', cloudinaryImageUrl: '', ...over } as Character;
};

describe('parseStudioError', () => {
  it('reads message and code', () => {
    const e = parseStudioError({ success: false, error: INSUFFICIENT_CREDITS, message: 'Out of credits' }, 402);
    assert.equal(e.message, 'Out of credits');
    assert.equal(e.code, INSUFFICIENT_CREDITS);
    assert.equal(e.httpStatus, 402);
  });
  it('flattens FastAPI loc/msg arrays and drops "body"', () => {
    const e = parseStudioError({ message: [{ loc: ['body', 'step'], msg: 'bad value' }, { msg: 'other' }] }, 422);
    assert.equal(e.message, 'step: bad value; other');
  });
  it('recurses into objects and never leaks raw objects', () => {
    assert.equal(parseStudioError({ message: { detail: 'nested' } }).message, 'nested');
    assert.equal(parseStudioError(undefined).message, 'Something went wrong. Please try again.');
  });
});

describe('references', () => {
  it('treats "pending" as no image and prefers cloudinary', () => {
    assert.equal(resolveCharacterImage({ cloudinaryImageUrl: '', referenceImageUrl: 'pending' }), null);
    assert.equal(resolveCharacterImage({ cloudinaryImageUrl: 'c', referenceImageUrl: 'r' }), 'c');
    assert.equal(resolveCharacterImage({ cloudinaryImageUrl: '', referenceImageUrl: 'r' }), 'r');
  });
});

describe('gates', () => {
  it('continue to scenes needs complete characters with images and no unsaved edits', () => {
    const ok = makeCharacter({ referenceImageUrl: 'r' });
    assert.equal(canContinueToScenes([ok], false), true);
    assert.equal(canContinueToScenes([ok], true), false);
    assert.equal(canContinueToScenes([], false), false);
    assert.equal(canContinueToScenes([makeCharacter()], false), false);
    assert.equal(canContinueToScenes([ok, makeCharacter({ referenceImageUrl: 'r', age: ' ' })], false), false);
  });
  it('scene video needs a complete draft and an image; reference guard checks selected characters', () => {
    assert.equal(canGenerateSceneVideo(makeScene()), false);
    const withImage = makeScene({ sceneImageUrl: 'i' });
    assert.equal(canGenerateSceneVideo(withImage), true);
    assert.equal(sceneHasReferenceImage(withImage, [makeCharacter({ referenceImageUrl: 'r' })]), true);
    assert.equal(sceneHasReferenceImage(withImage, [makeCharacter({ referenceImageUrl: 'pending' })]), false);
    assert.equal(sceneHasReferenceImage({ ...withImage, ingredientIds: [] }, [makeCharacter({ referenceImageUrl: 'r' })]), false);
  });
  it('continue to editor is strict', () => {
    const ready = makeScene({ sceneImageUrl: 'i', status: 'ready', rawClipUrl: 'v' });
    assert.equal(canContinueToEditor([ready], false), true);
    assert.equal(canContinueToEditor([ready], true), false);
    assert.equal(canContinueToEditor([ready, makeScene({ id: 's2' })], false), false);
    assert.equal(canContinueToEditor([], false), false);
  });
  it('movie projects cannot generate scripts', () => {
    assert.equal(canGenerateScriptFor('movie'), false);
    assert.equal(canGenerateScriptFor('short_film'), true);
  });
});

describe('ordering, timeline, export', () => {
  it('next scene order steps by 10 from -10', () => {
    assert.equal(nextSceneOrder([]), 0);
    assert.equal(nextSceneOrder([makeScene({ order: 0 }), makeScene({ order: 30 })]), 40);
  });
  it('default timeline only uses ready clips, sorted', () => {
    const a = makeScene({ id: 'a', order: 20, status: 'ready', rawClipUrl: 'v', videoDurationSeconds: 6 });
    const b = makeScene({ id: 'b', order: 10, status: 'ready', rawClipUrl: 'v', videoDurationSeconds: null, targetDurationSeconds: 7 });
    const c = makeScene({ id: 'c', order: 0, status: 'generating' });
    const t = buildDefaultTimeline([a, b, c]);
    assert.deepEqual(t.clips.map((x) => [x.shotId, x.order, x.trimEnd]), [['b', 0, 7], ['a', 1, 6]]);
    assert.equal(timelineTotalSeconds(t), 13);
  });
  it('normalizes transitions and indexes', () => {
    const t = normalizeTimeline({
      clips: [
        { shotId: 'a', order: 5, trimStart: 0, trimEnd: 4, transitionIn: 'cut', transitionDuration: 2 },
        { shotId: 'b', order: 9, trimStart: 0, trimEnd: 4, transitionIn: 'crossfade', transitionDuration: 0 },
        { shotId: 'c', order: 9, trimStart: 0, trimEnd: 4, transitionIn: 'fadeToBlack', transitionDuration: 0.05 },
      ],
      audioTracks: [],
      textOverlays: [],
    });
    assert.deepEqual(t.clips.map((c) => [c.order, c.transitionDuration]), [[0, 0], [1, 0.5], [2, 0.1]]);
  });
  it('export dimensions', () => {
    assert.deepEqual(exportDimensions('1080p', '16:9'), { width: 1920, height: 1080 });
    assert.deepEqual(exportDimensions('1080p', '9:16'), { width: 1080, height: 1920 });
    assert.deepEqual(exportDimensions('4K', '1:1'), { width: 2160, height: 2160 });
    assert.deepEqual(exportDimensions('720p', '16:9'), { width: 1280, height: 720 });
  });
});

describe('resume routing', () => {
  const cases: [string, string, string][] = [
    ['draft', 'video_type', 'video-type'],
    ['in_progress', 'configuration', 'configuration'],
    ['in_progress', 'script', 'script'],
    ['in_progress', 'characters', 'characters'],
    ['in_progress', 'scenes', 'scenes'],
    ['in_progress', 'video_editor', 'editor'],
    ['in_progress', 'editor', 'editor'],
    ['in_progress', 'export', 'export'],
    ['complete', 'scenes', 'export'],
  ];
  for (const [status, step, stage] of cases) {
    it(`${status}/${step} -> ${stage}`, () => assert.equal(resolveResume({ status, currentStep: step }).stage, stage));
  }
  it('detects manual from config or local record', () => {
    assert.equal(resolveResume({ status: 'draft', currentStep: 'script', config: { workflowMode: 'manual' } }).mode, 'manual');
    assert.equal(resolveResume({ status: 'draft', currentStep: 'script' }, 'manual').mode, 'manual');
    assert.equal(resolveResume({ status: 'draft', currentStep: 'script' }).mode, 'auto');
  });
});

describe('script payload', () => {
  it('uses first non-empty idea key and numeric duration; omits empties', () => {
    const p = buildScriptPayload('short_film', { premise: '  ', topic: 'T', tone: 'Dark', durationSeconds: '60', genre: '' });
    assert.deepEqual(p, { videoType: 'short_film', idea: 'T', tone: 'Dark', durationSeconds: 60 });
    assert.deepEqual(buildScriptPayload('movie', { targetDurationSeconds: 1800 }), { videoType: 'movie', durationSeconds: 1800 });
  });
});

describe('formatting', () => {
  it('keeps fractional credits', () => {
    assert.equal(formatCredits(19.4), '19.4');
    assert.equal(formatCredits(0.19), '0.19');
    assert.equal(formatCredits(3), '3');
  });
  it('humanizes durations', () => {
    assert.equal(formatDuration(5400), '1 hour 30 minutes');
    assert.equal(formatDuration(61), '1 minute 1 second');
  });
});

describe('scene video job', () => {
  const noSleep = async () => {};
  const seq = (statuses: Scene['status'][], over: Partial<Scene> = {}) => {
    let i = 0;
    return async () => makeScene({ status: statuses[Math.min(i++, statuses.length - 1)], ...over });
  };

  it('starts then polls until ready', async () => {
    let starts = 0;
    const out = await runSceneVideoJob(
      makeScene(),
      { start: async () => (starts++, makeScene({ status: 'queued' })), status: seq(['generating', 'ready'], { rawClipUrl: 'v' }) },
      { sleep: noSleep },
    );
    assert.equal(out.kind, 'ready');
    assert.equal(starts, 1);
  });
  it('resumes without starting when already generating (no double start)', async () => {
    let starts = 0;
    const out = await runSceneVideoJob(
      makeScene({ status: 'generating' }),
      { start: async () => (starts++, makeScene()), status: seq(['ready']) },
      { sleep: noSleep },
    );
    assert.equal(out.kind, 'ready');
    assert.equal(starts, 0);
  });
  it('reports failed and cancelled with fallback copy', async () => {
    const failed = await runSceneVideoJob(makeScene({ status: 'queued' }), { start: async () => makeScene(), status: seq(['failed']) }, { sleep: noSleep });
    assert.deepEqual(failed, { kind: 'failed', message: 'Scene video generation failed.' });
    const cancelled = await runSceneVideoJob(
      makeScene({ status: 'queued' }),
      { start: async () => makeScene(), status: seq(['cancelled'], { errorMessage: 'Stopped' }) },
      { sleep: noSleep },
    );
    assert.deepEqual(cancelled, { kind: 'cancelled', message: 'Stopped' });
  });
  it('times out without cancelling', async () => {
    let polls = 0;
    const out = await runSceneVideoJob(
      makeScene({ status: 'queued' }),
      { start: async () => makeScene(), status: async () => (polls++, makeScene({ status: 'generating' })) },
      { sleep: noSleep },
      { maxAttempts: 3 },
    );
    assert.equal(out.kind, 'timedOut');
    assert.equal(polls, 3);
  });
  it('stops when aborted', async () => {
    const signal = { aborted: false };
    const out = await runSceneVideoJob(
      makeScene({ status: 'queued' }),
      { start: async () => makeScene(), status: async () => makeScene({ status: 'generating' }) },
      { sleep: async () => { signal.aborted = true; }, signal },
    );
    assert.equal(out.kind, 'aborted');
  });
});

describe('render job', () => {
  const job = (status: RenderJob['status'], over: Partial<RenderJob> = {}): RenderJob => ({
    id: 'j', status, width: 1920, height: 1080, frameRate: 30, format: 'mp4', outputVideoUrl: '', errorMessage: '', progress: null, createdAt: '', ...over,
  });
  it('completes only on "complete"', async () => {
    const statuses: RenderJob['status'][] = ['queued', 'rendering', 'complete'];
    let i = 0;
    const seen: string[] = [];
    const out = await pollRenderJob('j', { status: async () => job(statuses[i++]) }, { sleep: async () => {}, onUpdate: (j) => seen.push(j.status) });
    assert.equal(out.kind, 'ready');
    assert.deepEqual(seen, statuses);
  });
  it('surfaces failure copy', async () => {
    const out = await pollRenderJob('j', { status: async () => job('failed') }, { sleep: async () => {} });
    assert.deepEqual(out, { kind: 'failed', message: 'Review the timeline and export settings, then try again.' });
  });
});

describe('top-up landing poll', () => {
  it('finishes when balance rises above baseline', async () => {
    const balances = [10, 10, 12];
    let i = 0;
    const r = await waitForCreditsToLand(10, async () => balances[i++], async () => {});
    assert.deepEqual(r, { landed: true, balance: 12 });
  });
  it('gives up after 5 tries', async () => {
    let calls = 0;
    const r = await waitForCreditsToLand(10, async () => (calls++, 10), async () => {});
    assert.equal(r.landed, false);
    assert.equal(calls, 5);
  });
});

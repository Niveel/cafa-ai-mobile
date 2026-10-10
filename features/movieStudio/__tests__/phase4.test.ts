import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runSceneVideoJob } from '../domain/jobs';

import { applyDraft, isSceneDraftDirty, sceneDraftPayload, sceneToDraft, videoBlockReason } from '../domain/rules';
import { CHARACTER_FIELDS, SCENE_TEXT_FIELDS } from '../domain/types';
import type { Character, Scene } from '../domain/types';

describe('scene drafts', () => {
  const scene = {
    ...Object.fromEntries(SCENE_TEXT_FIELDS.map((f) => [f, 'x'])),
    id: 's1', order: 0, targetDurationSeconds: 5, ingredientIds: [], engine: '', resolution: '', videoDurationSeconds: null,
    status: 'draft', rawClipUrl: '', errorMessage: '', sceneImageUrl: '', sceneImageCloudinaryUrl: '',
  } as unknown as Scene;
  const ch = (id: string, img = 'r') => ({ ...Object.fromEntries(CHARACTER_FIELDS.map((f) => [f, 'x'])), id, referenceImageUrl: img, cloudinaryImageUrl: '' }) as unknown as Character;

  it('defaults to all characters until touched', () => {
    assert.deepEqual(sceneToDraft(scene, [ch('a'), ch('b')], false).ingredientIds, ['a', 'b']);
    assert.deepEqual(sceneToDraft(scene, [ch('a'), ch('b')], true).ingredientIds, []);
    assert.equal(sceneToDraft(scene, [], false).videoDurationSeconds, 4);
  });
  it('dirty detection treats the all-characters default as a change to save', () => {
    const d = sceneToDraft(scene, [ch('a')], false);
    assert.equal(isSceneDraftDirty(scene, d), true);
    assert.equal(isSceneDraftDirty({ ...scene, ingredientIds: ['a'], videoDurationSeconds: 4 }, d), false);
    assert.equal(isSceneDraftDirty({ ...scene, ingredientIds: ['a'], videoDurationSeconds: 4 }, { ...d, mood: 'y' }), true);
  });
  it('rejects non-positive or fractional durations as incomplete', () => {
    const d = sceneToDraft(scene, [], true);
    assert.equal(applyDraft(scene, { ...d, targetDurationSeconds: '0' }).targetDurationSeconds, null);
    assert.equal(applyDraft(scene, { ...d, targetDurationSeconds: '2.5' }).targetDurationSeconds, null);
    assert.equal(applyDraft(scene, { ...d, targetDurationSeconds: ' 7 ' }).targetDurationSeconds, 7);
  });
  it('payload fills engine defaults and a numeric duration', () => {
    const p = sceneDraftPayload(scene, sceneToDraft(scene, [ch('a')], false));
    assert.equal(p.engine, 'cafa_motion');
    assert.equal(p.resolution, '720p');
    assert.equal(p.targetDurationSeconds, 5);
  });
  it('explains why video is blocked', () => {
    const chars = [ch('a')];
    assert.equal(videoBlockReason({ ...scene, targetDurationSeconds: null }, chars), 'incomplete');
    assert.equal(videoBlockReason({ ...scene, ingredientIds: ['a'] }, chars), 'noImage');
    assert.equal(videoBlockReason({ ...scene, sceneImageUrl: 'i', ingredientIds: [] }, chars), 'noReference');
    assert.equal(videoBlockReason({ ...scene, sceneImageUrl: 'i', ingredientIds: ['a'] }, [ch('a', 'pending')]), 'noReference');
    assert.equal(videoBlockReason({ ...scene, sceneImageUrl: 'i', ingredientIds: ['a'] }, chars), null);
  });
});


describe('scene job updates', () => {
  it('reports every polled status to onUpdate', async () => {
    const mk = (status: Scene['status']) => ({ id: 's1', status, errorMessage: '', rawClipUrl: '' }) as unknown as Scene;
    const seen: string[] = [];
    const statuses: Scene['status'][] = ['queued', 'generating', 'ready'];
    let i = 0;
    const out = await runSceneVideoJob(mk('draft'), { start: async () => mk('queued'), status: async () => mk(statuses[i++]) }, { sleep: async () => {}, onUpdate: (s) => seen.push(s.status) });
    assert.equal(out.kind, 'ready');
    assert.deepEqual(seen, statuses);
  });
});

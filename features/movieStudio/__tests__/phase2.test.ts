import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CONFIG_SCHEMAS, configToForm, isConfigComplete, mergeConfig, schemaFor } from '../domain/configSchemas';
import {
  canContinueToCharacters,
  canSaveScript,
  characterDraftPayload,
  characterToDraft,
  isCharacterDraftComplete,
  isCharacterDraftDirty,
  readingMinutes,
  resolveAssetUrl,
  wordCount,
} from '../domain/rules';
import { CHARACTER_FIELDS } from '../domain/types';
import type { Character } from '../domain/types';

describe('config schemas', () => {
  it('has a schema for every creatable type and no empty ones', () => {
    for (const type of ['product_advertisement', 'short_film', 'movie', 'youtube_video', 'social_media_video', 'documentary', 'movie_trailer', 'music_video', 'explainer_video', 'commercial', 'custom_video']) {
      assert.ok(CONFIG_SCHEMAS[type]?.length, type);
    }
    assert.equal(schemaFor(null).length, 1);
    assert.equal(schemaFor('tv_series').length, 0);
  });
  it('requires every field', () => {
    const form = configToForm('custom_video', {});
    assert.equal(isConfigComplete('custom_video', form), false);
    assert.equal(isConfigComplete('custom_video', { description: '  ' }), false);
    assert.equal(isConfigComplete('custom_video', { description: 'a film' }), true);
  });
  it('prefills from stored strings and numbers, ignores objects', () => {
    assert.deepEqual(configToForm('documentary', { topic: 'T', durationSeconds: 300, subject: { x: 1 } }), {
      topic: 'T', subject: '', purpose: '', targetAudience: '', durationSeconds: '300',
    });
  });
  it('merge keeps workflowMode and trims', () => {
    assert.deepEqual(mergeConfig({ workflowMode: 'manual' }, { description: ' x ' }), { workflowMode: 'manual', description: 'x' });
  });
});

describe('script gating', () => {
  it('save needs script, content and a change or a fresh generation', () => {
    const base = { hasScript: true, content: 'a', saved: 'a', freshlyGenerated: false };
    assert.equal(canSaveScript(base), false);
    assert.equal(canSaveScript({ ...base, content: 'b' }), true);
    assert.equal(canSaveScript({ ...base, freshlyGenerated: true }), true);
    assert.equal(canSaveScript({ ...base, content: ' ', saved: 'a' }), false);
    assert.equal(canSaveScript({ ...base, hasScript: false, content: 'b' }), false);
  });
  it('continue needs non-empty content', () => {
    assert.equal(canContinueToCharacters(true, 'x'), true);
    assert.equal(canContinueToCharacters(true, ' '), false);
    assert.equal(canContinueToCharacters(false, 'x'), false);
  });
  it('counts words and reading time (min 1)', () => {
    assert.equal(wordCount('  a b  c '), 3);
    assert.equal(readingMinutes('a b'), 1);
    assert.equal(readingMinutes(Array(260).fill('w').join(' ')), 2);
  });
});

describe('character drafts', () => {
  const char = Object.fromEntries([...CHARACTER_FIELDS.map((f) => [f, 'x']), ['id', 'c1'], ['referenceImageUrl', ''], ['cloudinaryImageUrl', '']]) as unknown as Character;
  it('detects dirty and complete', () => {
    const d = characterToDraft(char);
    assert.equal(isCharacterDraftDirty(char, d), false);
    assert.equal(isCharacterDraftDirty(char, { ...d, hair: 'red' }), true);
    assert.equal(isCharacterDraftComplete(d), true);
    assert.equal(isCharacterDraftComplete({ ...d, age: '  ' }), false);
  });
  it('payload trims and carries all 11 fields', () => {
    const p = characterDraftPayload({ ...characterToDraft(char), name: ' Ann ' });
    assert.equal(Object.keys(p).length, 11);
    assert.equal(p.name, 'Ann');
  });
});

describe('resolveAssetUrl', () => {
  it('resolves relative paths and passes absolute through', () => {
    assert.equal(resolveAssetUrl('/media/a.png', 'https://api.x/'), 'https://api.x/media/a.png');
    assert.equal(resolveAssetUrl('media/a.png', 'https://api.x'), 'https://api.x/media/a.png');
    assert.equal(resolveAssetUrl('https://c.io/a.png', 'https://api.x'), 'https://c.io/a.png');
    assert.equal(resolveAssetUrl(null, 'https://api.x'), null);
  });
});

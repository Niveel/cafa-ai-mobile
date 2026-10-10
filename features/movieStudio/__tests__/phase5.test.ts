import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveNotificationRoute, resolveNotificationTarget } from '../../../utils/notificationRoute';
import { emitStudioGate, subscribeStudioGate } from '../data/events';
import { exportFileName, formatHistoryDate, moveClip, parseCustomTopup, pickRenderJob, reconcileTimeline, updateClip } from '../domain/rules';
import type { Scene, Timeline } from '../domain/types';

const clip = (shotId: string, over = {}) => ({ shotId, order: 0, trimStart: 0, trimEnd: 4, transitionIn: 'cut' as const, transitionDuration: 0, ...over });
const tl = (...ids: string[]): Timeline => ({ clips: ids.map((id, i) => clip(id, { order: i })), audioTracks: [], textOverlays: [] });
const scene = (id: string, status: string, rawClipUrl = 'v') => ({ id, status, rawClipUrl }) as unknown as Scene;

describe('timeline editing', () => {
  it('reconcile drops clips for missing or non-ready scenes and re-indexes', () => {
    const out = reconcileTimeline(tl('a', 'b', 'c'), [scene('a', 'ready'), scene('c', 'ready'), scene('b', 'generating')]);
    assert.deepEqual(out.clips.map((c) => [c.shotId, c.order]), [['a', 0], ['c', 1]]);
    assert.equal(reconcileTimeline(tl('a'), [scene('a', 'ready', '')]).clips.length, 0);
  });
  it('trim stays within the source and keeps a minimum length', () => {
    const t = tl('a');
    assert.equal(updateClip(t, 0, { trimEnd: 99 }, 6).clips[0].trimEnd, 6);
    assert.equal(updateClip(t, 0, { trimStart: -2 }, 6).clips[0].trimStart, 0);
    const pushed = updateClip(t, 0, { trimStart: 4 }, 6).clips[0];
    assert.ok((pushed.trimEnd ?? 0) - pushed.trimStart >= 0.5);
    const shrunk = updateClip(t, 0, { trimEnd: 0 }, 6).clips[0];
    assert.ok((shrunk.trimEnd ?? 0) - shrunk.trimStart >= 0.5);
  });
  it('cut forces a zero transition; others clamp to 3s', () => {
    const t = tl('a');
    assert.equal(updateClip(t, 0, { transitionIn: 'cut', transitionDuration: 2 }, 4).clips[0].transitionDuration, 0);
    assert.equal(updateClip(t, 0, { transitionIn: 'crossfade', transitionDuration: 9 }, 4).clips[0].transitionDuration, 3);
  });
  it('moves clips and re-indexes; edges are no-ops', () => {
    const moved = moveClip(tl('a', 'b', 'c'), 0, 1);
    assert.deepEqual(moved.clips.map((c) => [c.shotId, c.order]), [['b', 0], ['a', 1], ['c', 2]]);
    assert.equal(moveClip(tl('a', 'b'), 0, -1).clips[0].shotId, 'a');
  });
});

describe('render job selection and file names', () => {
  it('prefers active, then newest complete', () => {
    const jobs = [
      { id: '1', status: 'complete', createdAt: '2026-01-01' },
      { id: '2', status: 'complete', createdAt: '2026-02-01' },
      { id: '3', status: 'failed', createdAt: '2026-03-01' },
    ];
    assert.equal(pickRenderJob(jobs)?.id, '2');
    assert.equal(pickRenderJob([...jobs, { id: '4', status: 'rendering', createdAt: '2025-01-01' }])?.id, '4');
    assert.equal(pickRenderJob([]), null);
  });
  it('sanitises the export file name', () => {
    assert.equal(exportFileName('My: Film/Cut?', 'mp4'), 'My FilmCut.mp4');
    assert.equal(exportFileName('///', 'webm'), 'cafa-movie.webm');
  });
});

describe('top-up input', () => {
  it('accepts whole dollars between 4 and 500', () => {
    assert.equal(parseCustomTopup('4'), 4);
    assert.equal(parseCustomTopup(' 500 '), 500);
    assert.equal(parseCustomTopup('3'), null);
    assert.equal(parseCustomTopup('501'), null);
    assert.equal(parseCustomTopup('4.5'), null);
    assert.equal(parseCustomTopup(''), null);
    assert.equal(parseCustomTopup('abc'), null);
  });
});

describe('gate bus', () => {
  it('delivers events and unsubscribes', () => {
    const seen: string[] = [];
    const off = subscribeStudioGate((e) => seen.push(e));
    emitStudioGate('insufficient_credits');
    off();
    emitStudioGate('upgrade_required');
    assert.deepEqual(seen, ['insufficient_credits']);
  });
});


describe('notification routing', () => {
  const pid = 'a'.repeat(24);
  it('opens a finished render at the project export screen', () => {
    assert.equal(resolveNotificationTarget({ type: 'movie_studio_render_ready', metadata: { projectId: pid } }), `/studio-project?id=${pid}&stage=export`);
    assert.equal(resolveNotificationTarget({ type: 'movie_studio_render_ready', metadata: {} }), '/studio');
    assert.equal(resolveNotificationTarget({ type: 'movie_studio_export_ready', metadata: { projectId: pid } }), `/studio-project?id=${pid}&stage=export`);
    assert.equal(resolveNotificationTarget({ type: 'movie_studio_clip_ready', metadata: { projectId: pid, shotId: 'x' } }), `/studio-project?id=${pid}&stage=scenes`);
    assert.equal(resolveNotificationTarget({ type: 'movie_studio_clip_ready', link: `/studio/projects/${pid}` }), `/studio-project?id=${pid}&stage=scenes`);
    // The bell and push handlers pass the resolved target back through resolveNotificationRoute: it must survive that.
    assert.equal(resolveNotificationRoute(`/studio-project?id=${pid}&stage=export`), `/studio-project?id=${pid}&stage=export`);
  });
  it('maps web studio links', () => {
    assert.equal(resolveNotificationRoute(`/movie-studio/projects/${pid}`), `/studio-project?id=${pid}&stage=export`);
    assert.equal(resolveNotificationRoute('/movie-studio'), '/studio');
    assert.equal(resolveNotificationRoute('/images'), '/images');
  });
});

describe('history date', () => {
  it('formats like the web history cards', () => {
    assert.equal(formatHistoryDate(new Date(2026, 9, 4, 15, 20).toISOString()), '4th Oct 2026, 3:20 PM');
    assert.equal(formatHistoryDate(new Date(2026, 0, 1, 0, 5).toISOString()), '1st Jan 2026, 12:05 AM');
    assert.equal(formatHistoryDate(new Date(2026, 10, 12, 12, 0).toISOString()), '12th Nov 2026, 12:00 PM');
    assert.equal(formatHistoryDate(new Date(2026, 2, 23, 9, 9).toISOString()), '23rd Mar 2026, 9:09 AM');
    assert.equal(formatHistoryDate('nope'), '');
  });
});

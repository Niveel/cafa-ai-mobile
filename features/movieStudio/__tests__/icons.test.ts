import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { STUDIO_ICON_NAMES } from '../studioIconNames';

const root = join(import.meta.dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__') walk(full, out);
    } else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const studioFiles = [
  ...walk(join(root, 'features', 'movieStudio')),
  join(root, 'app', '(drawer)', 'studio.tsx'),
  join(root, 'app', '(drawer)', 'studio-project.tsx'),
];
const source = studioFiles
  .filter((f) => !f.endsWith('studioIconNames.ts') && !f.endsWith('StudioIcon.tsx'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

// A literal right after === or !== is a comparison, not an icon name.
const KEBAB = /(?<![=!]==\s)'([a-z0-9]+(?:-[a-z0-9]+)*)'|"([a-z0-9]+(?:-[a-z0-9]+)*)"/g;

/** Icon names in the places icons are chosen: <StudioIcon name=...>, icon=..., icon: '...', ternaries inside those. */
function chosenIcons() {
  const used = new Set<string>();
  const patterns = [/<StudioIcon\s+name=(\{[^}]*\}|"[^"]+")/g, /\bicon=(\{[^}]*\}|"[^"]+")/g, /\bicon:\s*('[^']+')/g, /\['(?:home|history)', '([^']+)'/g];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (pattern === patterns[3]) used.add(match[1]);
      else for (const lit of match[0].matchAll(KEBAB)) used.add((lit[1] ?? lit[2]) as string);
    }
  }
  return used;
}

/** Any literal anywhere in Studio code that equals an inventory icon (helpers pass icon names as arguments). */
function mentionedIcons() {
  const names = new Set<string>(STUDIO_ICON_NAMES);
  const found = new Set<string>();
  for (const lit of source.matchAll(KEBAB)) {
    const name = (lit[1] ?? lit[2]) as string;
    if (names.has(name)) found.add(name);
  }
  return found;
}

// Icons the web Studio has but the mobile Studio intentionally does not use, with the reason.
const EXPECTED_UNUSED: Record<string, string> = {
  dices: 'optional "Fill randomly" demo control: left out (owner decision)',
  eraser: 'optional "Clear autofill" demo control: left out (owner decision)',
  shuffle: 'dev-only "Fill randomly" on web: never ships',
  menu: 'web Studio drawer toggle; mobile uses the app drawer',
  'message-square': 'web footer link "Back to Cafa AI chat"; mobile uses the app drawer',
  crop: 'Manual cast local crop UI not built (server-backed characters instead)',
  'chevron-up': 'web Manual scenes board uses chevron-up/down; mobile reuses the Auto scene list (arrow-up/arrow-down)',
  'maximize-2': 'Manual cast local crop UI not built',
  'cloud-upload': 'Manual cast dropzone not built',
  'panel-left': 'Manual cast / scenes-board layout toggle not built',
  'panel-right': 'Manual cast / scenes-board layout toggle not built',
  'columns-2': 'Manual cast / scenes-board layout toggle not built',
};

describe('Movie Studio icon audit', () => {
  it('uses only Lucide glyphs from the web Studio inventory', () => {
    const allowed = new Set<string>(STUDIO_ICON_NAMES);
    const unauthorized = [...chosenIcons()].filter((name) => !allowed.has(name));
    assert.deepEqual(unauthorized, []);
  });

  it('inventory is the 66 glyphs of the spec', () => {
    assert.equal(STUDIO_ICON_NAMES.length, 66);
    assert.equal(new Set(STUDIO_ICON_NAMES).size, 66);
  });

  it('does not import any other icon library', () => {
    for (const lib of ['@expo/vector-icons', 'react-native-vector-icons', 'Ionicons', 'MaterialIcons', 'FontAwesome', 'expo-symbols']) {
      assert.equal(source.includes(lib), false, `Studio code references ${lib}`);
    }
  });

  it('every required icon is used, except the documented exceptions', () => {
    const used = new Set([...chosenIcons(), ...mentionedIcons()]);
    const missing = STUDIO_ICON_NAMES.filter((name) => !used.has(name));
    const unexpected = missing.filter((name) => !(name in EXPECTED_UNUSED));
    assert.deepEqual(unexpected, [], `Required by a flow but unused: ${unexpected.join(', ')}`);
    const stale = Object.keys(EXPECTED_UNUSED).filter((name) => used.has(name));
    assert.deepEqual(stale, [], `Listed as unused but now used: ${stale.join(', ')}`);
  });
});

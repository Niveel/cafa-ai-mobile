import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FileKind } from './fileType';

/**
 * Remembers which downloaded files were saved where, so a file card can say
 * "Open" instead of "Download" after the file has been saved (also after the
 * app restarts), the way ChatGPT/Gemini file chips do.
 */
export type SavedFileRef = {
  contentUri: string;
  fileName: string;
  mimeType: string;
  displayPath: string;
  kind: FileKind;
};

type Entry = SavedFileRef & { savedAt: number };

const STORAGE_KEY = 'cafa.savedFiles.v1';
const MAX_ENTRIES = 200;

let entries: Record<string, Entry> = {};
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

function load(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') entries = { ...parsed, ...entries };
        }
      })
      .catch(() => undefined)
      .finally(() => {
        loaded = true;
        notify();
      });
  }
  return loading;
}

function persist() {
  const sorted = Object.entries(entries).sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, MAX_ENTRIES);
  entries = Object.fromEntries(sorted);
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch(() => undefined);
}

export async function rememberSavedFile(key: string, file: SavedFileRef) {
  await load();
  entries = { ...entries, [key]: { ...file, savedAt: Date.now() } };
  persist();
  notify();
}

export async function forgetSavedFile(key: string) {
  await load();
  if (!(key in entries)) return;
  const next = { ...entries };
  delete next[key];
  entries = next;
  persist();
  notify();
}

export function getSavedFileSync(key: string | null | undefined): SavedFileRef | undefined {
  return key ? entries[key] : undefined;
}

/** React hook: the saved copy of a file (if any), kept in sync across screens. */
export function useSavedFile(key: string | null | undefined): SavedFileRef | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      void load();
      return () => {
        listeners.delete(listener);
      };
    },
    () => getSavedFileSync(key),
    () => undefined,
  );
}

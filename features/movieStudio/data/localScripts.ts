import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Saved-script history is device-local: the backend has no version store. It must never be presented as synced.
 */
export type LocalScriptVersion = { content: string; savedAt: string };

const key = (projectId: string) => `cafa-studio:script-versions:${projectId}`;
const MAX_VERSIONS = 20;

export async function readLocalScriptVersions(projectId: string): Promise<LocalScriptVersion[]> {
  try {
    const raw = await AsyncStorage.getItem(key(projectId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as LocalScriptVersion[]).filter((v) => typeof v?.content === 'string') : [];
  } catch {
    return [];
  }
}

export async function appendLocalScriptVersion(projectId: string, content: string): Promise<LocalScriptVersion[]> {
  const current = await readLocalScriptVersions(projectId);
  if (current[0]?.content === content) return current;
  const next = [{ content, savedAt: new Date().toISOString() }, ...current].slice(0, MAX_VERSIONS);
  try {
    await AsyncStorage.setItem(key(projectId), JSON.stringify(next));
  } catch {
    // history is a convenience; a failed write never blocks saving
  }
  return next;
}

export async function clearLocalScriptVersions(projectId: string) {
  try {
    await AsyncStorage.removeItem(key(projectId));
  } catch {
    // ignore
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const ARCHIVED_CHATS_KEY = 'cafa_ai_archived_chats_v1';

export type ArchivedChatSnapshot = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  archivedAt: number;
};

function normalizeItem(raw: Partial<ArchivedChatSnapshot>): ArchivedChatSnapshot | null {
  if (!raw.id || typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    title: typeof raw.title === 'string' ? raw.title : 'Chat',
    preview: typeof raw.preview === 'string' ? raw.preview : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    archivedAt: typeof raw.archivedAt === 'number' ? raw.archivedAt : Date.now(),
  };
}

export async function getArchivedChatSnapshots(): Promise<ArchivedChatSnapshot[]> {
  const raw = await AsyncStorage.getItem(ARCHIVED_CHATS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Partial<ArchivedChatSnapshot>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeItem)
      .filter((item): item is ArchivedChatSnapshot => Boolean(item))
      .sort((a, b) => b.archivedAt - a.archivedAt);
  } catch {
    return [];
  }
}

async function setArchivedChatSnapshots(next: ArchivedChatSnapshot[]) {
  await AsyncStorage.setItem(ARCHIVED_CHATS_KEY, JSON.stringify(next));
}

export async function upsertArchivedChatSnapshots(incoming: ArchivedChatSnapshot[]) {
  const current = await getArchivedChatSnapshots();
  const merged = new Map<string, ArchivedChatSnapshot>(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    merged.set(item.id, item);
  }
  const next = [...merged.values()].sort((a, b) => b.archivedAt - a.archivedAt);
  await setArchivedChatSnapshots(next);
  return next;
}

export async function removeArchivedChatSnapshot(chatId: string) {
  const current = await getArchivedChatSnapshots();
  const next = current.filter((item) => item.id !== chatId);
  await setArchivedChatSnapshots(next);
  return next;
}

export async function removeArchivedChatSnapshots(chatIds: string[]) {
  const blocked = new Set(chatIds);
  const current = await getArchivedChatSnapshots();
  const next = current.filter((item) => !blocked.has(item.id));
  await setArchivedChatSnapshots(next);
  return next;
}

export async function clearArchivedChatSnapshots() {
  await AsyncStorage.removeItem(ARCHIVED_CHATS_KEY);
}


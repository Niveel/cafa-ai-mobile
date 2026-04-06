import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_PREFERENCES_KEY = 'cafa_ai_chat_preferences_v1';

type ChatPreferencesPayload = {
  pinnedIds: string[];
  customTitles: Record<string, string>;
};

const EMPTY_PREFERENCES: ChatPreferencesPayload = {
  pinnedIds: [],
  customTitles: {},
};

export async function getChatPreferences(): Promise<ChatPreferencesPayload> {
  const raw = await AsyncStorage.getItem(CHAT_PREFERENCES_KEY);
  if (!raw) return EMPTY_PREFERENCES;

  try {
    const parsed = JSON.parse(raw) as Partial<ChatPreferencesPayload>;
    return {
      pinnedIds: Array.isArray(parsed.pinnedIds) ? parsed.pinnedIds : [],
      customTitles: parsed.customTitles && typeof parsed.customTitles === 'object' ? parsed.customTitles : {},
    };
  } catch {
    return EMPTY_PREFERENCES;
  }
}

export async function setChatPreferences(next: ChatPreferencesPayload) {
  await AsyncStorage.setItem(CHAT_PREFERENCES_KEY, JSON.stringify(next));
}

export async function setPinnedChat(chatId: string, pinned: boolean) {
  const current = await getChatPreferences();
  const pinnedSet = new Set(current.pinnedIds);
  if (pinned) {
    pinnedSet.add(chatId);
  } else {
    pinnedSet.delete(chatId);
  }

  const next: ChatPreferencesPayload = {
    ...current,
    pinnedIds: [...pinnedSet],
  };
  await setChatPreferences(next);
  return next;
}

export async function setCustomChatTitle(chatId: string, title: string) {
  const current = await getChatPreferences();
  const next: ChatPreferencesPayload = {
    ...current,
    customTitles: {
      ...current.customTitles,
      [chatId]: title,
    },
  };
  await setChatPreferences(next);
  return next;
}

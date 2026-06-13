import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UiMessage } from '@/components/chat/types';

const DOCUMENT_WIZARD_DRAFTS_KEY = 'cafa_ai_document_wizard_drafts_v2';
const LEGACY_DOCUMENT_WIZARD_DRAFTS_KEY = 'cafa_ai_document_wizard_drafts_v1';
const DEFAULT_DOCUMENT_WIZARD_DRAFT_KEY = 'standalone';

type DocumentWizardDraftsPayload = {
  activeKey?: string | null;
  draftsByKey?: Record<string, UiMessage[]>;
};

function normalizeDraftKey(key?: string | null) {
  const trimmed = key?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_DOCUMENT_WIZARD_DRAFT_KEY;
}

function isMessageArray(value: unknown): value is UiMessage[] {
  return Array.isArray(value);
}

async function readPayload(): Promise<DocumentWizardDraftsPayload> {
  const currentRaw = await AsyncStorage.getItem(DOCUMENT_WIZARD_DRAFTS_KEY);
  if (currentRaw) {
    try {
      const parsed = JSON.parse(currentRaw) as DocumentWizardDraftsPayload;
      return {
        activeKey: typeof parsed.activeKey === 'string' ? parsed.activeKey : null,
        draftsByKey: typeof parsed.draftsByKey === 'object' && parsed.draftsByKey
          ? Object.entries(parsed.draftsByKey).reduce<Record<string, UiMessage[]>>((acc, [key, value]) => {
            if (isMessageArray(value)) {
              acc[key] = value;
            }
            return acc;
          }, {})
          : {},
      };
    } catch {
      return { activeKey: null, draftsByKey: {} };
    }
  }

  const legacyRaw = await AsyncStorage.getItem(LEGACY_DOCUMENT_WIZARD_DRAFTS_KEY);
  if (!legacyRaw) {
    return { activeKey: null, draftsByKey: {} };
  }

  try {
    const parsed = JSON.parse(legacyRaw) as { messages?: UiMessage[] };
    const legacyMessages = isMessageArray(parsed.messages) ? parsed.messages : [];
    const migrated: DocumentWizardDraftsPayload = {
      activeKey: legacyMessages.length ? DEFAULT_DOCUMENT_WIZARD_DRAFT_KEY : null,
      draftsByKey: legacyMessages.length
        ? { [DEFAULT_DOCUMENT_WIZARD_DRAFT_KEY]: legacyMessages }
        : {},
    };
    await AsyncStorage.setItem(DOCUMENT_WIZARD_DRAFTS_KEY, JSON.stringify(migrated));
    await AsyncStorage.removeItem(LEGACY_DOCUMENT_WIZARD_DRAFTS_KEY);
    return migrated;
  } catch {
    return { activeKey: null, draftsByKey: {} };
  }
}

async function writePayload(payload: DocumentWizardDraftsPayload) {
  await AsyncStorage.setItem(
    DOCUMENT_WIZARD_DRAFTS_KEY,
    JSON.stringify({
      activeKey: payload.activeKey ?? null,
      draftsByKey: payload.draftsByKey ?? {},
    }),
  );
}

export async function getDocumentWizardDraftMessages(key?: string | null): Promise<UiMessage[]> {
  const payload = await readPayload();
  const draftKey = normalizeDraftKey(key);
  return payload.draftsByKey?.[draftKey] ?? [];
}

export async function setDocumentWizardDraftMessages(key: string | null | undefined, messages: UiMessage[]) {
  const payload = await readPayload();
  const draftKey = normalizeDraftKey(key);
  const nextDraftsByKey = {
    ...(payload.draftsByKey ?? {}),
    [draftKey]: messages,
  };
  await writePayload({
    activeKey: draftKey,
    draftsByKey: nextDraftsByKey,
  });
}

export async function clearDocumentWizardDraftMessages(key?: string | null) {
  const payload = await readPayload();
  const draftKey = normalizeDraftKey(key);
  const nextDraftsByKey = { ...(payload.draftsByKey ?? {}) };
  delete nextDraftsByKey[draftKey];
  const nextActiveKey = payload.activeKey === draftKey
    ? (Object.keys(nextDraftsByKey)[0] ?? null)
    : (payload.activeKey ?? null);
  await writePayload({
    activeKey: nextActiveKey,
    draftsByKey: nextDraftsByKey,
  });
}

export async function getActiveDocumentWizardDraftKey(): Promise<string | null> {
  const payload = await readPayload();
  return payload.activeKey ?? null;
}

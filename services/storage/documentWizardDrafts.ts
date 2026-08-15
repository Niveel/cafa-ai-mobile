import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UiMessage } from '@/components/chat/types';

const DOCUMENT_WIZARD_DRAFTS_KEY = 'cafa_ai_document_wizard_drafts_v2';
const LEGACY_DOCUMENT_WIZARD_DRAFTS_KEY = 'cafa_ai_document_wizard_drafts_v1';
const DEFAULT_DOCUMENT_WIZARD_DRAFT_KEY = 'standalone';

type DocumentWizardDraftsPayload = {
  activeKey?: string | null;
  draftsByKey?: Record<string, UiMessage[]>;
  discardedMessageIdsByKey?: Record<string, string[]>;
};

let mutationQueue: Promise<void> = Promise.resolve();

function enqueueMutation(mutation: () => Promise<void>) {
  mutationQueue = mutationQueue.then(mutation, mutation);
  return mutationQueue;
}

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
        discardedMessageIdsByKey:
          typeof parsed.discardedMessageIdsByKey === 'object' && parsed.discardedMessageIdsByKey
            ? parsed.discardedMessageIdsByKey
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
      discardedMessageIdsByKey: payload.discardedMessageIdsByKey ?? {},
    }),
  );
}

export async function getDocumentWizardDraftMessages(key?: string | null): Promise<UiMessage[]> {
  await mutationQueue.catch(() => {});
  const payload = await readPayload();
  const draftKey = normalizeDraftKey(key);
  const discardedIds = new Set(payload.discardedMessageIdsByKey?.[draftKey] ?? []);
  return (payload.draftsByKey?.[draftKey] ?? []).filter((message) => !discardedIds.has(message.id));
}

export async function setDocumentWizardDraftMessages(key: string | null | undefined, messages: UiMessage[]) {
  return enqueueMutation(async () => {
    const payload = await readPayload();
    const draftKey = normalizeDraftKey(key);
    const discardedIds = new Set(payload.discardedMessageIdsByKey?.[draftKey] ?? []);
    const nextDraftsByKey = {
      ...(payload.draftsByKey ?? {}),
      [draftKey]: messages.filter((message) => !discardedIds.has(message.id)),
    };
    await writePayload({
      ...payload,
      activeKey: draftKey,
      draftsByKey: nextDraftsByKey,
    });
  });
}

export async function clearDocumentWizardDraftMessages(key?: string | null) {
  return enqueueMutation(async () => {
    const payload = await readPayload();
    const draftKey = normalizeDraftKey(key);
    const nextDraftsByKey = { ...(payload.draftsByKey ?? {}) };
    delete nextDraftsByKey[draftKey];
    const nextActiveKey = payload.activeKey === draftKey
      ? (Object.keys(nextDraftsByKey)[0] ?? null)
      : (payload.activeKey ?? null);
    await writePayload({
      ...payload,
      activeKey: nextActiveKey,
      draftsByKey: nextDraftsByKey,
    });
  });
}

export async function discardDocumentWizardDraftMessages(
  key: string | null | undefined,
  messageIds: string[],
) {
  return enqueueMutation(async () => {
    const payload = await readPayload();
    const draftKey = normalizeDraftKey(key);
    const discardedIds = new Set([
      ...(payload.discardedMessageIdsByKey?.[draftKey] ?? []),
      ...messageIds,
    ]);
    const nextMessages = (payload.draftsByKey?.[draftKey] ?? [])
      .filter((message) => !discardedIds.has(message.id));
    const nextDraftsByKey = { ...(payload.draftsByKey ?? {}) };
    if (nextMessages.length) nextDraftsByKey[draftKey] = nextMessages;
    else delete nextDraftsByKey[draftKey];
    await writePayload({
      ...payload,
      activeKey: payload.activeKey === draftKey && !nextMessages.length ? null : payload.activeKey,
      draftsByKey: nextDraftsByKey,
      discardedMessageIdsByKey: {
        ...(payload.discardedMessageIdsByKey ?? {}),
        [draftKey]: [...discardedIds].slice(-200),
      },
    });
  });
}

export async function getActiveDocumentWizardDraftKey(): Promise<string | null> {
  const payload = await readPayload();
  return payload.activeKey ?? null;
}

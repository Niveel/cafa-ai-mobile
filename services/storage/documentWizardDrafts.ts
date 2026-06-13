import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UiMessage } from '@/components/chat/types';

const DOCUMENT_WIZARD_DRAFTS_KEY = 'cafa_ai_document_wizard_drafts_v1';

type DocumentWizardDraftsPayload = {
  messages: UiMessage[];
};

export async function getDocumentWizardDraftMessages(): Promise<UiMessage[]> {
  const raw = await AsyncStorage.getItem(DOCUMENT_WIZARD_DRAFTS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Partial<DocumentWizardDraftsPayload>;
    return Array.isArray(parsed.messages) ? parsed.messages : [];
  } catch {
    return [];
  }
}

export async function setDocumentWizardDraftMessages(messages: UiMessage[]) {
  await AsyncStorage.setItem(DOCUMENT_WIZARD_DRAFTS_KEY, JSON.stringify({ messages }));
}

export async function clearDocumentWizardDraftMessages() {
  await AsyncStorage.removeItem(DOCUMENT_WIZARD_DRAFTS_KEY);
}

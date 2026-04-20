import { Platform } from 'react-native';
import { ChatModelKey } from './types';

export const CHAT_MODEL_OPTIONS: { key: ChatModelKey; label: string; description: string }[] = [
  { key: 'ultra', label: 'Cafa Ultra', description: 'Best quality (uses more compute)' },
  { key: 'smart', label: 'Cafa Smart', description: 'Balanced quality' },
  { key: 'swift', label: 'Cafa Swift', description: 'Light tasks and fast' },
];

export const CAFA_MODEL_LABELS: Record<ChatModelKey, string> = {
  ultra: 'Cafa Ultra',
  smart: 'Cafa Smart',
  swift: 'Cafa Swift',
};

export function mapUiModelToBackendModel(model: ChatModelKey) {
  if (model === 'ultra') return 'gpt-4o';
  return 'gpt-4o-mini';
}

export function resolveModelBadgeLabel(backendModel: string | undefined, requestedModel: ChatModelKey) {
  if (backendModel === 'gpt-4o') return CAFA_MODEL_LABELS.ultra;
  if (backendModel === 'gpt-4o-mini') return CAFA_MODEL_LABELS[requestedModel] ?? CAFA_MODEL_LABELS.smart;
  if (backendModel === 'cafa_ultra') return CAFA_MODEL_LABELS.ultra;
  if (backendModel === 'cafa_smart') return CAFA_MODEL_LABELS.smart;
  if (backendModel === 'cafa_swift') return CAFA_MODEL_LABELS.swift;
  return CAFA_MODEL_LABELS[requestedModel] ?? CAFA_MODEL_LABELS.smart;
}

export const GUEST_TTS_RATE = Platform.select({
  ios: 0.52,
  android: 0.86,
  default: 0.86,
});

export function getPromptTitle(prompt: string, fallbackTitle = 'New guest chat') {
  const trimmed = prompt.trim();
  if (!trimmed) return fallbackTitle;
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed;
}

export function createIdempotencyKey(conversationId: string) {
  return `${conversationId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function extractImagePrompt(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) return null;

  const cleaned = normalized
    .replace(/^[\s,.:;!?-]+/, '')
    .replace(/[\s,.:;!?-]+$/, '');

  const imageNouns = '(?:image|picture|photo|illustration|artwork|render(?:ing)?|visual|wallpaper|poster)';
  const generationVerbs = '(?:generate|create|make|draw|design|produce|craft|render)';
  const politePrefix = '(?:(?:please|kindly)\\s+)?(?:(?:can|could|would)\\s+you\\s+)?';

  const patterns = [
    new RegExp(`^${politePrefix}${generationVerbs}\\s+(?:(?:me|us)\\s+)?(?:(?:an?|the)\\s+)?${imageNouns}\\s*(?:of|for|showing|that\\s+shows)?\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:draw|render|illustrate|sketch)\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:give\\s+me|show\\s+me|i\\s+want|i\\s+need|can\\s+i\\s+get|could\\s+i\\s+get)\\s+(?:(?:an?|the)\\s+)?${imageNouns}\\s*(?:of|for|showing)?\\s+(.+)$`, 'i'),
    new RegExp(`^(?:(?:an?|the)\\s+)?${imageNouns}\\s*(?:of|for|showing)?\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:turn|convert|make)\\s+(?:this|that|it)\\s+(?:into|as)\\s+(?:(?:an?|the)\\s+)?${imageNouns}\\s*:?\\s+(.+)$`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1]
        .trim()
        .replace(/^["'`]+/, '')
        .replace(/["'`]+$/, '');
    }
  }

  return null;
}

export function extractVideoPrompt(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) return null;

  const cleaned = normalized
    .replace(/^[\s,.:;!?-]+/, '')
    .replace(/[\s,.:;!?-]+$/, '');

  const videoNouns = '(?:video|clip|animation|movie|footage|reel|short)';
  const generationVerbs = '(?:generate|create|make|produce|craft|render)';
  const politePrefix = '(?:(?:please|kindly)\\s+)?(?:(?:can|could|would)\\s+you\\s+)?';

  const patterns = [
    new RegExp(`^${politePrefix}${generationVerbs}\\s+(?:(?:me|us)\\s+)?(?:(?:an?|the)\\s+)?${videoNouns}\\s*(?:of|for|showing|that\\s+shows)?\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:give\\s+me|show\\s+me|i\\s+want|i\\s+need|can\\s+i\\s+get|could\\s+i\\s+get)\\s+(?:(?:an?|the)\\s+)?${videoNouns}\\s*(?:of|for|showing)?\\s+(.+)$`, 'i'),
    new RegExp(`^(?:(?:an?|the)\\s+)?${videoNouns}\\s*(?:of|for|showing)?\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:animate|turn|convert|make)\\s+(?:this|that|it)\\s+(?:into|as)\\s+(?:(?:a|the)\\s+)?${videoNouns}\\s*:?\\s+(.+)$`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1]
        .trim()
        .replace(/^["'`]+/, '')
        .replace(/["'`]+$/, '');
    }
  }

  return null;
}

export function isMediaGenerationPrompt(value: string) {
  return Boolean(extractImagePrompt(value) || extractVideoPrompt(value));
}

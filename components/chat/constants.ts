import { Platform } from 'react-native';
import { getLocalizedList, type AppLanguage } from '@/config';
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

export const STARTER_PROMPTS_PER_CHAT = 3;

export const STARTER_PROMPT_POOL = getLocalizedList('en', 'chat.starterPrompts');

export function getStarterPromptPool(language: AppLanguage) {
  return getLocalizedList(language, 'chat.starterPrompts');
}

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

  if (/\b(?:turn|convert|make|transform|animate)\b[\s\S]*\b(?:into|as)\s+(?:a\s+|the\s+)?(?:video|clip|animation|movie|footage|reel|short)\b/i.test(cleaned)) {
    return null;
  }

  const imageNouns = '(?:image|picture|photo|illustration|artwork|render(?:ing)?|visual|wallpaper|poster)';
  const generationVerbs = '(?:generate|create|make|draw|design|produce|craft|render)';
  const descriptorWords = '(?:(?:[a-z0-9-]+\\s+){0,3})';
  const politePrefix = '(?:(?:please|kindly)\\s+)?(?:(?:can|could|would)\\s+you\\s+)?';

  const patterns = [
    new RegExp(`^${politePrefix}${generationVerbs}\\s+(?:(?:me|us)\\s+)?(?:(?:an?|the)\\s+)?${descriptorWords}${imageNouns}\\s*(?:of|for|showing|that\\s+shows)?\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:draw|render|illustrate|sketch)\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:give\\s+me|show\\s+me|i\\s+want|i\\s+need|can\\s+i\\s+get|could\\s+i\\s+get)\\s+(?:(?:an?|the)\\s+)?${descriptorWords}${imageNouns}\\s*(?:of|for|showing)?\\s+(.+)$`, 'i'),
    new RegExp(`^(?:(?:an?|the)\\s+)?${descriptorWords}${imageNouns}\\s*(?:of|for|showing)?\\s+(.+)$`, 'i'),
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

export function isLikelyImageGenerationIntent(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;

  const hasImageNoun =
    /\b(image|picture|photo|illustration|artwork|render|rendering|visual|wallpaper|poster|chart|graph|diagram|infographic)\b/.test(normalized);
  const hasGenerationVerb = /\b(generate|create|make|draw|design|produce|craft|render|illustrate|sketch)\b/.test(normalized);
  const hasQuestionLead = /^(what|why|how|when|where|who|which|can you|could you|would you|is|are|do|does|did)\b/.test(normalized);
  const startsLikeCreativePrompt =
    /^(a|an|the)\s+/.test(normalized)
    || /^(bar|line|pie|area|scatter)\s+chart\b/.test(normalized)
    || /^(graph|diagram|infographic)\b/.test(normalized);

  if (hasQuestionLead) return false;
  return hasImageNoun && (hasGenerationVerb || startsLikeCreativePrompt);
}

export function extractVideoPrompt(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) return null;

  const cleaned = normalized
    .replace(/^[\s,.:;!?-]+/, '')
    .replace(/[\s,.:;!?-]+$/, '');

  if (/^(?:(?:please|kindly)\s+)?(?:(?:can|could|would)\s+you\s+)?(?:turn|convert|make|transform|animate)\s+(?:this|that|it)(?:\s+(?:image|picture|photo))?\s+(?:into|as)\s+(?:(?:a|the)\s+)?(?:video|clip|animation|movie|footage|reel|short)\s*$/i.test(cleaned)) {
    return cleaned;
  }

  const videoNouns = '(?:video|clip|animation|movie|footage|reel|short)';
  const generationVerbs = '(?:generate|create|make|produce|craft|render|turn|convert|transform|animate)';
  const descriptorWords = '(?:(?:[a-z0-9-]+\\s+){0,3})';
  const politePrefix = '(?:(?:please|kindly)\\s+)?(?:(?:can|could|would)\\s+you\\s+)?';

  const patterns = [
    new RegExp(`^${politePrefix}${generationVerbs}\\s+(?:(?:me|us)\\s+)?(?:(?:an?|the)\\s+)?${descriptorWords}${videoNouns}\\s*(?:of|for|showing|that\\s+shows|from)?\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:give\\s+me|show\\s+me|i\\s+want|i\\s+need|can\\s+i\\s+get|could\\s+i\\s+get)\\s+(?:(?:an?|the)\\s+)?${descriptorWords}${videoNouns}\\s*(?:of|for|showing|from)?\\s+(.+)$`, 'i'),
    new RegExp(`^(?:(?:an?|the)\\s+)?${descriptorWords}${videoNouns}\\s*(?:of|for|showing|from)?\\s+(.+)$`, 'i'),
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

export function isLikelyVideoGenerationIntent(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;
  const hasVideoNoun = /\b(video|clip|animation|movie|footage|reel|short)\b/.test(normalized);
  const hasGenerationVerb = /\b(generate|create|make|produce|craft|render|animate|turn|convert|transform)\b/.test(normalized);
  return hasVideoNoun && hasGenerationVerb;
}

export function isMediaGenerationPrompt(value: string) {
  return Boolean(extractImagePrompt(value) || extractVideoPrompt(value));
}

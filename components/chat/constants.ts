import { Platform } from 'react-native';
import { ChatModelKey } from './types';

export const IMAGE_MODE_PROMPTS = [
  'Generate image of a futuristic government operations center.',
  'Generate image of an underwater research city with glowing coral.',
  'Generate image of a cinematic aerial view of a neon megacity.',
  'Generate image of a modern courtroom with holographic evidence displays.',
];

export const VIDEO_MODE_PROMPTS = [
  'Generate video of drones coordinating disaster relief over a coastal city.',
  'Generate video of a smart city skyline transitioning from sunset to neon night.',
  'Generate video of a national emergency war room during a cyber incident.',
  'Generate video of a futuristic parliament session with transparent voting screens.',
];

export const QUICK_PROMPTS = [
  'Draft a strategic memo for national AI adoption in education.',
  'Summarize top risks in government chatbot deployment.',
  'Generate image of a modern smart city command center at sunset.',
];

export const CHAT_MODEL_OPTIONS: { key: ChatModelKey; label: string; description: string }[] = [
  { key: 'ultra', label: 'Cafa Ultra', description: 'Best quality (uses more compute)' },
  { key: 'smart', label: 'Cafa Smart', description: 'Balanced quality' },
  { key: 'swift', label: 'Cafa Swift', description: 'Light tasks and fast' },
];

export const GUEST_TTS_RATE = Platform.select({
  ios: 0.46,
  android: 0.78,
  default: 0.78,
});

export function getPromptTitle(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed) return 'New guest chat';
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed;
}

export function createIdempotencyKey(conversationId: string) {
  return `${conversationId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isMediaGenerationPrompt(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes('generate image') || normalized.includes('generate video');
}

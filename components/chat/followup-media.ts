import type { UiMessage } from './types';

const VIDEO_FOLLOW_UP_PHRASES = [
  'continue this video',
  'continue the video',
  'add another scene',
  'extend this video',
  'extend the video',
  'make the ending different',
  'new ending',
  'next scene',
  'continue from here',
] as const;

const IMAGE_FOLLOW_UP_PHRASES = [
  'make this brighter',
  'improve the details',
  'change this to',
  'edit this image',
  'make it more',
  'same image',
  'watercolor style',
  'cinematic lighting',
] as const;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function similarityScore(a: string, b: string) {
  const maxLen = Math.max(a.length, b.length);
  if (!maxLen) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

function matchesFuzzyPhrase(input: string, phrase: string) {
  const normalizedInput = normalizeText(input);
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedInput || !normalizedPhrase) return false;

  if (normalizedInput.includes(normalizedPhrase)) return true;

  const inputWords = normalizedInput.split(' ');
  const phraseWords = normalizedPhrase.split(' ');
  const windowSize = Math.max(phraseWords.length, 2);

  for (let i = 0; i < inputWords.length; i += 1) {
    const window = inputWords.slice(i, i + windowSize).join(' ');
    if (!window) continue;
    if (similarityScore(window, normalizedPhrase) >= 0.72) {
      return true;
    }
  }

  return similarityScore(normalizedInput, normalizedPhrase) >= 0.7;
}

export function hasVideoContextInThread(messages: UiMessage[]) {
  return messages.some((message) =>
    message.role === 'assistant' && Boolean(message.videoUrl || message.videoId || message.videoPrompt));
}

export function hasImageContextInThread(messages: UiMessage[]) {
  return messages.some((message) =>
    message.role === 'assistant' && Boolean(message.imageUrl || message.imageId || message.imagePrompt));
}

export function isLikelyVideoFollowUpPrompt(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return VIDEO_FOLLOW_UP_PHRASES.some((phrase) => matchesFuzzyPhrase(normalized, phrase));
}

export function isLikelyImageFollowUpPrompt(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return IMAGE_FOLLOW_UP_PHRASES.some((phrase) => matchesFuzzyPhrase(normalized, phrase));
}

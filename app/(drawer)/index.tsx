import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import {
  Alert,
  type GestureResponderEvent,
  AccessibilityInfo,
  ActivityIndicator,
  Dimensions,
  findNodeHandle,
  Keyboard, 
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  DedicatedMediaScreen,
  DocumentWizardArtifact,
  PromptSuggestionContext,
} from '@/types';
import * as Clipboard from 'expo-clipboard';
import * as ExpoDocumentPicker from 'expo-document-picker';
import * as ExpoImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { File, Paths } from 'expo-file-system';
import CafaPaste, { type PastedItem } from '@/modules/cafa-paste';
import { Image as ExpoImage } from 'expo-image';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  LinearTransition,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import {
  AppScreen,
  AppLogo,
  ChatVideoCard,
  DocumentWizardCard,
  FileGenerationPlaceholder,
  ImageLightbox,
  PromptSuggestionsModal,
  CHAT_MODEL_OPTIONS,
  GUEST_TTS_RATE,
  ImageRequirementCard,
  ImageGenerationPlaceholder,
  ImageMessageActionsRow,
  MessageActionsRow,
  RecordingWaves,
  ScreenHandoffCard,
  StreamingMarkdown,
  extractImagePrompt,
  extractVideoPrompt,
  resolveModelBadgeLabel,
  UserPromptActionsRow,
  VideoGenerationPlaceholder,
  createStarterPromptCycler,
  getStarterPromptPool,
  createIdempotencyKey,
  getPromptTitle,
  isLikelyImageGenerationIntent,
  isLikelyImageFollowUpPrompt,
  isLikelyReferencedMediaQuestionPrompt,
  isLikelyVideoGenerationIntent,
  isLikelyVideoFollowUpPrompt,
  isMediaGenerationPrompt,
  type AttachedAsset,
  type UiMessage,
  type UiMessageAttachment,
  type UiMessageToolCall,
  type UiMessageProduct,
  type UiArtifactItem,
  ShimmerText,
  FileCard,
  sanitizeModelText,
  stripFileDownloadLinks,
  ToolStatusChips,
  TypingIndicator,
  ProductCards,
  ArtifactPanel,
  AssistantWidget,
  UpgradePromptCard,
  SandboxBuildNotice,
  CafaLiveToggle,
} from '@/components';
import { NotificationBell, PushNudgeBanner } from '@/features/notifications';
import { AppPromptModal } from '@/components/ui/AppPromptModal';
import { useAppContext } from '@/context';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { pickSingleImageFromLibrary } from '@/utils/deviceImagePicker';
import {
  createAuthenticatedConversation,
  createGuestConversation,
  ensureGuestSession,
  editImage,
  fetchPromptSuggestions,
  generateImage,
  generateChart,
  getDedicatedMediaConversation,
  generateVideoFromImageDirect,
  rewriteMediaPrompt,
  syncSubscriptionState,
  getSubscriptionOverview,
  getAuthenticatedConversation,
  getGuestConversation,
  getVoiceCatalog,
  pollVideoJob,
  getArtifactsPage,
  sendAuthenticatedMessageStream,
  pollQuickReplies,
  sendAuthenticatedMessageNonStream,
  sendGuestMessageStream,
  startVideoGeneration,
  startVideoGenerationFromImage,
  synthesizeVoice,
  createSynthesizeStreamToken,
  getSynthesizeStreamUrl,
  toggleAuthenticatedMessageReaction,
  isDedicatedMediaConversationUnavailable,
  deleteArtifact,
  getSuggestedPrompts,
} from '@/features';
import { useAppTheme, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib';
import { AnalyticsEvents } from '@/lib/analytics/events';
import { captureEvent } from '@/lib/analytics/posthog';
import {
  AD_REWARD_DAILY_LIMITS,
  AD_REWARD_GRANTS,
  claimRewardSession,
  createRewardSession,
  clearDocumentWizardDraftMessages,
  discardDocumentWizardDraftMessages,
  emitChatMutated,
  getDocumentWizardDraftMessages,
  getRewardEligibility,
  getAccessToken,
  getDefaultVoicePreference,
  setDocumentWizardDraftMessages,
  startDocumentWizard,
  showRewardedAd,
} from '@/services';
import {
  IOS_PHOTO_PERMISSION_DENIED_CODE,
  MOTION,
  hapticError,
  hapticImpact,
  hapticSelection,
  hapticSuccess,
  resolveNotificationRoute,
  copyAssetToClipboard,
  downloadAndSaveFile,
  extensionOf,
  identityFromExtension,
  identityFromMime,
  saveMediaToCafaAlbum,
  shareAssetFile,
} from '@/utils';

// hi

type AudioPlayer = {
  addListener: (eventName: string, listener: (status: { didJustFinish?: boolean }) => void) => { remove: () => void };
  play: () => void;
  pause: () => void;
  remove: () => void;
};

type AudioPlayerSource = string | { uri?: string; headers?: Record<string, string> };

type ExpoAudioModule = {
  createAudioPlayer: (source: AudioPlayerSource, options?: { keepAudioSessionActive?: boolean }) => AudioPlayer;
};

type ImagePickerModule = {
  launchImageLibraryAsync: typeof ExpoImagePicker.launchImageLibraryAsync;
  launchCameraAsync: typeof ExpoImagePicker.launchCameraAsync;
  requestCameraPermissionsAsync: () => Promise<{ granted: boolean }>;
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean; canAskAgain?: boolean }>;
};

type DocumentPickerModule = {
  getDocumentAsync: (options: {
    copyToCacheDirectory: boolean;
    multiple: boolean;
    type: string | string[];
  }) => Promise<{
    canceled: boolean;
    assets?: { name?: string | null; uri: string; mimeType?: string | null }[];
  }>;
};

type SharingModule = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (url: string, options?: { mimeType?: string; dialogTitle?: string }) => Promise<void>;
};

type ExpoWebBrowserModule = {
  openBrowserAsync: (url: string) => Promise<unknown>;
};

type ComposerMediaReference = {
  kind: 'image' | 'video';
  id?: string;
  url: string;
};

type ChatScreenMode = 'chat' | 'image-to-video' | 'edit-image';

// Web parity (2026-09-27): Edit Image and Image to Video send through the
// normal chat stream to the GET /chat/mode/:screen conversation. The old
// direct /media/* calls and the /media/prompts/rewrite step are kept behind
// these switches for rollback only.
const USE_MEDIA_PROMPT_REWRITE = false;
const USE_LEGACY_DEDICATED_MEDIA_CALLS = false;

// Real parity port of web's IMAGE_MODE_PROMPTS / VIDEO_MODE_PROMPTS
// (features/chat/components/chat-shell/constants.tsx) -- the "Image
// generation shortcut" / "Video generation shortcut" composer buttons
// insert a random one of these into the composer, matching web exactly.
const IMAGE_MODE_PROMPTS = [
  'Generate image of a futuristic government operations center.',
  'Generate image of a floating eco-city above the ocean at dawn.',
  'Generate image of a cyberpunk marketplace in heavy rain.',
  'Generate image of an ancient library on the moon.',
  'Generate image of a luxury train crossing a glass desert.',
  'Generate image of a high-tech hospital in a rainforest valley.',
  'Generate image of a robotics lab inside a mountain.',
  'Generate image of an underwater research city with glowing coral.',
  'Generate image of a medieval castle rebuilt with modern architecture.',
  'Generate image of a minimalist smart home on a cliffside.',
  'Generate image of a bustling Mars colony main street at sunset.',
  'Generate image of a cinematic aerial view of a neon megacity.',
  'Generate image of a serene Japanese garden on a space station.',
  'Generate image of a rescue command center during a snowstorm.',
  'Generate image of a desert festival with giant kinetic sculptures.',
];

// Real parity port of web's personalized empty-state greeting
// (ChatShell.tsx GREETING_TEMPLATES/getTimeBucket/hashString/
// personalizedGreeting) -- real local time-of-day + the real user's name,
// picked deterministically from a small set of variants (not an LLM call)
// so it stays stable through the day/session rather than reshuffling.
const GREETING_TEMPLATES: Record<'morning' | 'afternoon' | 'evening' | 'night', string[]> = {
  morning: [
    'Good morning, {name}.',
    'Morning, {name}! Ready when you are.',
    'Good morning, {name} -- what are we diving into today?',
  ],
  afternoon: [
    'Good afternoon, {name}.',
    'Afternoon, {name}! What can I help with?',
    "Good afternoon, {name} -- what's on your mind?",
  ],
  evening: [
    'Good evening, {name}.',
    'Evening, {name}! How can I help?',
    "Good evening, {name} -- let's get started.",
  ],
  night: [
    'Working late, {name}?',
    'Good to see you, {name}.',
    "Hey {name}, still up? Let's make it count.",
  ],
};

function hashGreetingKey(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function capitalizeName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.split('-').map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join('-'))
    .join(' ');
}

function getGreetingTimeBucket(hour: number): keyof typeof GREETING_TEMPLATES {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

const VIDEO_MODE_PROMPTS = [
  'Generate video of a futuristic government operations center at shift change.',
  'Generate video of drones coordinating disaster relief over a coastal city.',
  'Generate video of a smart city skyline transitioning from sunset to neon night.',
  'Generate video of a high-speed train entering a mountain megastation.',
  'Generate video of a climate control room visualizing global weather in real time.',
  'Generate video of an autonomous port with robotic cranes loading cargo ships.',
  'Generate video of an AI classroom where holographic lessons adapt to students.',
  'Generate video of a space colony marketplace bustling at dawn.',
  'Generate video of a biotech lab assembling custom medicine with robots.',
  'Generate video of a wildfire command center coordinating response teams.',
  'Generate video of an underwater research city with glowing transit pods.',
  'Generate video of emergency responders deploying flood barriers in minutes.',
  'Generate video of a courtroom using holographic evidence playback.',
  'Generate video of a mountain observatory opening at night under auroras.',
  'Generate video of a future airport terminal with autonomous baggage swarms.',
];

type ScreenHandoffConfig = {
  target: 'index' | 'image-to-video' | 'edit-image';
  title: string;
  description: string;
  ctaLabel: string;
  iconName: 'chatbubble-ellipses-outline' | 'film-outline' | 'color-wand-outline';
};

type ImageRequirementConfig = {
  title: string;
  description: string;
  ctaLabel: string;
  iconName: 'image-outline';
};

let expoAudioModulePromise: Promise<ExpoAudioModule> | null = null;
let imagePickerModulePromise: Promise<ImagePickerModule> | null = null;
let documentPickerModulePromise: Promise<DocumentPickerModule> | null = null;
let sharingModulePromise: Promise<unknown> | null = null;
let webBrowserModulePromise: Promise<ExpoWebBrowserModule> | null = null;

function focusAccessibilityNode(target: View | null) {
  const node = target ? findNodeHandle(target) : null;
  if (node) {
    AccessibilityInfo.setAccessibilityFocus?.(node);
  }
}

async function getExpoAudioModule() {
  if (!expoAudioModulePromise) {
    expoAudioModulePromise = import('expo-audio') as Promise<ExpoAudioModule>;
  }

  try {
    return await expoAudioModulePromise;
  } catch {
    expoAudioModulePromise = null;
    throw new Error('Audio playback is unavailable in this build. Rebuild the app or update Expo Go.');
  }
}

async function getImagePickerModule() {
  try {
    if (!imagePickerModulePromise) {
      imagePickerModulePromise = import('expo-image-picker') as Promise<ImagePickerModule>;
    }
    const loaded = await imagePickerModulePromise;
    const moduleCandidate = ((loaded as { default?: unknown })?.default ?? loaded) as Partial<ImagePickerModule> | null | undefined;
    if (!moduleCandidate || typeof moduleCandidate.launchImageLibraryAsync !== 'function') {
      const staticCandidate = ExpoImagePicker as Partial<ImagePickerModule>;
      if (typeof staticCandidate.launchImageLibraryAsync === 'function') {
        return staticCandidate as ImagePickerModule;
      }
      throw new Error('Image picker module is not available.');
    }
    return moduleCandidate as ImagePickerModule;
  } catch (error) {
    imagePickerModulePromise = null;
    const staticCandidate = ExpoImagePicker as Partial<ImagePickerModule>;
    if (typeof staticCandidate.launchImageLibraryAsync === 'function') {
      return staticCandidate as ImagePickerModule;
    }
    if (__DEV__) {
      console.log('[image-picker:load-failed]', error);
    }
    throw new Error('Image picker is unavailable in this build. Rebuild the app or update Expo Go.');
  }
}

async function getDocumentPickerModule() {
  try {
    if (!documentPickerModulePromise) {
      documentPickerModulePromise = import('expo-document-picker') as Promise<DocumentPickerModule>;
    }
    const loaded = await documentPickerModulePromise;
    const moduleCandidate =
      ((loaded as { default?: unknown })?.default ?? loaded) as Partial<DocumentPickerModule> | null | undefined;
    if (!moduleCandidate || typeof moduleCandidate.getDocumentAsync !== 'function') {
      const staticCandidate = ExpoDocumentPicker as Partial<DocumentPickerModule>;
      if (typeof staticCandidate.getDocumentAsync === 'function') {
        return staticCandidate as DocumentPickerModule;
      }
      throw new Error('Document picker module is not available.');
    }
    return moduleCandidate as DocumentPickerModule;
  } catch (error) {
    documentPickerModulePromise = null;
    const staticCandidate = ExpoDocumentPicker as Partial<DocumentPickerModule>;
    if (typeof staticCandidate.getDocumentAsync === 'function') {
      return staticCandidate as DocumentPickerModule;
    }
    if (__DEV__) {
      console.log('[document-picker:load-failed]', error);
    }
    throw new Error('Document picker is unavailable in this build. Rebuild the app or update Expo Go.');
  }
}

async function getSharingModule() {
  try {
    if (!sharingModulePromise) {
      // Use Promise.resolve().then(...) so sync module-resolution failures are caught here.
      sharingModulePromise = Promise.resolve().then(() => import('expo-sharing'));
    }
    const loaded = await sharingModulePromise;
    const candidate = (loaded as { default?: unknown })?.default ?? loaded;
    const moduleLike = candidate as Partial<SharingModule> | null | undefined;
    if (
      moduleLike
      && typeof moduleLike.isAvailableAsync === 'function'
      && typeof moduleLike.shareAsync === 'function'
    ) {
      return moduleLike as SharingModule;
    }
    console.log('[sharing:unavailable] expo-sharing loaded but API shape is invalid.');
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[sharing:load-error] ${message}`);
    sharingModulePromise = null;
    return null;
  }
}

async function getWebBrowserModule() {
  if (!webBrowserModulePromise) {
    webBrowserModulePromise = import('expo-web-browser') as Promise<ExpoWebBrowserModule>;
  }

  try {
    return await webBrowserModulePromise;
  } catch {
    webBrowserModulePromise = null;
    throw new Error('In-app browser is unavailable in this build.');
  }
}

// The backend often sends a generated document without a file name. Its title is
// usually in the tool call's arguments, or quoted in the reply ("a PDF titled
// \"Cybersecurity Fundamentals\""), and is used to name the saved file.
function documentTitleFromArgs(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined;
  const record = args as Record<string, unknown>;
  for (const key of ['title', 'filename', 'file_name', 'fileName', 'name', 'document_title']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  for (const key of ['content', 'markdown', 'html', 'body', 'text']) {
    const fromContent = titleFromContentArg(record[key]);
    if (fromContent) return fromContent;
  }
  return undefined;
}

// First heading of generated markdown/HTML content, e.g. "# Lions of the Savanna".
function titleFromContentArg(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const heading =
    value.match(/^\s{0,3}#{1,2}\s+(.{3,100}?)\s*#*\s*$/m)?.[1]
    ?? value.match(/<h1[^>]*>([^<]{3,100})<\/h1>/i)?.[1];
  return heading?.replace(/[*_`]/g, '').trim() || undefined;
}

// A clean document title from the user's own request, for when nothing else names the
// file: "Create a PDF about lions with five lines" -> "Lions".
function titleFromPrompt(prompt: string | undefined): string | undefined {
  if (!prompt) return undefined;
  const cleaned = prompt
    .replace(/\s+/g, ' ')
    .trim()
    .replace(
      /^(?:please\s+|can you\s+|could you\s+|let'?s\s+)?(?:create|generate|make|write|build|prepare|draft|produce)\s+(?:me\s+)?(?:an?\s+|the\s+|some\s+)?(?:(?:pdf|word|docx?|powerpoint|ppt|pptx|slides?|presentation|document|file|report)\s+(?:file\s+)?){0,2}(?:of|about|on|for|covering)?\s*/i,
      '',
    )
    .replace(/\b(?:as|in|into)\s+(?:an?\s+)?(?:pdf|word|docx?|powerpoint|ppt|pptx)\b.*$/i, '')
    .replace(/\bwith\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:lines?|pages?|slides?|points?|paragraphs?).*$/i, '')
    .replace(/^(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:lines?|pages?|slides?|points?|paragraphs?)\s+(?:of|about|on)\s+/i, '')
    .replace(/\s+(?:and|then)\s+(?:rewrite|convert|summari[sz]e|translate|turn|make|write)\b.*$/i, '')
    .replace(/[.?!:,;]+$/, '')
    .trim();
  const words = cleaned.split(' ').filter(Boolean).slice(0, 7);
  if (!words.length) return undefined;
  const small = new Set(['a', 'an', 'and', 'of', 'the', 'in', 'on', 'for', 'to', 'at', 'by', 'or']);
  return words
    .map((word, index) => (index > 0 && small.has(word.toLowerCase()) ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

function documentFormatFromArgs(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined;
  const record = args as Record<string, unknown>;
  for (const key of ['format', 'file_format', 'fileFormat', 'file_type', 'fileType', 'type']) {
    const value = record[key];
    if (typeof value === 'string' && /^[a-z0-9]{2,5}$/i.test(value.trim())) return value.trim().toLowerCase();
  }
  return undefined;
}

function extractQuotedTitle(content: string | undefined): string | undefined {
  const match = (content ?? '').match(/titled\s+[“"'‘]([^”"'’\n]{3,100})[”"'’]/i);
  return match?.[1]?.trim() || undefined;
}

const STOPPED_ASSISTANT_IDS_KEY = 'cafa.stoppedAssistantIds';
const MAX_STORED_STOPPED_IDS = 200;

// The backend has no cancel for a chat turn: pressing Stop only disconnects the
// app, and the server may still finish and save the reply (e.g. an image). When
// that saved copy is loaded later it must not resurrect a turn the user stopped,
// so a stopped assistant message keeps only what had streamed locally.
function maskStoppedMessage(message: UiMessage, stoppedIds: Set<string>, localContent?: string): UiMessage {
  if (message.role !== 'assistant' || !stoppedIds.has(message.id)) return message;
  return {
    ...message,
    content: localContent ?? '',
    imageUrl: undefined,
    imagePrompt: undefined,
    imageId: undefined,
    videoUrl: undefined,
    videoPrompt: undefined,
    videoId: undefined,
    attachments: undefined,
    artifacts: undefined,
    tools: undefined,
    products: undefined,
    widget: undefined,
    quickReplies: undefined,
    isImageGenerating: false,
    isVideoGenerating: false,
    isArtifactGenerating: false,
    stopped: true,
  };
}

// A stopped turn cannot be cancelled on the server, so the reply may still be
// saved later, and not necessarily next to its own prompt (a tool result is
// often saved as a separate message at the END of the chat, after newer turns).
// The ledger therefore identifies a stopped turn in three id-independent ways:
//  - the user's prompt: `text` + `occurrence` (how many earlier user messages in
//    the chat had the same text, so retrying the same prompt is not hidden);
//  - the tool that was running (`tool` + `toolOccurrence`: how many assistant
//    messages with that tool existed before it), which finds the late result;
//  - the assistant message id, when it is known.
type StoppedTurn = {
  conversationId: string;
  text: string;
  occurrence: number;
  tool?: string;
  toolOccurrence?: number;
};
const STOPPED_TURNS_KEY = 'cafa.stoppedTurns';
const MAX_STORED_STOPPED_TURNS = 100;

function applyStoppedTurns(
  list: UiMessage[],
  conversationId: string | null | undefined,
  stoppedIds: Set<string>,
  turns: StoppedTurn[],
  localContentById?: Map<string, string>,
): UiMessage[] {
  const convTurns = conversationId ? turns.filter((turn) => turn.conversationId === conversationId) : [];
  if (!convTurns.length && !stoppedIds.size) return list;

  const maskIds = new Set<string>(); // stays where it is, shown as "stopped"
  const dropIds = new Set<string>(); // a late result saved somewhere else: hidden
  const insertAfter = new Map<number, UiMessage>();

  // 1. By the prompt: the reply right after it is the stopped one; if the
  // server saved nothing there, show a "stopped" placeholder in its place.
  const seenText = new Map<string, number>();
  list.forEach((message, index) => {
    if (message.role !== 'user') return;
    const text = message.content.trim();
    const occurrence = seenText.get(text) ?? 0;
    seenText.set(text, occurrence + 1);
    if (!convTurns.some((turn) => turn.text === text && turn.occurrence === occurrence)) return;
    const next = list[index + 1];
    if (next && next.role === 'assistant') {
      maskIds.add(next.id);
    } else {
      insertAfter.set(index, {
        id: `stopped-turn-${index}-${occurrence}`,
        role: 'assistant',
        content: '',
        createdAt: message.createdAt + 1,
        stopped: true,
      });
    }
  });

  // 2. By the tool that was running: that tool's result is the late arrival.
  const toolSeen = new Map<string, number>();
  list.forEach((message) => {
    if (message.role !== 'assistant') return;
    new Set((message.tools ?? []).map((tool) => tool.tool)).forEach((name) => {
      const index = toolSeen.get(name) ?? 0;
      toolSeen.set(name, index + 1);
      if (convTurns.some((turn) => turn.tool === name && turn.toolOccurrence === index) && !maskIds.has(message.id)) {
        dropIds.add(message.id);
      }
    });
  });

  // 3. By id.
  list.forEach((message) => {
    if (!stoppedIds.has(message.id) || maskIds.has(message.id)) return;
    if (convTurns.length) dropIds.add(message.id);
    else maskIds.add(message.id);
  });

  const out: UiMessage[] = [];
  list.forEach((message, index) => {
    if (dropIds.has(message.id)) return;
    out.push(
      maskIds.has(message.id)
        ? maskStoppedMessage(message, new Set([message.id]), localContentById?.get(message.id))
        : message,
    );
    const placeholder = insertAfter.get(index);
    if (placeholder) out.push(placeholder);
  });
  return out;
}

// The backend keeps the stopped prompt in the conversation history, so the next
// turn's model sees an unanswered request and happily does it too (seen on
// device: stop a PDF, ask for "kiwi", get a kiwi reply AND the PDF). There is no
// endpoint to delete a message, so the next message after a Stop carries a short
// context line telling the model that request was cancelled. The line is only
// for the model: it is stripped again whenever messages are shown in the app.
const CANCELLATION_NOTE_END = '". Do not do it. Answer only the message below.]';
const buildCancellationNote = (cancelledPrompt: string) =>
  `[Context: the user cancelled their previous request "${cancelledPrompt.replace(/\s+/g, ' ').slice(0, 200)}${CANCELLATION_NOTE_END}`;
const CANCELLATION_NOTES_PATTERN =
  /^(\[Context: the user cancelled their previous request "[\s\S]*?"\. Do not do it\. Answer only the message below\.\]\n)+\n/;
const stripCancellationNote = (content: string) => content.replace(CANCELLATION_NOTES_PATTERN, '');

type QueuedSend = { id: string; text: string; attachments: AttachedAsset[] };
type ActiveSendRun = {
  id: number;
  controller: AbortController;
  stoppedByUser: boolean;
  detached: boolean;
  lastTool?: string;
};
const MAX_QUEUED_SENDS = 5;
const DETACHED_RUN_RESUME_WINDOW_MS = 10 * 60 * 1000;

export default function ChatScreen({ screenMode = 'chat' }: { screenMode?: ChatScreenMode } = {}) {
  const COMPOSER_MIN_HEIGHT = 56;
  const COMPOSER_MAX_HEIGHT = 180;
  const COMPOSER_VERTICAL_PADDING = Platform.OS === 'ios' ? 6 : 4;
  const ANDROID_KEYBOARD_CALIBRATION = 6;
  const STREAM_FLUSH_INTERVAL_MS = 36;
  const STREAM_FLUSH_CHARS = 28;
  const VIDEO_JOB_POLL_ATTEMPTS = 300;
  const VIDEO_JOB_POLL_INTERVAL_MS = 4000;
  const VIDEO_JOB_RATE_LIMIT_BACKOFF_MS = 9000;
  const VIDEO_AUTO_SYNC_ATTEMPTS = 40;
  const VIDEO_AUTO_SYNC_INTERVAL_MS = 12000;
  const REWARD_VERIFICATION_ATTEMPTS = 15;
  const REWARD_VERIFICATION_INTERVAL_MS = 4000;
  const LIMIT_RESTORE_SYNC_TIMEOUT_MS = 60_000;
  const LIMIT_RESTORE_SYNC_POLL_MS = 3_000;
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, authUser, refreshAuthUser, setAuthSubscriptionTier } = useAppContext();
  const { activeTier, restorePurchases, refreshCustomerInfo } = useRevenueCat();
  const { t, language } = useI18n();
  const personalizedGreeting = useMemo(() => {
    if (!isAuthenticated) return null;
    const displayName = capitalizeName(authUser?.name ?? '') || 'User';
    const now = new Date();
    const bucket = getGreetingTimeBucket(now.getHours());
    const dayKey = now.toDateString();
    const templates = GREETING_TEMPLATES[bucket];
    const index = Math.abs(hashGreetingKey(`${dayKey}-${bucket}-${displayName}`)) % templates.length;
    return templates[index].replace('{name}', displayName);
  }, [authUser?.name, isAuthenticated]);
  const screenConfig = useMemo(() => {
    if (screenMode === 'image-to-video') {
      return {
        welcome: t('media.imageToVideo.welcome'),
        attachmentMenuAnnouncement: t('media.upload.imageMenuAnnouncement'),
        uploadTriggerLabel: t('media.upload.label'),
        uploadTriggerHint: t('media.upload.hint'),
        attachImageLabel: t('media.upload.imageLabel'),
        attachImageHint: t('media.upload.imageHint'),
        attachDocumentLabel: t('media.upload.documentLabel'),
        attachDocumentHint: t('media.upload.documentHint'),
        allowDocumentAttachment: false,
        placeholder: t('media.imageToVideo.placeholder'),
      };
    }
    if (screenMode === 'edit-image') {
      return {
        welcome: t('media.editImage.welcome'),
        attachmentMenuAnnouncement: t('media.upload.imageMenuAnnouncement'),
        uploadTriggerLabel: t('media.upload.label'),
        uploadTriggerHint: t('media.upload.hint'),
        attachImageLabel: t('media.upload.imageLabel'),
        attachImageHint: t('media.upload.imageHint'),
        attachDocumentLabel: t('media.upload.documentLabel'),
        attachDocumentHint: t('media.upload.documentHint'),
        allowDocumentAttachment: false,
        placeholder: t('media.editImage.placeholder'),
      };
    }
    return {
      welcome: personalizedGreeting ?? t('chat.welcome'),
      attachmentMenuAnnouncement: 'Upload menu opened. Choose image upload or document upload.',
      uploadTriggerLabel: 'Upload',
      uploadTriggerHint: 'Opens upload options.',
      attachImageLabel: 'Image upload',
      attachImageHint: 'Opens your photo library to select an image.',
      attachDocumentLabel: 'Document upload',
      attachDocumentHint: 'Opens the document picker.',
      allowDocumentAttachment: true,
      placeholder: t('chat.input.placeholder'),
    };
  }, [personalizedGreeting, screenMode, t]);
  const createWelcomeMessage = useCallback(
    (): UiMessage => ({
      id: 'welcome-1',
      role: 'assistant',
      content: screenConfig.welcome,
      createdAt: Date.now(),
    }),
    [screenConfig.welcome],
  );
  const isDedicatedMediaScreen = screenMode === 'image-to-video' || screenMode === 'edit-image';
  const params = useLocalSearchParams<{ conversationId?: string; newChat?: string; messageId?: string }>();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendQueue, setSendQueue] = useState<QueuedSend[]>([]);
  const [isResumingRun, setIsResumingRun] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [uploadProgressPercent, setUploadProgressPercent] = useState<number | null>(null);
  const [isUnderstandingPrompt, setIsUnderstandingPrompt] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [uploadOptionModalVisible, setUploadOptionModalVisible] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [attachedAssets, setAttachedAssets] = useState<AttachedAsset[]>([]);
  const [tooltipState, setTooltipState] = useState<{ text: string; x: number; y: number } | null>(null);
  const [activeModel, setActiveModel] = useState<'ultra' | 'smart' | 'swift'>('smart');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [artifactsPanelOpen, setArtifactsPanelOpen] = useState(false);
  const [isHydratingAuthChat, setIsHydratingAuthChat] = useState(false);
  const [composerHeight, setComposerHeight] = useState(COMPOSER_MIN_HEIGHT);
  const [composerScrollable, setComposerScrollable] = useState(false);
  const [androidComposerOffset, setAndroidComposerOffset] = useState(0);
  const [iosComposerOffset, setIosComposerOffset] = useState(0);
  const [authConversationId, setAuthConversationId] = useState<string | null>(null);
  const [guestConversationId, setGuestConversationId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState('');
  const [upgradeNoticeKind, setUpgradeNoticeKind] = useState<'chat' | 'image' | 'video' | null>(null);
  // CREDIT_LIMIT_EXCEEDED is fixed by buying credits; RATE_LIMIT_EXCEEDED
  // (plan cap) only by upgrading or waiting -- different button (web parity).
  const [upgradeNoticeIsCredits, setUpgradeNoticeIsCredits] = useState(false);
  const [upgradeNoticeResetHours, setUpgradeNoticeResetHours] = useState<number | null>(null);
  const [isLimitRestoreSyncing, setIsLimitRestoreSyncing] = useState(false);
  const [isRewardAdProcessing, setIsRewardAdProcessing] = useState(false);
  const [rewardAdOffer, setRewardAdOffer] = useState<{
    kind: 'chat' | 'image' | 'video';
    available: boolean | null;
  } | null>(null);
  const [guestUpsellVisible, setGuestUpsellVisible] = useState(false);
  const [guestAllowanceHydrated, setGuestAllowanceHydrated] = useState(false);
  const [guestMessageCount, setGuestMessageCount] = useState(0);
  const [guestAllowanceNotice, setGuestAllowanceNotice] = useState<16 | 20 | 23 | 25 | null>(null);
  const [downloadToastNotice, setDownloadToastNotice] = useState('');
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [sharingMediaMessageId, setSharingMediaMessageId] = useState<string | null>(null);
  const [composerMediaReference, setComposerMediaReference] = useState<ComposerMediaReference | null>(null);
  const [highlightedReferencedMediaTarget, setHighlightedReferencedMediaTarget] = useState<{
    messageId: string;
    kind: 'image' | 'video';
  } | null>(null);
  const [ttsToastNotice, setTtsToastNotice] = useState('');
  const [messageReactions, setMessageReactions] = useState<Record<string, 'like' | 'dislike' | undefined>>({});
  const [readingMessageId, setReadingMessageId] = useState<string | null>(null);
  const [isReadAloudPaused, setIsReadAloudPaused] = useState(false);
  const readAloudUsesNativeFallbackRef = useRef(false);
  const [assetAccessToken, setAssetAccessToken] = useState<string | null>(null);
  const [readAloudSpeaker, setReadAloudSpeaker] = useState<string | null>(null);
  const [isReadAloudLoading, setIsReadAloudLoading] = useState(false);
  const [streamingModelLabel, setStreamingModelLabel] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [imageLightboxUri, setImageLightboxUri] = useState<string | null>(null);
  const [promptSuggestionsVisible, setPromptSuggestionsVisible] = useState(false);
  const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
  const [isPromptSuggestionsLoading, setIsPromptSuggestionsLoading] = useState(false);
  const [documentFormWarningVisible, setDocumentFormWarningVisible] = useState(false);
  const [documentWizardFocusTargetId, setDocumentWizardFocusTargetId] = useState<string | null>(null);
  const canAttachDocuments = isAuthenticated && (authUser?.subscriptionTier ?? 'free') !== 'free';
  const allowDocumentAttachment = screenConfig.allowDocumentAttachment && canAttachDocuments;
  const tier = authUser?.subscriptionTier ?? 'free';
  const canWatchRewardedAds = isAuthenticated && tier === 'free' && activeTier === 'free';
  const canUseUltraModel = isAuthenticated && (tier === 'cafa_pro' || tier === 'cafa_max');
  const availableChatModelOptions = useMemo(
    () => CHAT_MODEL_OPTIONS.filter((option) => option.key !== 'ultra' || canUseUltraModel),
    [canUseUltraModel],
  );
  const [starterPrompts, setStarterPrompts] = useState<string[]>([]);
  const dedicatedComposerHelperText = useMemo(() => {
    if (!isDedicatedMediaScreen) return '';
    const hasPrompt = input.trim().length > 0;
    const hasImage = attachedAssets.some((asset) => (asset.mimeType ?? '').toLowerCase().startsWith('image/'));

    if (!hasPrompt && !hasImage) return 'Upload an image and add a prompt to continue.';
    if (!hasPrompt) {
      return screenMode === 'image-to-video'
        ? 'Add a prompt describing the motion, camera movement, or scene you want.'
        : 'Add a prompt describing the changes you want.';
    }
    if (!hasImage) return 'Upload an image to continue.';
    return '';
  }, [attachedAssets, input, isDedicatedMediaScreen, screenMode]);
  const hasPromptSuggestionTrigger = input.trim().length > 0;
  const messagesListRef = useRef<FlashListRef<UiMessage>>(null);
  const lastJumpedMessageKeyRef = useRef<string>('');
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const composerInputRef = useRef<TextInput>(null);
  const inputValueRef = useRef('');
  const promptSuggestionAbortRef = useRef<AbortController | null>(null);
  const autoScrollEnabledRef = useRef(true);
  const showScrollButtonRef = useRef(false);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardEligibilityRequestRef = useRef(0);
  const downloadToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guestUpsellStateRef = useRef<{ windowStartedAt: number; responseCount: number; shown: boolean }>({
    windowStartedAt: 0,
    responseCount: 0,
    shown: false,
  });
  const guestMessageCountRef = useRef(0);
  const menuTouchRef = useRef(false);
  const documentDraftHydratedRef = useRef(false);
  const conversationHydrationRequestRef = useRef(0);
  const routedConversationIdRef = useRef('');
  const currentConversationIdRef = useRef<string | null>(null);
  routedConversationIdRef.current = typeof params.conversationId === 'string' ? params.conversationId : '';
  currentConversationIdRef.current = (isAuthenticated ? authConversationId : guestConversationId) ?? null;
  const uploadTriggerButtonRef = useRef<View | null>(null);
  const uploadImageOptionRef = useRef<View | null>(null);
  const uploadDocumentOptionRef = useRef<View | null>(null);
  const uploadCancelOptionRef = useRef<View | null>(null);
  const takePhotoOptionRef = useRef<View | null>(null);
  const chooseGalleryOptionRef = useRef<View | null>(null);
  const chooserCancelOptionRef = useRef<View | null>(null);
  const speechDraftRef = useRef('');
  const isRecordingRef = useRef(false);
  const lastImagePromptIndexRef = useRef(-1);
  const lastVideoPromptIndexRef = useRef(-1);
  const speechRecognitionRequestedRef = useRef(false);
  const activeReadAloudRequestRef = useRef(0);
  const assistantFirstDeltaRef = useRef(false);
  const pendingDeltaRef = useRef('');
  const pendingAssistantIdRef = useRef<string | null>(null);
  const deltaFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsPlayerRef = useRef<AudioPlayer | null>(null);
  const ttsPlayerSubRef = useRef<{ remove: () => void } | null>(null);
  const ttsFilesRef = useRef<File[]>([]);
  const mediaShareInFlightRef = useRef(false);
  const sharedMediaCacheRef = useRef<Record<string, { uri: string; mimeType: string; fileName: string }>>({});
  const pendingReferencedUserMessagesRef = useRef<{
    sentAt: number;
    content: string;
    reference: ComposerMediaReference;
  }[]>([]);
  const referencedUserMessageByServerIdRef = useRef<Record<string, ComposerMediaReference>>({});
  const referencedMediaHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceNameByIdRef = useRef<Record<string, string>>({});
  const videoGenerationInFlightRef = useRef(false);
  const videoFromImageInFlightRef = useRef(false);
  const videoAutoSyncInFlightRef = useRef(false);
  const documentPickerInFlightRef = useRef(false);
  const lastVideoGenerationStartAtRef = useRef(0);
  const isSendRunInFlightRef = useRef(false);
  const activeRunRef = useRef<ActiveSendRun | null>(null);
  const runSeqRef = useRef(0);
  const detachedRunsRef = useRef<Map<string, number>>(new Map());
  const stoppedAssistantIdsRef = useRef<Set<string>>(new Set());
  const stoppedTurnsRef = useRef<StoppedTurn[]>([]);
  const cancelledPromptsRef = useRef<Map<string, string[]>>(new Map());
  const lastSendAttemptAtRef = useRef(0);
  const sendAttemptSeqRef = useRef(0);
  const lastHandledNewChatTokenRef = useRef<string | null>(null);
  const initialNewChatTokenRef = useRef<string | null>(null);
  const starterPromptCyclerRef = useRef(createStarterPromptCycler(getStarterPromptPool(language)));

  useEffect(() => {
    starterPromptCyclerRef.current = createStarterPromptCycler(getStarterPromptPool(language));
  }, [language]);
  const screenWidth = Dimensions.get('window').width;
  const backendOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/i, '');
  const GUEST_UPSELL_STATE_KEY = 'cafa_ai_guest_upsell_state_v1';
  const GUEST_UPSELL_AFTER_RESPONSES = 3;
  const GUEST_UPSELL_WINDOW_MS = 24 * 60 * 60 * 1000;
  const GUEST_MESSAGE_COUNT_KEY = 'cafa_ai_guest_message_count_v1';
  const GUEST_MESSAGE_LIMIT = 25;
  const guestModeLocked = !isAuthenticated
    && guestAllowanceHydrated
    && guestMessageCount >= GUEST_MESSAGE_LIMIT;
  const guestAllowanceNoticeIsLocked = guestAllowanceNotice === GUEST_MESSAGE_LIMIT;
  const guestAllowanceNoticeTitle = guestAllowanceNoticeIsLocked
    ? t('chat.guestLimit.lockedTitle')
    : t('chat.guestLimit.warningTitle');
  const guestAllowanceNoticeBody = guestAllowanceNoticeIsLocked
    ? t('chat.guestLimit.lockedBody')
    : t('chat.guestLimit.warningBody', {
        remaining: String(Math.max(0, GUEST_MESSAGE_LIMIT - guestMessageCount)),
      });
  const keyboardComposerOffset = Platform.OS === 'ios' ? iosComposerOffset : androidComposerOffset;
  const safeBottomInset = Math.max(insets.bottom, 0);
  const composerBottomInset = keyboardComposerOffset > 0 ? keyboardComposerOffset : 0;
  const topPillBg = isDark ? '#10264D' : '#204079';
  const topPillBorder = '#204079';
  const dividerPill = '#204079';
  const composerPlaceholder = useMemo(() => screenConfig.placeholder, [screenConfig.placeholder]);
  const useCompactComposerPlaceholder = screenMode === 'image-to-video' || screenMode === 'edit-image';
  const isWelcomeMessage = useCallback((message: UiMessage) => message.id === 'welcome-1', []);
  const hasComposerDraft = Boolean(input.trim()) || attachedAssets.length > 0;
  const canQueueWhileSending = screenMode === 'chat' && isAuthenticated && !isDedicatedMediaScreen;
  const showStopButton = isSending && !hasComposerDraft;
  const isSendDisabled = (!hasComposerDraft && !showStopButton)
    || (isSending && hasComposerDraft && !canQueueWhileSending)
    || (isUnderstandingPrompt && !showStopButton)
    || (!isAuthenticated && (!guestAllowanceHydrated || guestModeLocked));
  const clearDedicatedMediaValidationMessages = useCallback((options: { clearPromptRequired?: boolean; clearImageRequired?: boolean }) => {
    if (!options.clearPromptRequired && !options.clearImageRequired) return;

    setMessages((prev) => {
      const next = prev.filter((message) => {
        if (options.clearPromptRequired && message.id.startsWith('assistant-prompt-required-')) {
          return false;
        }
        if (options.clearImageRequired && message.id.startsWith('assistant-image-required-')) {
          return false;
        }
        return true;
      });

      return next.length === prev.length ? prev : next;
    });
  }, []);
  const isFreshChatState = !isSending && messages.length === 1 && isWelcomeMessage(messages[0]);
  const visibleMessages = useMemo(
    () => (isSending ? messages.filter((message) => !isWelcomeMessage(message)) : messages),
    [isSending, isWelcomeMessage, messages],
  );
  const announceForA11y = useCallback((message: string) => {
    AccessibilityInfo.announceForAccessibility?.(message);
  }, []);

  useEffect(() => {
    if (!isUnderstandingPrompt) return;
    announceForA11y('Understanding your prompt.');
  }, [announceForA11y, isUnderstandingPrompt]);

  const promptSuggestionContext = useMemo<PromptSuggestionContext>(() => {
    if (screenMode === 'edit-image') return 'edit-image';
    if (screenMode === 'image-to-video') return 'video';
    return 'chat';
  }, [screenMode]);

  const clearPromptSuggestions = useCallback((options?: { keepModalOpen?: boolean }) => {
    if (promptSuggestionAbortRef.current) {
      promptSuggestionAbortRef.current.abort();
      promptSuggestionAbortRef.current = null;
    }
    setIsPromptSuggestionsLoading(false);
    setPromptSuggestions([]);
    if (!options?.keepModalOpen) {
      setPromptSuggestionsVisible(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      promptSuggestionAbortRef.current?.abort();
      promptSuggestionAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isDedicatedMediaScreen) return;

    const hasPrompt = input.trim().length > 0;
    const hasImage = attachedAssets.some((asset) => (asset.mimeType ?? '').toLowerCase().startsWith('image/'));

    clearDedicatedMediaValidationMessages({
      clearPromptRequired: hasPrompt,
      clearImageRequired: hasImage,
    });
  }, [attachedAssets, clearDedicatedMediaValidationMessages, input, isDedicatedMediaScreen]);

  const rotateStarterPrompts = useCallback(() => {
    if (screenMode === 'image-to-video') {
      setStarterPrompts([
        'Generate a video from this image with soft cinematic camera movement.',
        'Turn this image into a short product reveal video with subtle motion.',
        'Animate this image into a dramatic scene with slow zoom and drifting light.',
      ]);
      return;
    }
    if (screenMode === 'edit-image') {
      setStarterPrompts([
        'Edit this image by cleaning the background and improving the lighting.',
        'Retouch this image to look sharper, brighter, and more polished.',
        'Transform this image into a premium brand-style visual with better color balance.',
      ]);
      return;
    }
    const selected = starterPromptCyclerRef.current();
    if (selected.length) {
      setStarterPrompts(selected);
    }

    // Real, backend-driven suggestions (2026-09-13) -- ports web's
    // getSuggestedPrompts (a real, cached, potentially personalized row the
    // backend serves, not an LLM call). Only for authenticated users,
    // matching web's own gating; replaces the local static pick above once
    // it resolves, but never blocks on it -- the static pool is what's on
    // screen immediately, same as web's guest/failure fallback.
    if (isAuthenticated) {
      getSuggestedPrompts()
        .then((data) => {
          if (data.suggestions.length) setStarterPrompts(data.suggestions.slice(0, 4));
        })
        .catch(() => {
          // Keep the local static pick; not worth surfacing an error for this.
        });
    }
  }, [isAuthenticated, screenMode]);

  const getScreenHandoffConfigFromAssistantText = useCallback((
    content: string,
  ): ScreenHandoffConfig | null => {
    const normalized = content
      .toLowerCase()
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) return null;

    if (
      normalized.includes('/image-to-video')
      || normalized.includes('image to video screen')
      || normalized.includes('image-to-video screen')
    ) {
      return {
        target: 'image-to-video',
        title: 'Better in Image-to-Video',
        description: 'This request is better handled in the dedicated Image-to-Video screen.',
        ctaLabel: 'Open Image-to-Video',
        iconName: 'film-outline',
      };
    }

    if (
      normalized.includes('/edit-image')
      || normalized.includes('edit image screen')
    ) {
      return {
        target: 'edit-image',
        title: 'Better in Edit Image',
        description: 'This request is better handled in the dedicated Edit Image screen.',
        ctaLabel: 'Open Edit Image',
        iconName: 'color-wand-outline',
      };
    }

    if (normalized.includes('continue in the main chat') || normalized.includes('open main chat')) {
      return {
        target: 'index',
        title: 'Use main chat for this',
        description: 'This request is better handled in the main chat.',
        ctaLabel: 'Open main chat',
        iconName: 'chatbubble-ellipses-outline',
      };
    }

    return null;
  }, []);

  const jumpToReferencedMedia = (reference: ComposerMediaReference) => {
    const index = messages.findIndex((message) => {
      if (message.role !== 'assistant') return false;
      if (reference.kind === 'image') {
        if (reference.id && message.imageId === reference.id) return true;
        return Boolean(message.imageUrl && message.imageUrl === reference.url);
      }
      if (reference.id && message.videoId === reference.id) return true;
      return Boolean(message.videoUrl && message.videoUrl === reference.url);
    });

    if (index < 0) {
      showTransientNotice(t('chat.reference.jumpFailed'));
      return;
    }

    messagesListRef.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0.5,
    });
    const targetMessage = messages[index];
    setHighlightedReferencedMediaTarget({ messageId: targetMessage.id, kind: reference.kind });
    if (referencedMediaHighlightTimerRef.current) {
      clearTimeout(referencedMediaHighlightTimerRef.current);
    }
    referencedMediaHighlightTimerRef.current = setTimeout(() => {
      setHighlightedReferencedMediaTarget((current) => (
        current?.messageId === targetMessage.id && current.kind === reference.kind ? null : current
      ));
    }, 3000);
    hapticSelection();
    showTransientNotice(t('chat.reference.jumpSuccess'));
  };

  const openHandoffTarget = useCallback((target: 'index' | 'image-to-video' | 'edit-image') => {
    if (target === 'index') {
      void router.push('/(drawer)');
      return;
    }
    void router.push(`/${target}`);
  }, []);

  useEffect(() => () => {
    if (referencedMediaHighlightTimerRef.current) {
      clearTimeout(referencedMediaHighlightTimerRef.current);
      referencedMediaHighlightTimerRef.current = null;
    }
  }, []);

  const logSendPayload = useCallback((payload: Record<string, unknown>) => {
    if (!__DEV__) return;
    try {
      console.log('[chat-send:payload]', JSON.stringify(payload));
    } catch {
      console.log('[chat-send:payload]', payload);
    }
  }, []);

  const logUploadSelection = useCallback((payload: Record<string, unknown>) => {
    if (!__DEV__) return;
    try {
      console.log('[chat-upload:selection]', JSON.stringify(payload));
    } catch {
      console.log('[chat-upload:selection]', payload);
    }
  }, []);

  useEffect(() => {
    rotateStarterPrompts();
  }, [rotateStarterPrompts]);

  useEffect(() => {
    // Avoid remounting TextInput on iOS to update placeholder text; remounting can
    // cause focus jitter with keyboard frame callbacks.
    composerInputRef.current?.setNativeProps?.({
      placeholder: useCompactComposerPlaceholder ? '' : composerPlaceholder,
    });
  }, [composerPlaceholder, useCompactComposerPlaceholder]);

  const openInAppBrowser = useCallback(async (url: string) => {
    const target = url.trim();
    if (!/^https?:\/\//i.test(target)) {
      return;
    }
    try {
      const WebBrowser = await getWebBrowserModule();
      await WebBrowser.openBrowserAsync(target);
    } catch {
      const canOpen = await Linking.canOpenURL(target);
      if (canOpen) {
        await Linking.openURL(target);
      }
    }
  }, []);

  const resolveBackendAssetUrl = useCallback((rawUrl?: string | null) => {
    if (!rawUrl) return null;
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl)) return rawUrl;
    if (/^data:/i.test(rawUrl)) return rawUrl;
    if (rawUrl.startsWith('/')) return `${backendOrigin}${rawUrl}`;
    return `${backendOrigin}/${rawUrl}`;
  }, [backendOrigin]);

  const isImageAttachment = useCallback((attachment: UiMessageAttachment) => {
    const mime = (attachment.mimeType ?? '').toLowerCase();
    const type = (attachment.fileType ?? '').toLowerCase();
    const name = (attachment.originalName ?? '').toLowerCase();
    return (
      type === 'image'
      || mime.startsWith('image/')
      || name.endsWith('.png')
      || name.endsWith('.jpg')
      || name.endsWith('.jpeg')
      || name.endsWith('.gif')
      || name.endsWith('.webp')
    );
  }, []);

  const resolveAttachmentPreviewUri = useCallback((attachment: UiMessageAttachment) => {
    if (attachment.thumbnailUrl) {
      return resolveBackendAssetUrl(attachment.thumbnailUrl);
    }
    if (attachment.url) {
      return resolveBackendAssetUrl(attachment.url);
    }
    return null;
  }, [resolveBackendAssetUrl]);

  const isVideoAttachment = useCallback((attachment: UiMessageAttachment) => {
    const mime = (attachment.mimeType ?? '').toLowerCase();
    const type = (attachment.fileType ?? '').toLowerCase();
    const name = (attachment.originalName ?? '').toLowerCase();
    return type === 'video' || mime.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mov');
  }, []);

  const isGeneratedDownloadableFileAttachment = useCallback((attachment: UiMessageAttachment) => (
    Boolean(attachment.url) && !isImageAttachment(attachment) && !isVideoAttachment(attachment)
  ), [isImageAttachment, isVideoAttachment]);

  const inferFileExtensionFromMime = useCallback((mimeType?: string, fileName?: string) => {
    const name = (fileName ?? '').toLowerCase();
    const nameMatch = name.match(/\.([a-z0-9]+)$/i);
    if (nameMatch?.[1]) return nameMatch[1];
    const mime = (mimeType ?? '').toLowerCase();
    if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'docx';
    if (mime.includes('pdf')) return 'pdf';
    if (mime.includes('markdown')) return 'md';
    if (mime.includes('csv')) return 'csv';
    if (mime.includes('json')) return 'json';
    if (mime.includes('plain')) return 'txt';
    return 'bin';
  }, []);

  const isGenericGeneratedFileName = useCallback((fileName?: string) => {
    const value = (fileName ?? '').trim().toLowerCase();
    if (!value) return true;
    return (
      /^generated[-_ ]?(document|file|artifact)/.test(value)
      || /^document[-_ ]?\d/.test(value)
      || /^file[-_ ]?\d/.test(value)
      || /^artifact[-_ ]?\d/.test(value)
      || /^untitled/.test(value)
    );
  }, []);

  const toReadableFileBaseFromPrompt = useCallback((prompt: string) => {
    const normalized = prompt
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return 'generated-file';

    const withoutCommand = normalized
      .replace(/^(generate|create|make|build|draft|write|produce|export)\s+/i, '')
      .replace(/^(a|an|the)\s+/i, '');

    let candidate = withoutCommand;
    const forMatch = /\bfor\s+(.+?)(?:\s+with|\s+including|\s+that|\s+in|\s*$)/i.exec(withoutCommand);
    if (forMatch?.[1]) {
      candidate = `${forMatch[1]} proposal`;
    }

    const words = candidate
      .split(' ')
      .filter((word) => ![
        'docx', 'pdf', 'csv', 'json', 'txt', 'markdown', 'file', 'document', 'artifact', 'sections', 'section',
      ].includes(word))
      .slice(0, 7);

    const base = words.join('-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return base || 'generated-file';
  }, []);

  const suggestDescriptiveFileName = useCallback((options: {
    originalName?: string;
    mimeType?: string;
    fallbackText?: string;
  }) => {
    const extension = inferFileExtensionFromMime(options.mimeType, options.originalName);
    if (!isGenericGeneratedFileName(options.originalName)) {
      return options.originalName?.trim() || `generated-file.${extension}`;
    }
    const base = toReadableFileBaseFromPrompt(options.fallbackText ?? '');
    return `${base}.${extension}`.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
  }, [inferFileExtensionFromMime, isGenericGeneratedFileName, toReadableFileBaseFromPrompt]);

  const assetUrlRequiresAuth = useCallback((uri?: string | null) => {
    if (!uri) return false;
    return /^https?:\/\//i.test(uri) && uri.includes('/uploads/');
  }, []);

  const resolveImageSource = useCallback((uri?: string | null) => {
    if (!uri) return null;
    if (!assetUrlRequiresAuth(uri)) {
      return { uri };
    }
    if (!assetAccessToken) return null;
    return {
      uri,
      headers: {
        Authorization: `Bearer ${assetAccessToken}`,
      },
    };
  }, [assetAccessToken, assetUrlRequiresAuth]);

  const mapAuthMessageToUiMessage = useCallback((rawMessage: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
    tokens?: number;
    attachments?: {
      id?: string;
      fileType?: string;
      mimeType?: string;
      originalName?: string;
      url?: string;
      thumbnailUrl?: string;
    }[];
    imageUrl?: string;
    imagePrompt?: string;
    imageId?: string;
    videoUrl?: string;
    videoPrompt?: string;
    videoId?: string;
    reference?: {
      kind: 'image' | 'video';
      url: string;
      id?: string;
    };
    documentWizard?: {
      html: string;
      documentType: string;
      format: string;
      collapsed?: boolean;
      userMessageId?: string;
      assistantMessageId?: string;
    };
    toolCalls?: {
      name: string;
      args?: Record<string, unknown>;
      ok: boolean;
      products?: { query: string; items: UiMessageProduct[] };
      mediaRef?: { kind?: 'image' | 'video' | 'file'; url?: string; name?: string; fileName?: string; mimeType?: string; thumbnailUrl?: string };
      widget?: import('@/components/chat').UiWidgetSpec;
      label?: string;
    }[];
  }): UiMessage => {
    const message = rawMessage.role === 'user'
      ? { ...rawMessage, content: stripCancellationNote(rawMessage.content) }
      : { ...rawMessage, content: sanitizeModelText(rawMessage.content) };
    const role = message.role === 'assistant' ? 'assistant' : 'user';
    const createdAtMs = new Date(message.createdAt).getTime();
    let referencedMedia: ComposerMediaReference | undefined;

    if (role === 'user') {
      if (message.reference?.kind && message.reference?.url) {
        referencedMedia = {
          kind: message.reference.kind,
          id: message.reference.id,
          url: resolveBackendAssetUrl(message.reference.url) ?? message.reference.url,
        };
        referencedUserMessageByServerIdRef.current[message.id] = referencedMedia;
      } else {
        const saved = referencedUserMessageByServerIdRef.current[message.id];
        if (saved) {
          referencedMedia = saved;
        } else {
          const normalizedContent = message.content.trim();
          let bestIdx = -1;
          let bestDistance = Number.POSITIVE_INFINITY;

          for (let i = 0; i < pendingReferencedUserMessagesRef.current.length; i += 1) {
            const candidate = pendingReferencedUserMessagesRef.current[i];
            if (candidate.content.trim() !== normalizedContent) continue;
            const distance = Math.abs(createdAtMs - candidate.sentAt);
            if (distance < bestDistance && distance <= 2 * 60 * 1000) {
              bestDistance = distance;
              bestIdx = i;
            }
          }

          if (bestIdx >= 0) {
            const matched = pendingReferencedUserMessagesRef.current[bestIdx].reference;
            referencedMedia = matched;
            referencedUserMessageByServerIdRef.current[message.id] = matched;
            pendingReferencedUserMessagesRef.current.splice(bestIdx, 1);
          }
        }
      }
    }

    const normalizedAttachments = (message.attachments ?? []).map((attachment) => ({
      ...attachment,
      url: resolveBackendAssetUrl(attachment.url) ?? attachment.url,
      thumbnailUrl: resolveBackendAssetUrl(attachment.thumbnailUrl) ?? attachment.thumbnailUrl,
    }));

    const normalizedImageUrl = resolveBackendAssetUrl(message.imageUrl) ?? undefined;
    const normalizedVideoUrl = resolveBackendAssetUrl(message.videoUrl) ?? undefined;
    const fallbackImageAttachment = normalizedAttachments.find((attachment) => {
      const fileType = (attachment.fileType ?? '').toLowerCase();
      const mime = (attachment.mimeType ?? '').toLowerCase();
      const name = (attachment.originalName ?? '').toLowerCase();
      return (
        fileType === 'image'
        || mime.startsWith('image/')
        || name.endsWith('.png')
        || name.endsWith('.jpg')
        || name.endsWith('.jpeg')
        || name.endsWith('.webp')
        || name.endsWith('.gif')
      );
    });
    const fallbackVideoAttachment = normalizedAttachments.find((attachment) => {
      const fileType = (attachment.fileType ?? '').toLowerCase();
      const mime = (attachment.mimeType ?? '').toLowerCase();
      const name = (attachment.originalName ?? '').toLowerCase();
      return (
        fileType === 'video'
        || mime.startsWith('video/')
        || name.endsWith('.mp4')
        || name.endsWith('.mov')
        || name.endsWith('.webm')
      );
    });

    // Real, confirmed root-cause fix (2026-09-14, Issue A): imageUrl/videoUrl
    // were only ever derived from the legacy message.imageUrl/videoUrl fields
    // (or an uploaded-attachment fallback) -- fields the current native
    // tool-calling backend never writes; it only persists toolCalls[].mediaRef
    // (which backfilledArtifacts, a few lines below, already correctly reads
    // for the Artifacts panel). Whenever the live SSE 'media' event was
    // missed (real, confirmed on real hardware with a longer/more complex
    // prompt -- reproduced live: the exact same reconciliation path that's
    // supposed to backfill this had nothing to backfill FROM), this made it
    // structurally impossible for the chat bubble to ever recover the image,
    // even though it was always genuinely available in the same toolCalls
    // array the Artifacts panel was already rendering it from.
    const toolCallImageUrl = [...(message.toolCalls ?? [])].reverse().find(
      (call) => call.mediaRef?.kind === 'image' && call.mediaRef.url,
    )?.mediaRef?.url;
    const toolCallVideoUrl = [...(message.toolCalls ?? [])].reverse().find(
      (call) => call.mediaRef?.kind === 'video' && call.mediaRef.url,
    )?.mediaRef?.url;

    const effectiveImageUrl = normalizedImageUrl
      ?? fallbackImageAttachment?.url
      ?? fallbackImageAttachment?.thumbnailUrl
      ?? (toolCallImageUrl ? resolveBackendAssetUrl(toolCallImageUrl) ?? toolCallImageUrl : undefined);
    const effectiveVideoUrl = normalizedVideoUrl
      ?? fallbackVideoAttachment?.url
      ?? fallbackVideoAttachment?.thumbnailUrl
      ?? (toolCallVideoUrl ? resolveBackendAssetUrl(toolCallVideoUrl) ?? toolCallVideoUrl : undefined);

    // Real fix (2026-09-12): matches web's backfillToolStateFromToolCalls
    // (chat-shell/utils.ts) -- the live-streamed `tools`/`products` fields
    // are never persisted themselves, only the real toolCalls record that
    // produced them is. Without reconstructing from it here, a message
    // loaded from any conversation-detail refresh (the same background
    // reconciliation that runs after every send) silently lost its product
    // cards and tool chips seconds after they first appeared -- confirmed
    // live: search_products cards vanished right after the turn settled.
    // Real, confirmed bug fix (2026-09-19): this used to omit `label`
    // entirely, so ToolStatusChips' `label ?? tool` fallback showed the raw
    // tool name (e.g. "run_python_chart") for every backfilled message, not
    // just newly-added tools -- the live stream always had a label, this
    // backfill path never did. Now reads the same friendly label the
    // backend persisted (see Conversation.model.ts's IToolCall.label).
    const backfilledTools: UiMessageToolCall[] | undefined = message.toolCalls?.length
      ? message.toolCalls.map((call) => ({ tool: call.name, label: call.label, ok: call.ok, running: false }))
      : undefined;
    const backfilledProducts = [...(message.toolCalls ?? [])].reverse().find((call) => call.products)?.products;
    // Real, matches web's backfillToolStateFromToolCalls widget handling --
    // widgetDone is always seeded false here (a completed render_widget tool
    // call is not the same as the user having submitted it); the real
    // submission-lock recompute runs in applyWidgetSubmissionState below,
    // over the full ordered message list.
    const backfilledWidget = [...(message.toolCalls ?? [])].reverse().find((call) => call.widget)?.widget;
    // Real fix (2026-09-12, Part 4): ports web's deriveArtifactsFromMessages
    // (chat-shell/utils.ts) -- the artifacts gallery is built from this same
    // real, persisted toolCalls array, not from imageUrl/videoUrl alone, so
    // an edited image's real pre-edit sourceUrl (edit_image's own image_url
    // arg) survives a reload for the before/after comparison.
    const backfilledArtifacts: UiArtifactItem[] = (message.toolCalls ?? []).reduce<UiArtifactItem[]>(
      (acc, call, toolCallIndex) => {
        const rawUrl = call.mediaRef?.url;
        if (!rawUrl) return acc;
        const kind: UiArtifactItem['kind'] =
          call.name === 'generate_video' || call.name === 'image_to_video'
            ? 'video'
            : call.name === 'generate_document' || call.mediaRef?.kind === 'file'
              ? 'document'
              : 'image';
        const rawSourceUrl = call.name === 'edit_image' ? String(call.args?.image_url ?? '').trim() : '';
        acc.push({
          id: `${message.id}-artifact-${call.name}-${acc.length}`,
          kind,
          url: resolveBackendAssetUrl(rawUrl) ?? rawUrl,
          name: call.mediaRef?.name ?? call.mediaRef?.fileName,
          mimeType: call.mediaRef?.mimeType,
          thumbnailUrl: resolveBackendAssetUrl(call.mediaRef?.thumbnailUrl) ?? undefined,
          sourceUrl: rawSourceUrl ? resolveBackendAssetUrl(rawSourceUrl) ?? rawSourceUrl : undefined,
          messageId: message.id,
          toolCallIndex,
          createdAt: createdAtMs,
          titleHint: call.name === 'generate_document' ? documentTitleFromArgs(call.args) : undefined,
          formatHint: call.name === 'generate_document' ? documentFormatFromArgs(call.args) : undefined,
        });
        return acc;
      },
      [],
    );

    return {
      id: message.id,
      role,
      content: getScreenHandoffConfigFromAssistantText(message.content) ? '' : message.content,
      createdAt: createdAtMs,
      referencedMedia,
      tokens: message.tokens,
      attachments: normalizedAttachments,
      imageUrl: effectiveImageUrl,
      imagePrompt: message.imagePrompt,
      imageId: message.imageId,
      videoUrl: effectiveVideoUrl,
      videoPrompt: message.videoPrompt,
      videoId: message.videoId,
      screenHandoff: role === 'assistant' ? getScreenHandoffConfigFromAssistantText(message.content) ?? undefined : undefined,
      documentWizard: message.documentWizard
        ? {
            html: message.documentWizard.html,
            documentType: message.documentWizard.documentType,
            format: message.documentWizard.format,
            collapsed: message.documentWizard.collapsed,
            userMessageId: message.documentWizard.userMessageId,
            assistantMessageId: message.documentWizard.assistantMessageId,
          }
        : undefined,
      tools: backfilledTools,
      products: backfilledProducts,
      artifacts: backfilledArtifacts.length ? backfilledArtifacts : undefined,
      widget: backfilledWidget,
      widgetDone: backfilledWidget ? false : undefined,
    };
  }, [getScreenHandoffConfigFromAssistantText, resolveBackendAssetUrl]);

  // Real, matches web's applyWidgetSubmissionState (chat-shell/utils.ts) --
  // a widget is only "done" once the message immediately following it is
  // the real "[Form response] ..." user message handleWidgetSubmit sends,
  // not merely because the render_widget tool call itself completed. Must
  // run over the full ordered array (not per-message), since it looks ahead.
  const applyWidgetSubmissionState = useCallback((list: UiMessage[]): UiMessage[] =>
    list.map((message, index) => {
      if (!message.widget) return message;
      const nextUserMessage = list.slice(index + 1).find((candidate) => candidate.role === 'user');
      const widgetDone = Boolean(nextUserMessage?.content.startsWith('[Form response]'));
      return widgetDone === message.widgetDone ? message : { ...message, widgetDone };
    }), []);

  const mapDedicatedMediaConversationToAuthDetail = useCallback((conversation: {
    id: string;
    title: string;
    screen: DedicatedMediaScreen;
    model: string;
    updatedAt: string;
    messages: {
      _id: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      createdAt: string;
      tokens?: number;
      reactions?: { liked?: boolean; disliked?: boolean };
      attachments?: {
        _id?: string;
        id?: string;
        type?: string;
        fileType?: string;
        mimeType?: string;
        fileName?: string;
        originalName?: string;
        url?: string;
        thumbnailUrl?: string;
      }[];
      reference?: {
        kind?: 'image' | 'video';
        url?: string;
        id?: string;
      } | null;
    }[];
  }) => {
    return {
      id: conversation.id,
      title: conversation.title,
      model: conversation.model,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.map((message) => ({
        id: message._id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        tokens: message.tokens,
        reactions: {
          liked: Boolean(message.reactions?.liked),
          disliked: Boolean(message.reactions?.disliked),
        },
        attachments: (message.attachments ?? []).map((attachment) => ({
          id: attachment._id ?? attachment.id,
          fileType: attachment.fileType ?? attachment.type,
          mimeType: attachment.mimeType,
          originalName: attachment.originalName ?? attachment.fileName,
          url: attachment.url,
          thumbnailUrl: attachment.thumbnailUrl,
        })),
        reference: message.reference?.kind && message.reference?.url
          ? {
              kind: message.reference.kind,
              url: message.reference.url,
              id: message.reference.id,
            }
          : undefined,
      })),
    };
  }, []);

  const applyDescriptiveAttachmentNames = useCallback((uiMessages: UiMessage[]) => {
    return uiMessages.map((message, index) => {
      if (!message.attachments?.length) return message;
      if (message.role !== 'assistant') return message;

      const previousUser = [...uiMessages.slice(0, index)]
        .reverse()
        .find((candidate) => candidate.role === 'user' && candidate.content.trim().length > 0);
      const fallbackText = message.content.trim() || previousUser?.content?.trim() || '';

      const nextAttachments = message.attachments.map((attachment) => ({
        ...attachment,
        originalName: suggestDescriptiveFileName({
          originalName: attachment.originalName,
          mimeType: attachment.mimeType,
          fallbackText,
        }),
      }));

      return { ...message, attachments: nextAttachments };
    });
  }, [suggestDescriptiveFileName]);

  const handleDocumentWizardComplete = useCallback((messageId: string, documentType: string, artifacts: DocumentWizardArtifact[]) => {
    const normalizedAttachments: UiMessageAttachment[] = artifacts.map((artifact, index) => {
      const resolvedUrl = resolveBackendAssetUrl(artifact.url) ?? artifact.url;
      return {
        id: `${artifact.fileName}-${index}-${resolvedUrl}`,
        fileType: artifact.mimeType?.startsWith('image/')
          ? 'image'
          : artifact.mimeType?.startsWith('video/')
            ? 'video'
            : 'document',
        mimeType: artifact.mimeType,
        originalName: artifact.fileName,
        url: resolvedUrl,
        thumbnailUrl: artifact.mimeType?.startsWith('image/') ? resolvedUrl : undefined,
      };
    });

    setMessages((prev) => prev.map((message) => {
      if (message.id !== messageId) return message;
      return {
        ...message,
        content: documentType
          ? `Your ${documentType} is ready. Download it below.`
          : 'Your document is ready. Download it below.',
        attachments: normalizedAttachments,
        documentWizard: undefined,
      };
    }));
    autoScrollEnabledRef.current = true;
    setShowScrollToBottom(false);
    scrollToBottom();
    hapticSuccess();
  }, [resolveBackendAssetUrl]);

  const collapseAllDocumentWizards = useCallback(() => {
    setMessages((prev) => prev.map((message) => (
      message.documentWizard
        ? {
            ...message,
            documentWizard: {
              ...message.documentWizard,
              collapsed: true,
            },
          }
        : message
    )));
  }, []);

  const expandDocumentWizard = useCallback((messageId: string) => {
    autoScrollEnabledRef.current = false;
    showScrollButtonRef.current = false;
    setShowScrollToBottom(false);
    setDocumentWizardFocusTargetId(messageId);
    setMessages((prev) => prev.map((message) => {
      if (!message.documentWizard) return message;
      return {
        ...message,
        documentWizard: {
          ...message.documentWizard,
          collapsed: message.id === messageId ? false : true,
        },
      };
    }));
  }, []);

  useEffect(() => {
    if (!documentWizardFocusTargetId) return;
    const wizardIndex = visibleMessages.findIndex((message) => message.id === documentWizardFocusTargetId);
    if (wizardIndex < 0) {
      setDocumentWizardFocusTargetId(null);
      return;
    }

    let secondScrollTimer: ReturnType<typeof setTimeout> | null = null;
    const firstScrollTimer = setTimeout(() => {
      messagesListRef.current?.scrollToIndex({ index: wizardIndex, animated: true, viewPosition: 0.04 });
      secondScrollTimer = setTimeout(() => {
        messagesListRef.current?.scrollToIndex({ index: wizardIndex, animated: false, viewPosition: 0.04 });
        AccessibilityInfo.announceForAccessibility?.('Document form opened. Continue filling the form.');
        setDocumentWizardFocusTargetId(null);
      }, 320);
    }, 180);

    return () => {
      clearTimeout(firstScrollTimer);
      if (secondScrollTimer) clearTimeout(secondScrollTimer);
    };
  }, [documentWizardFocusTargetId, visibleMessages]);

  const hasExpandedDocumentWizard = useCallback(
    () => messages.some((message) => message.documentWizard && !message.documentWizard.collapsed),
    [messages],
  );

  const collectDocumentWizardDraftMessages = useCallback((source: UiMessage[]) => {
    const draftIds = new Set<string>();
    source.forEach((message, index) => {
      if (!message.documentWizard) return;
      draftIds.add(message.id);
      const previous = source[index - 1];
      if (previous?.role === 'user') {
        draftIds.add(previous.id);
      }
    });
    return source.filter((message) => draftIds.has(message.id));
  }, []);

  const getDocumentWizardDraftKey = useCallback((conversationId?: string | null) => (
    conversationId?.trim() ? `conversation:${conversationId.trim()}` : 'standalone'
  ), []);

  const cancelAllDocumentWizards = useCallback(() => {
    const targetConversationId = typeof params.conversationId === 'string'
      ? params.conversationId
      : (authConversationId ?? guestConversationId);
    const draftKey = getDocumentWizardDraftKey(targetConversationId);
    setMessages((prev) => {
      const discardedMessages = collectDocumentWizardDraftMessages(prev);
      const draftIds = new Set(discardedMessages.map((message) => message.id));
      void discardDocumentWizardDraftMessages(draftKey, [...draftIds]);
      return prev.filter((message) => !draftIds.has(message.id));
    });
    setDocumentFormWarningVisible(false);
  }, [
    authConversationId,
    collectDocumentWizardDraftMessages,
    getDocumentWizardDraftKey,
    guestConversationId,
    params.conversationId,
  ]);

  const continueDocumentWizard = useCallback(() => {
    setDocumentFormWarningVisible(false);
    const wizard = [...messages].reverse().find((message) => message.documentWizard);
    if (wizard) expandDocumentWizard(wizard.id);
  }, [expandDocumentWizard, messages]);

  const updateDocumentWizardFormData = useCallback((messageId: string, formData: Record<string, string>) => {
    const targetConversationId = typeof params.conversationId === 'string'
      ? params.conversationId
      : (authConversationId ?? guestConversationId);
    const draftKey = getDocumentWizardDraftKey(targetConversationId);
    setMessages((prev) => {
      let changed = false;
      const next = prev.map((message) => {
        if (message.id !== messageId || !message.documentWizard) return message;
        changed = true;
        return {
          ...message,
          documentWizard: { ...message.documentWizard, formData },
        };
      });
      if (changed) {
        void setDocumentWizardDraftMessages(draftKey, collectDocumentWizardDraftMessages(next));
      }
      return changed ? next : prev;
    });
  }, [
    authConversationId,
    collectDocumentWizardDraftMessages,
    getDocumentWizardDraftKey,
    guestConversationId,
    params.conversationId,
  ]);

  const mergeDocumentWizardDraftMessages = useCallback((baseMessages: UiMessage[], draftMessages: UiMessage[]) => {
    if (draftMessages.length === 0) return baseMessages;
    if (baseMessages.some((message) => message.documentWizard)) return baseMessages;

    const existingIds = new Set(baseMessages.map((message) => message.id));
    const createFingerprint = (message: UiMessage) => (
      [
        message.role,
        message.content.trim(),
        Math.round(message.createdAt / 1000),
        message.documentWizard?.documentType ?? '',
        message.documentWizard?.format ?? '',
      ].join('|')
    );
    const existingFingerprints = new Set(baseMessages.map(createFingerprint));
    const additions = draftMessages.filter((message) => (
      !existingIds.has(message.id) && !existingFingerprints.has(createFingerprint(message))
    ));

    if (additions.length === 0) return baseMessages;
    return [...baseMessages, ...additions].sort((left, right) => left.createdAt - right.createdAt);
  }, []);

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      messagesListRef.current?.scrollToEnd({ animated });
    });
  };

  const waitForVideoGeneration = useCallback(async (jobId: string) => {
    let lastKnownStatus: string | undefined;
    let lastKnownMessage: string | undefined;
    let lastKnownCode: string | undefined;
    for (let attempt = 0; attempt < VIDEO_JOB_POLL_ATTEMPTS; attempt += 1) {
      try {
        const status = await pollVideoJob(jobId);
        lastKnownStatus = status.status;
        lastKnownMessage = status.error || status.message || lastKnownMessage;
        lastKnownCode = (status as unknown as { code?: string; errorCode?: string })?.code
          || (status as unknown as { code?: string; errorCode?: string })?.errorCode
          || lastKnownCode;
        if (status.status === 'completed') {
          const resolvedVideoUrl = resolveBackendAssetUrl(status.result?.videoUrl ?? status.videoUrl);
          if (!resolvedVideoUrl) {
            const noUrlError = new Error('Video generation completed, but no video URL was returned.') as Error & { code?: string; status?: number };
            noUrlError.code = 'VIDEO_GENERATION_MISSING_URL';
            noUrlError.status = 200;
            throw noUrlError;
          }
          return {
            videoId: status.result?.id,
            videoPrompt: status.result?.prompt,
            videoUrl: resolvedVideoUrl,
          };
        }
        if (status.status === 'failed') {
          const failedError = new Error(status.error || status.message || 'Video generation failed.') as Error & {
            code?: string;
            status?: number;
          };
          failedError.code = lastKnownCode || 'VIDEO_GENERATION_FAILED';
          failedError.status = 200;
          throw failedError;
        }
        await new Promise((resolve) => setTimeout(resolve, VIDEO_JOB_POLL_INTERVAL_MS));
      } catch (error) {
        const typed = error as { status?: number; code?: string; message?: string } | undefined;
        const code = (typed?.code ?? '').toUpperCase();
        const message = (typed?.message ?? (error instanceof Error ? error.message : '')).toLowerCase();
        const isRateLimitedOrTransient =
          typed?.status === 429
          || typed?.status === 422
          || code.includes('RATE_LIMIT')
          || code.includes('UNPROCESSABLE')
          || message.includes('too many video generation requests')
          || message.includes('too many requests')
          || message.includes('still processing')
          || message.includes('not ready');
        if (!isRateLimitedOrTransient) throw error;
        await new Promise((resolve) => setTimeout(resolve, VIDEO_JOB_RATE_LIMIT_BACKOFF_MS));
      }
    }

    const timeoutError = new Error(
      lastKnownStatus === 'failed'
        ? (lastKnownMessage || 'Video generation failed.')
        : 'Video generation timed out. Please try again.',
    ) as Error & { code?: string; status?: number };
    timeoutError.code = lastKnownStatus === 'failed'
      ? (lastKnownCode || 'VIDEO_GENERATION_FAILED')
      : 'VIDEO_GENERATION_TIMEOUT';
    timeoutError.status = 200;
    throw timeoutError;
  }, [resolveBackendAssetUrl]);

  const artifactHydrationInFlightRef = useRef<Set<string>>(new Set());
  const hydrateAssistantAttachmentsFromArtifacts = useCallback(async (conversationId: string) => {
    if (!conversationId || artifactHydrationInFlightRef.current.has(conversationId)) return;
    artifactHydrationInFlightRef.current.add(conversationId);

    try {
      const collected: Awaited<ReturnType<typeof getArtifactsPage>>['artifacts'] = [];
      let page = 1;
      let pages = 1;
      do {
        const payload = await getArtifactsPage({ page, limit: 100 });
        collected.push(...payload.artifacts);
        pages = payload.pagination.pages;
        page += 1;
      } while (page <= pages && page <= 10);

      const byMessageId = new Map<string, UiMessageAttachment[]>();
      for (const artifact of collected) {
        if (artifact.conversationId !== conversationId) continue;
        if (!artifact.messageId) continue;
        const artifactUrl = artifact.url ?? artifact.downloadUrl;
        if (!artifactUrl) continue;

        const mimeType = artifact.mimeType;
        const normalizedUrl = resolveBackendAssetUrl(artifactUrl) ?? artifactUrl;
        const fileType = (mimeType ?? '').startsWith('image/')
          ? 'image'
          : (mimeType ?? '').startsWith('video/')
            ? 'video'
            : (artifact.kind || 'file');
        const attachment: UiMessageAttachment = {
          id: artifact.artifactId || artifact.url,
          fileType,
          mimeType,
          originalName: artifact.fileName,
          url: normalizedUrl,
          thumbnailUrl: (mimeType ?? '').startsWith('image/') ? normalizedUrl : undefined,
        };
        const existing = byMessageId.get(artifact.messageId) ?? [];
        existing.push(attachment);
        byMessageId.set(artifact.messageId, existing);
      }

      if (!byMessageId.size) return;

      setMessages((prev) => {
        let changed = false;
        const next = prev.map((message) => {
          if (message.role !== 'assistant') return message;
          if (message.stopped) return message;
          if ((message.attachments?.length ?? 0) > 0) return message;
          const attachments = byMessageId.get(message.id);
          if (!attachments?.length) return message;
          changed = true;
          return {
            ...message,
            attachments,
          };
        });
        return changed ? applyDescriptiveAttachmentNames(next) : prev;
      });
    } catch {
      // Best-effort hydration from artifacts endpoint.
    } finally {
      artifactHydrationInFlightRef.current.delete(conversationId);
    }
  }, [applyDescriptiveAttachmentNames, resolveBackendAssetUrl]);

  const applyAuthConversationDetail = useCallback((detail: Awaited<ReturnType<typeof getAuthenticatedConversation>>) => {
    const routedConversationId = routedConversationIdRef.current;
    if (routedConversationId && detail.id !== routedConversationId) return;
    const mapped = detail.messages.map(mapAuthMessageToUiMessage);
    setMessages((prev) => {
      const previousById = new Map(prev.map((message) => [message.id, message] as const));
      const mergedRaw = mapped.map((message) => {
        if (message.role !== 'assistant') return message;
        const prior = previousById.get(message.id);
        if (!prior) {
          if (message.content.trim().length > 0) return message;
          const latestLocalAssistantWithText = [...prev]
            .reverse()
            .find((item) => item.role === 'assistant' && item.content.trim().length > 0);
          if (!latestLocalAssistantWithText) return message;
          return {
            ...message,
            content: latestLocalAssistantWithText.content,
            attachments: (message.attachments?.length ?? 0) > 0 ? message.attachments : latestLocalAssistantWithText.attachments,
            imageUrl: message.imageUrl ?? latestLocalAssistantWithText.imageUrl,
            imagePrompt: message.imagePrompt ?? latestLocalAssistantWithText.imagePrompt,
            imageId: message.imageId ?? latestLocalAssistantWithText.imageId,
            videoUrl: message.videoUrl ?? latestLocalAssistantWithText.videoUrl,
            videoPrompt: message.videoPrompt ?? latestLocalAssistantWithText.videoPrompt,
            videoId: message.videoId ?? latestLocalAssistantWithText.videoId,
          };
        }

        const serverContent = message.content.trim();
        const priorContent = prior.content.trim();
        const mergedContent = serverContent.length > 0 ? message.content : (priorContent.length > 0 ? prior.content : message.content);
        const shouldPreservePriorMedia =
          (message.attachments?.length ?? 0) === 0
          && (prior.attachments?.length ?? 0) > 0;

        return {
          ...message,
          content: mergedContent,
          attachments: shouldPreservePriorMedia ? prior.attachments : message.attachments,
          imageUrl: message.imageUrl ?? prior.imageUrl,
          imagePrompt: message.imagePrompt ?? prior.imagePrompt,
          imageId: message.imageId ?? prior.imageId,
          videoUrl: message.videoUrl ?? prior.videoUrl,
          videoPrompt: message.videoPrompt ?? prior.videoPrompt,
          videoId: message.videoId ?? prior.videoId,
        };
      });
      const merged = applyStoppedTurns(
        mergedRaw,
        detail.id,
        stoppedAssistantIdsRef.current,
        stoppedTurnsRef.current,
        new Map(prev.map((message) => [message.id, message.content] as const)),
      );
      const mappedIds = new Set(merged.map((message) => message.id));
      const endsWithUser = merged.length > 0 && merged[merged.length - 1]?.role === 'user';
      const lastMappedUserCreatedAt = [...merged]
        .reverse()
        .find((message) => message.role === 'user')?.createdAt ?? 0;
      const localAssistantFallback = endsWithUser
        ? [...prev]
          .reverse()
          .find((message) => (
            message.role === 'assistant'
            && !mappedIds.has(message.id)
            && (message.content.trim().length > 0 || message.isImageGenerating || message.isVideoGenerating || message.isArtifactGenerating)
            && message.createdAt >= lastMappedUserCreatedAt
          ))
        : null;

      const next = localAssistantFallback ? [...merged, localAssistantFallback] : merged;
      const preservedDrafts = collectDocumentWizardDraftMessages(prev);
      return applyWidgetSubmissionState(
        applyDescriptiveAttachmentNames(mergeDocumentWizardDraftMessages(next, preservedDrafts)),
      );
    });
    setMessageReactions(() =>
      detail.messages.reduce<Record<string, 'like' | 'dislike' | undefined>>((acc, message) => {
        if (message.role !== 'assistant') return acc;
        acc[message.id] = message.reactions?.liked
          ? 'like'
          : message.reactions?.disliked
            ? 'dislike'
            : undefined;
        return acc;
      }, {}),
    );
    void hydrateAssistantAttachmentsFromArtifacts(detail.id);
  }, [
    applyDescriptiveAttachmentNames,
    applyWidgetSubmissionState,
    collectDocumentWizardDraftMessages,
    hydrateAssistantAttachmentsFromArtifacts,
    mapAuthMessageToUiMessage,
    mergeDocumentWizardDraftMessages,
  ]);

  const applyDedicatedMediaConversation = useCallback((conversationPage: Awaited<ReturnType<typeof getDedicatedMediaConversation>>) => {
    setAuthConversationId(conversationPage.conversation.id);
    applyAuthConversationDetail(mapDedicatedMediaConversationToAuthDetail(conversationPage.conversation));
  }, [applyAuthConversationDetail, mapDedicatedMediaConversationToAuthDetail]);

  const syncAssistantMessageAfterStream = useCallback(async (
    conversationId: string,
    assistantMessageId: string,
    localFallbackId: string,
    fallbackAttachments: UiMessageAttachment[] = [],
  ) => {
    // Real fix (2026-09-14, Issue 5): cafa-ai-web's own chat stream never
    // reconciles from the server after a live 'media' SSE event -- it
    // patches imageUrl/videoUrl into local state the instant the event
    // arrives and trusts it completely, no refetch, no merge. This
    // reconciliation loop exists only as a fallback for when the live
    // stream never delivered the media event at all; if it already did,
    // running up to 6 extra network round-trips here is both unnecessary
    // load and a needless second chance for a stale poll to interfere.
    let hasVisualAlready = false;
    setMessages((prev) => {
      const current = prev.find((item) => item.id === assistantMessageId || item.id === localFallbackId);
      hasVisualAlready = Boolean(
        current?.imageUrl || current?.videoUrl || (current?.artifacts?.length ?? 0) > 0,
      );
      return prev;
    });
    if (hasVisualAlready) return;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const detail = await getAuthenticatedConversation(conversationId, { force: true });
        const serverMessage = detail.messages.find(
          (message) => message.id === assistantMessageId && message.role === 'assistant',
        );

        if (serverMessage) {
          const mapped = mapAuthMessageToUiMessage(serverMessage);
          const mergedMapped = (mapped.attachments?.length ?? 0) > 0
            ? mapped
            : { ...mapped, attachments: fallbackAttachments };
          setMessages((prev) => {
            const previousUser = [...prev]
              .reverse()
              .find((candidate) => candidate.role === 'user' && candidate.content.trim().length > 0);
            const fallbackText = mergedMapped.content.trim() || previousUser?.content?.trim() || '';
            const enhancedMapped = mergedMapped.attachments?.length
              ? {
                  ...mergedMapped,
                  attachments: mergedMapped.attachments.map((attachment) => ({
                    ...attachment,
                    originalName: suggestDescriptiveFileName({
                      originalName: attachment.originalName,
                      mimeType: attachment.mimeType,
                      fallbackText,
                    }),
                  })),
                }
              : mapped;
            // Real fix (2026-09-14, Issue 5): the persisted-server snapshot
            // this poll fetches can genuinely lag the live SSE stream's own
            // already-rendered media state -- the toolCalls/mediaRef write
            // is async on the backend, so an early poll attempt can land
            // before it's committed. Blindly replacing the message with
            // that stale snapshot wiped out an image/video the live stream
            // had already shown (confirmed live: it visibly appeared, then
            // disappeared). Keep whichever side actually has the richer
            // visual state instead of always trusting the poll result.
            const byServerId = prev.findIndex((item) => item.id === assistantMessageId);
            if (byServerId >= 0) {
              const next = [...prev];
              const existing = next[byServerId];
              next[byServerId] = {
                ...enhancedMapped,
                imageUrl: enhancedMapped.imageUrl ?? existing.imageUrl,
                videoUrl: enhancedMapped.videoUrl ?? existing.videoUrl,
                artifacts: (enhancedMapped.artifacts?.length ?? 0) > 0 ? enhancedMapped.artifacts : existing.artifacts,
              };
              return next;
            }

            const byFallbackId = prev.findIndex((item) => item.id === localFallbackId);
            if (byFallbackId >= 0) {
              const next = [...prev];
              const existing = next[byFallbackId];
              next[byFallbackId] = {
                ...enhancedMapped,
                imageUrl: enhancedMapped.imageUrl ?? existing.imageUrl,
                videoUrl: enhancedMapped.videoUrl ?? existing.videoUrl,
                artifacts: (enhancedMapped.artifacts?.length ?? 0) > 0 ? enhancedMapped.artifacts : existing.artifacts,
              };
              return next;
            }

            return prev;
          });

          const hasVisualOrFileState = Boolean(
            mergedMapped.imageUrl
            || mergedMapped.videoUrl
            || (mergedMapped.attachments?.length ?? 0) > 0,
          );
          if (hasVisualOrFileState) return;
        }
      } catch {
        // Best-effort sync; keep the streamed state if server sync fails.
      }

      await new Promise((resolve) => setTimeout(resolve, 220));
    }
  }, [mapAuthMessageToUiMessage, suggestDescriptiveFileName]);

  const reconcileAuthConversationAfterSend = useCallback(async (conversationId: string) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const detail = await getAuthenticatedConversation(conversationId, { force: true });
        if (detail.messages.length > 0) {
          applyAuthConversationDetail(detail);
          return;
        }
      } catch {
        // retry until attempts exhausted
      }
      await new Promise((resolve) => setTimeout(resolve, 240));
    }
  }, [applyAuthConversationDetail]);

  const hydrateDedicatedMediaConversation = useCallback(async (
    screen: DedicatedMediaScreen,
    options?: { attempts?: number; delayMs?: number; preserveOnUnavailable?: boolean },
  ) => {
    const attempts = options?.attempts ?? 1;
    const delayMs = options?.delayMs ?? 300;
    const preserveOnUnavailable = options?.preserveOnUnavailable ?? false;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const conversationPage = await getDedicatedMediaConversation(screen, { limit: 20 });
        applyDedicatedMediaConversation(conversationPage);
        return true;
      } catch (error) {
        if (isDedicatedMediaConversationUnavailable(error)) {
          if (!preserveOnUnavailable) {
            setAuthConversationId(null);
            setMessages([createWelcomeMessage()]);
            setMessageReactions({});
          }
          return false;
        }
        if (attempt === attempts - 1) {
          throw error;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return false;
  }, [applyDedicatedMediaConversation, createWelcomeMessage]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAssetAccessToken(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const token = await getAccessToken();
      if (!cancelled) {
        setAssetAccessToken(token ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const targetConversationId = typeof params.conversationId === 'string' ? params.conversationId : '';
    const targetMessageId = typeof params.messageId === 'string' ? params.messageId : '';
    if (!targetConversationId || !targetMessageId) return;

    const inActiveConversation =
      (isAuthenticated && authConversationId === targetConversationId)
      || (!isAuthenticated && guestConversationId === targetConversationId);
    if (!inActiveConversation) return;

    const messageIndex = messages.findIndex((message) => message.id === targetMessageId);
    if (messageIndex < 0) return;

    const jumpKey = `${targetConversationId}:${targetMessageId}`;
    if (lastJumpedMessageKeyRef.current === jumpKey) return;
    lastJumpedMessageKeyRef.current = jumpKey;

    requestAnimationFrame(() => {
      try {
        messagesListRef.current?.scrollToIndex({ index: messageIndex, animated: true, viewPosition: 0.45 });
      } catch {
        messagesListRef.current?.scrollToOffset({ offset: Math.max(0, messageIndex * 120), animated: true });
      }
      setHighlightedMessageId(targetMessageId);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMessageId((current) => (current === targetMessageId ? null : current));
        highlightTimeoutRef.current = null;
      }, 2200);
      router.setParams({ messageId: undefined });
    });
  }, [authConversationId, guestConversationId, isAuthenticated, messages, params.conversationId, params.messageId]);

  const scheduleVideoAutoSync = useCallback((conversationId: string, expectedPrompt: string, startedAt: number) => {
    if (videoAutoSyncInFlightRef.current) return;
    videoAutoSyncInFlightRef.current = true;
    const normalizedPrompt = expectedPrompt.trim().toLowerCase();

    const run = async () => {
      for (let attempt = 0; attempt < VIDEO_AUTO_SYNC_ATTEMPTS; attempt += 1) {
        try {
          const detail = await getAuthenticatedConversation(conversationId, { force: true });
          applyAuthConversationDetail(detail);
          const hasResolvedVideo = detail.messages.some((message) => {
            if (message.role !== 'assistant' || !message.videoUrl) return false;
            const createdAt = new Date(message.createdAt).getTime();
            const candidate = (message.videoPrompt ?? message.content ?? '').trim().toLowerCase();
            if (candidate && candidate === normalizedPrompt) return true;
            return createdAt >= startedAt - 15000;
          });
          if (hasResolvedVideo) {
            videoAutoSyncInFlightRef.current = false;
            return;
          }
        } catch {
          // Keep trying; background sync is best-effort.
        }
        await new Promise((resolve) => setTimeout(resolve, VIDEO_AUTO_SYNC_INTERVAL_MS));
      }
      videoAutoSyncInFlightRef.current = false;
    };

    void run();
  }, [applyAuthConversationDetail]);

  const isLimitOrUpgradeError = (error: unknown) => {
    const typed = error as { code?: string; status?: number; message?: string } | undefined;
    const code = (typed?.code ?? '').toUpperCase();
    const message = (typed?.message ?? (error instanceof Error ? error.message : '')).toLowerCase();
    const isModelUnavailableUpgrade = code === 'UPGRADE_REQUIRED' && message.includes('not available on your current plan');
    const isUsageLimitMessage =
      message.includes('monthly limit')
      || message.includes('daily limit')
      || message.includes('usage limit')
      || message.includes('quota')
      || message.includes('upgrade your plan')
      || message.includes('upgrade required');
    if (isModelUnavailableUpgrade) return false;
    if (
      code.endsWith('_LIMIT_EXCEEDED')
      || code === 'LIMIT_EXCEEDED'
      || code === 'DAILY_LIMIT_EXCEEDED'
      || code === 'GUEST_DAILY_LIMIT_EXCEEDED'
      || code === 'UPGRADE_REQUIRED'
      || isUsageLimitMessage
    ) {
      return true;
    }
    if (typed?.status === 429 || code.includes('RATE_LIMIT')) {
      return false;
    }
    return message.includes('limit') || message.includes('quota') || message.includes('upgrade required');
  };

  const isRateLimitedError = (error: unknown) => {
    const typed = error as { code?: string; status?: number; message?: string } | undefined;
    const code = (typed?.code ?? '').toUpperCase();
    const message = (typed?.message ?? (error instanceof Error ? error.message : '')).toLowerCase();
    if (isLimitOrUpgradeError(error)) return false;
    return typed?.status === 429 || code.includes('RATE_LIMIT') || message.includes('too many');
  };

  const getLimitNoticeMessage = useCallback((kind: 'chat' | 'image' | 'video') => {
    if (kind === 'image') return t('chat.limit.imageReached');
    if (kind === 'video') return t('chat.limit.videoReached');
    return t('chat.limit.chatReached');
  }, [t]);

  const getLimitKind = (error: unknown, fallback: 'chat' | 'image' | 'video') => {
    const typed = error as { code?: string; message?: string } | undefined;
    const signal = `${typed?.code ?? ''} ${typed?.message ?? (error instanceof Error ? error.message : '')}`.toLowerCase();
    if (signal.includes('video')) return 'video';
    if (signal.includes('image')) return 'image';
    if (signal.includes('chat') || signal.includes('text') || signal.includes('message')) return 'chat';
    return fallback;
  };

  const getLimitResetHours = (error: unknown) => {
    const message = (error as { message?: string } | undefined)?.message
      ?? (error instanceof Error ? error.message : '');
    const match = message.match(/resets?\s+in\s+(\d+(?:\.\d+)?)\s*hours?/i);
    if (!match) return null;
    const hours = Number(match[1]);
    return Number.isFinite(hours) && hours >= 0 ? hours : null;
  };

  const formatLimitResetDuration = (hours: number) => {
    if (hours < 1) return 'less than an hour';
    const totalHours = Math.ceil(hours);
    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;
    if (days === 0) return `${totalHours} hour${totalHours === 1 ? '' : 's'}`;
    const dayPart = `${days} day${days === 1 ? '' : 's'}`;
    if (remainingHours === 0) return dayPart;
    return `${dayPart} and ${remainingHours} hour${remainingHours === 1 ? '' : 's'}`;
  };

  const formatTierLabel = useCallback((tier: 'free' | 'cafa_smart' | 'cafa_pro' | 'cafa_max') => {
    if (tier === 'cafa_smart') return 'Cafa Smart';
    if (tier === 'cafa_pro') return 'Cafa Pro';
    if (tier === 'cafa_max') return 'Cafa Max';
    return 'Free';
  }, []);

  const showLimitNotice = useCallback((kind: 'chat' | 'image' | 'video', resetHours?: number | null) => {
    setUpgradeNoticeKind(kind);
    setUpgradeNoticeResetHours(resetHours ?? null);
    setStatusNotice(getLimitNoticeMessage(kind));
    const requestId = rewardEligibilityRequestRef.current + 1;
    rewardEligibilityRequestRef.current = requestId;
    if (!canWatchRewardedAds) {
      setRewardAdOffer({ kind, available: false });
    } else {
      setRewardAdOffer({ kind, available: null });
      void getRewardEligibility(kind)
        .then((eligibility) => {
          if (rewardEligibilityRequestRef.current !== requestId) return;
          const available = eligibility.eligible && eligibility.remainingToday > 0;
          setRewardAdOffer({ kind, available });
          if (__DEV__) console.log('[ads:reward-eligibility:limit-notice]', {
            rewardType: kind,
            eligible: eligibility.eligible,
            reason: eligibility.reason ?? null,
            remainingToday: eligibility.remainingToday,
            dailyLimit: eligibility.dailyLimit,
          });
        })
        .catch((error) => {
          if (rewardEligibilityRequestRef.current !== requestId) return;
          setRewardAdOffer({ kind, available: false });
          if (__DEV__) console.warn('[ads:reward-eligibility:error]', {
            rewardType: kind,
            message: error instanceof Error ? error.message : String(error),
          });
        });
    }
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = null;
  }, [canWatchRewardedAds, getLimitNoticeMessage]);

  const showRewardFlowNotice = useCallback((message: string, durationMs = 5000) => {
    setUpgradeNoticeKind(null);
    setUpgradeNoticeResetHours(null);
    setStatusNotice(message);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => {
      setStatusNotice('');
      noticeTimeoutRef.current = null;
    }, durationMs);
  }, []);

  const watchAdForLimitReward = useCallback(async () => {
    const rewardType = upgradeNoticeKind;
    if (!rewardType || !isAuthenticated || isRewardAdProcessing) return;
    if (!canWatchRewardedAds) {
      if (__DEV__) console.log('[ads:reward-flow:blocked-paid-tier]', {
        rewardType,
        authTier: tier,
        activeTier,
      });
      showRewardFlowNotice('Rewarded ads are only available on the Free plan.');
      return;
    }

    if (__DEV__) console.log('[ads:reward-flow:start]', { rewardType, authenticated: isAuthenticated });
    setIsRewardAdProcessing(true);
    try {
      const session = await createRewardSession(rewardType);
      if (!session.eligible) {
        setRewardAdOffer({ kind: rewardType, available: false });
        if (__DEV__) console.log('[ads:reward-flow:ineligible]', { rewardType, reason: session.reason, sessionId: session.sessionId });
        const capMessage = session.reason === 'daily_cap_reached'
          ? `You've used all ${session.dailyLimit} ${rewardType === 'chat' ? 'chat' : rewardType} rewarded ads for today.`
          : 'A rewarded ad is not available for this limit right now.';
        showRewardFlowNotice(capMessage);
        return;
      }

      const result = await showRewardedAd({
        rewardType,
        sessionId: session.sessionId,
        ssvUserId: session.ssvUserId,
        ssvCustomData: session.ssvCustomData,
      });
      if (result.status === 'cancelled') {
        if (__DEV__) console.log('[ads:reward-flow:cancelled]', { rewardType, sessionId: session.sessionId });
        showRewardFlowNotice('Ad cancelled. No reward was used.');
        return;
      }

      let grant = await claimRewardSession(session.sessionId, result.adReward);
      for (
        let attempt = 1;
        grant.status === 'pending_verification' && attempt < REWARD_VERIFICATION_ATTEMPTS;
        attempt += 1
      ) {
        setStatusNotice('Ad completed. Verifying your reward…');
        await new Promise((resolve) => setTimeout(resolve, REWARD_VERIFICATION_INTERVAL_MS));
        grant = await claimRewardSession(session.sessionId, result.adReward);
      }
      if (grant.status === 'pending_verification') {
        showRewardFlowNotice('Ad completed. Google verification is taking longer than usual. Your reward will be added automatically when verification arrives.', 8000);
        if (__DEV__) console.warn('[ads:reward-flow:verification-delayed]', {
          rewardType,
          sessionId: session.sessionId,
          reason: 'pending_verification',
        });
        return;
      }

      captureEvent(AnalyticsEvents.rewardedRewardGranted, {
        rewardType,
        sessionId: session.sessionId,
        grantAmount: grant.grantAmount,
        remainingToday: grant.remainingToday,
        dailyLimit: grant.dailyLimit,
      });
      if (__DEV__) console.log('[ads:reward-flow:granted]', { rewardType, sessionId: session.sessionId, grantAmount: grant.grantAmount });
      hapticSuccess();
      const unit = rewardType === 'chat'
        ? 'chat prompts'
        : rewardType === 'image'
          ? 'image generation'
          : 'video generation';
      showRewardFlowNotice(`Reward granted: +${grant.grantAmount} ${unit}. Use it before today's reset.`);
      await refreshAuthUser().catch(() => {});
    } catch (error) {
      const response = (error as {
        response?: { status?: number; data?: { message?: string; code?: string } };
      })?.response;
      const status = response?.status;
      const code = response?.data?.code?.toUpperCase() ?? '';
      const message = status === 404 || status === 501
        ? 'Rewarded ads are not available yet. Please try again later or upgrade your plan.'
        : status === 429 || code === 'AD_REWARD_DAILY_CAP_REACHED'
          ? `You have used all ${AD_REWARD_DAILY_LIMITS[rewardType]} ${rewardType === 'chat' ? 'chat' : rewardType} rewarded ads for today. Please try again tomorrow.`
          : status === 409 || code === 'AD_REWARD_NOT_VERIFIED'
            ? 'Reward not granted. We could not verify the completed ad, so no credit was added. Please try again shortly.'
            : status === 403
              ? (response?.data?.message || 'This account is not eligible for an ad reward right now.')
              : 'We could not process the rewarded ad. No reward was used. Please try again later.';
      if (status === 429 || status === 403 || code === 'AD_REWARD_DAILY_CAP_REACHED') {
        setRewardAdOffer({ kind: rewardType, available: false });
      }
      if (__DEV__) console.warn('[ads:reward-flow:error]', {
        rewardType,
        status,
        code,
        message: response?.data?.message ?? (error instanceof Error ? error.message : String(error)),
        error,
      });
      showRewardFlowNotice(message, 6500);
      hapticError();
    } finally {
      setIsRewardAdProcessing(false);
    }
  }, [activeTier, canWatchRewardedAds, isAuthenticated, isRewardAdProcessing, refreshAuthUser, showRewardFlowNotice, tier, upgradeNoticeKind]);

  const restorePurchasesAndSyncFromLimitNotice = useCallback(async () => {
    if (Platform.OS !== 'ios' || !isAuthenticated || isLimitRestoreSyncing) return;

    setIsLimitRestoreSyncing(true);
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
    setStatusNotice(t('plans.syncingSubscription'));

    try {
      await restorePurchases();
      await refreshCustomerInfo();
      const synced = await syncSubscriptionState().catch(() => null);
      if (synced?.tier && synced.tier !== 'free') {
        setAuthSubscriptionTier(synced.tier);
      }
      const timeoutAt = Date.now() + LIMIT_RESTORE_SYNC_TIMEOUT_MS;
      let resolvedTier: 'free' | 'cafa_smart' | 'cafa_pro' | 'cafa_max' = 'free';
      while (Date.now() < timeoutAt) {
        try {
          const latest = await getSubscriptionOverview({ force: true });
          const latestTier = latest.subscription.tier;
          const latestStatus = latest.subscription.status;
          const isUsablePaidTier =
            latestTier !== 'free'
            && (latestStatus === 'active' || latestStatus === 'trialing' || latestStatus === 'past_due');
          if (isUsablePaidTier) {
            resolvedTier = latestTier;
            break;
          }
        } catch {
          // Keep polling until timeout.
        }
        await new Promise((resolve) => setTimeout(resolve, LIMIT_RESTORE_SYNC_POLL_MS));
      }

      await refreshAuthUser().catch(() => {});
      if (resolvedTier !== 'free') {
        setAuthSubscriptionTier(resolvedTier);
        setStatusNotice(t('plans.upgradeVerified', { plan: formatTierLabel(resolvedTier) }));
        setUpgradeNoticeKind(null);
        setUpgradeNoticeResetHours(null);
        hapticSuccess();
      } else {
        setStatusNotice(t('plans.upgradeSyncPending'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('plans.portalError');
      setStatusNotice(message);
      hapticError();
    } finally {
      setIsLimitRestoreSyncing(false);
    }
  }, [
    formatTierLabel,
    isAuthenticated,
    isLimitRestoreSyncing,
    refreshAuthUser,
    refreshCustomerInfo,
    restorePurchases,
    setAuthSubscriptionTier,
    t,
  ]);

  const getFriendlyErrorMessage = useCallback((error: unknown, kind: 'chat' | 'image' | 'video' = 'chat') => {
    const typed = error as { code?: string; status?: number; message?: string } | undefined;
    const code = (typed?.code ?? '').toUpperCase();
    const rawMessage = typed?.message ?? (error instanceof Error ? error.message : '');
    const message = rawMessage.toLowerCase();
    const isModelUnavailableUpgrade = code === 'UPGRADE_REQUIRED' && message.includes('not available on your current plan');

    if (isModelUnavailableUpgrade) {
      if (message.includes('gpt-4o-mini')) return 'Cafa Smart is not available on your current plan.';
      if (message.includes('gpt-4o')) return 'Cafa Ultra is not available on your current plan.';
      return 'This model is not available on your current plan.';
    }

    if (code.endsWith('_LIMIT_EXCEEDED') || code === 'LIMIT_EXCEEDED') {
      return getLimitNoticeMessage(kind);
    }

    if (typed?.status === 429 || code.includes('RATE_LIMIT')) {
      return 'Too many requests right now. Please wait a moment and try again.';
    }

    if (isLimitOrUpgradeError(error)) {
      return getLimitNoticeMessage(kind);
    }
    if (code === 'GUEST_ENDPOINT_UNAVAILABLE' || message.includes('guest mode is unavailable on this backend')) {
      return 'Guest mode is currently unavailable. Please try again later or sign in.';
    }
    if (code === 'GUEST_NETWORK_ERROR') {
      return rawMessage || 'Guest mode could not reach the server. Check your connection and try again.';
    }
    if (typed?.status === 401 || code === 'TOKEN_EXPIRED' || code === 'UNAUTHORIZED') {
      return 'Your session expired. Please sign in again.';
    }
    if (code === 'VIDEO_FROM_IMAGE_FILE_MISSING' || code === 'VIDEO_FROM_IMAGE_FILE_UNREADABLE') {
      return 'The selected image is no longer available. Please reselect the image and try again.';
    }
    if (code === 'VIDEO_FROM_IMAGE_INVALID_URI') {
      return 'Could not read the selected image. Please choose the image again and retry.';
    }
    if (code === 'VIDEO_FROM_IMAGE_NETWORK_ERROR' || code === 'NETWORK_ERROR') {
      return 'Upload failed before reaching the server. Check connection and try again.';
    }
    if (code === 'IMAGE_GENERATION_TIMEOUT') {
      return 'Image generation is taking longer than expected. Please try again.';
    }
    if (typed?.status === 403 || code === 'FORBIDDEN' || code === 'UPGRADE_REQUIRED' || message === 'forbidden') {
      return 'You do not have permission for this action on your current plan.';
    }
    if (
      code === 'USAGE_LIMIT_EXCEEDED'
      || code === 'DAILY_LIMIT_EXCEEDED'
      || code === 'GUEST_DAILY_LIMIT_EXCEEDED'
    ) {
      return getLimitNoticeMessage(kind);
    }
    if (typed?.status === 500 || typed?.status === 502 || typed?.status === 503 || typed?.status === 504) {
      return 'Something went wrong on our server. Please try again in a moment.';
    }
    if (message.includes('internal server error')) {
      return 'Something went wrong on our server. Please try again in a moment.';
    }
    if (typed?.status === 404 || code === 'NOT_FOUND') {
      return 'This feature is currently unavailable.';
    }
    return rawMessage || t('chat.sendFailed');
  }, [getLimitNoticeMessage, t]);

  useEffect(() => {
    if (isAuthenticated) return;
    setStatusNotice('');
    setUpgradeNoticeKind(null);
    setUpgradeNoticeResetHours(null);
    setIsLimitRestoreSyncing(false);
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      setGuestUpsellVisible(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(GUEST_UPSELL_STATE_KEY);
        const now = Date.now();
        if (!raw) {
          guestUpsellStateRef.current = { windowStartedAt: now, responseCount: 0, shown: false };
          return;
        }
        const parsed = JSON.parse(raw) as Partial<{ windowStartedAt: number; responseCount: number; shown: boolean }>;
        const windowStartedAt = typeof parsed.windowStartedAt === 'number' ? parsed.windowStartedAt : 0;
        const responseCount = typeof parsed.responseCount === 'number' ? parsed.responseCount : 0;
        const shown = parsed.shown === true;
        const isExpired = windowStartedAt <= 0 || now - windowStartedAt >= GUEST_UPSELL_WINDOW_MS;
        const nextState = isExpired
          ? { windowStartedAt: now, responseCount: 0, shown: false }
          : { windowStartedAt, responseCount, shown };
        if (!cancelled) {
          guestUpsellStateRef.current = nextState;
        }
      } catch {
        if (!cancelled) {
          guestUpsellStateRef.current = { windowStartedAt: Date.now(), responseCount: 0, shown: false };
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [GUEST_UPSELL_STATE_KEY, GUEST_UPSELL_WINDOW_MS, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      setGuestAllowanceNotice(null);
      setGuestAllowanceHydrated(true);
      return;
    }

    let cancelled = false;
    setGuestAllowanceHydrated(false);
    void (async () => {
      let storedCount = 0;
      try {
        const raw = await AsyncStorage.getItem(GUEST_MESSAGE_COUNT_KEY);
        const parsed = Number.parseInt(raw ?? '0', 10);
        storedCount = Number.isFinite(parsed)
          ? Math.min(GUEST_MESSAGE_LIMIT, Math.max(0, parsed))
          : 0;
      } catch {
        // Keep guest chat safe and usable if storage is temporarily unavailable.
      }

      if (cancelled) return;
      guestMessageCountRef.current = storedCount;
      setGuestMessageCount(storedCount);
      setGuestAllowanceNotice(storedCount >= GUEST_MESSAGE_LIMIT ? 25 : null);
      setGuestAllowanceHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [GUEST_MESSAGE_COUNT_KEY, GUEST_MESSAGE_LIMIT, isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      if (guestModeLocked) {
        setGuestAllowanceNotice(25);
      }
    }, [guestModeLocked]),
  );

  const showTooltip = (text: string, event?: GestureResponderEvent) => {
    hapticSelection();
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);

    const fallbackX = screenWidth / 2;
    const fallbackY = Dimensions.get('window').height - 180;
    const pageX = event?.nativeEvent?.pageX ?? fallbackX;
    const pageY = event?.nativeEvent?.pageY ?? fallbackY;

    setTooltipState({ text, x: pageX, y: pageY });
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipState(null);
      tooltipTimeoutRef.current = null;
    }, 1200);
  };

  const showDownloadToast = useCallback((message: string, durationMs: number | null = 2400) => {
    setDownloadToastNotice(message);
    if (downloadToastTimeoutRef.current) clearTimeout(downloadToastTimeoutRef.current);
    if (durationMs === null) {
      downloadToastTimeoutRef.current = null;
      return;
    }
    downloadToastTimeoutRef.current = setTimeout(() => {
      setDownloadToastNotice('');
      downloadToastTimeoutRef.current = null;
    }, durationMs);
  }, []);

  const showTtsToast = useCallback((message: string) => {
    setTtsToastNotice(message);
    if (ttsToastTimeoutRef.current) clearTimeout(ttsToastTimeoutRef.current);
    ttsToastTimeoutRef.current = setTimeout(() => {
      setTtsToastNotice('');
      ttsToastTimeoutRef.current = null;
    }, 2600);
  }, []);

  const resolveVoiceLabel = useCallback(async (voiceId?: string | null) => {
    if (!voiceId) return t('chat.voice.default');
    if (voiceNameByIdRef.current[voiceId]) return voiceNameByIdRef.current[voiceId];
    try {
      const catalog = await getVoiceCatalog();
      voiceNameByIdRef.current = catalog.reduce<Record<string, string>>((acc, voice) => {
        acc[voice.id] = voice.name;
        return acc;
      }, {});
      return voiceNameByIdRef.current[voiceId] ?? voiceId;
    } catch {
      return voiceId;
    }
  }, [t]);

  const flushPendingAssistantDelta = () => {
    const assistantId = pendingAssistantIdRef.current;
    const pending = pendingDeltaRef.current;
    if (!assistantId || !pending) return;

    setMessages((prev) => {
      const lastIndex = prev.length - 1;
      if (lastIndex >= 0 && prev[lastIndex].id === assistantId) {
        const next = [...prev];
        next[lastIndex] = { ...next[lastIndex], content: `${next[lastIndex].content}${pending}` };
        return next;
      }

      for (let i = prev.length - 1; i >= 0; i -= 1) {
        if (prev[i].id !== assistantId) continue;
        const next = [...prev];
        next[i] = { ...next[i], content: `${next[i].content}${pending}` };
        return next;
      }
      return prev;
    });
    pendingDeltaRef.current = '';
  };

  const queueAssistantDelta = (assistantId: string, delta: string) => {
    pendingAssistantIdRef.current = assistantId;
    pendingDeltaRef.current += delta;
    if (deltaFlushTimerRef.current) return;
    deltaFlushTimerRef.current = setTimeout(() => {
      const targetId = pendingAssistantIdRef.current;
      const pending = pendingDeltaRef.current;
      if (!targetId || !pending) {
        deltaFlushTimerRef.current = null;
        return;
      }

      const chunk = pending.slice(0, STREAM_FLUSH_CHARS);
      pendingDeltaRef.current = pending.slice(chunk.length);
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (lastIndex >= 0 && prev[lastIndex].id === targetId) {
          const next = [...prev];
          next[lastIndex] = { ...next[lastIndex], content: `${next[lastIndex].content}${chunk}` };
          return next;
        }

        for (let i = prev.length - 1; i >= 0; i -= 1) {
          if (prev[i].id !== targetId) continue;
          const next = [...prev];
          next[i] = { ...next[i], content: `${next[i].content}${chunk}` };
          return next;
        }
        return prev;
      });

      deltaFlushTimerRef.current = null;
      if (pendingDeltaRef.current) {
        queueAssistantDelta(targetId, '');
      }
    }, STREAM_FLUSH_INTERVAL_MS);
  };

  const getMessageItemType = useCallback((item: UiMessage) => {
    if (item.imageUrl || item.isImageGenerating) return 'image';
    if (item.videoUrl || item.isVideoGenerating) return 'video';
    if (item.isArtifactGenerating) return 'artifact';
    return item.role;
  }, []);

  const handleSend = (options?: { skipDocumentFormWarning?: boolean; fromQueue?: QueuedSend }) => {
      const run = async () => {
        const trimmed = options?.fromQueue ? options.fromQueue.text.trim() : inputValueRef.current.trim();
        const attachmentsForSend = options?.fromQueue ? [...options.fromQueue.attachments] : [...attachedAssets];
        clearPromptSuggestions();
        ++sendAttemptSeqRef.current;
        const now = Date.now();
        const sinceLastAttemptMs = now - lastSendAttemptAtRef.current;
        const SEND_DEBOUNCE_MS = 450;
        let lastEndpoint = `${API_BASE_URL}/chat`;
        let lastIdempotencyKey = '';
        let activeAuthConversationId: string | null = authConversationId ?? null;

        if (!trimmed && attachmentsForSend.length === 0) {
          return;
        }

        if (!isAuthenticated) {
          if (!guestAllowanceHydrated) return;
          if (guestMessageCountRef.current >= GUEST_MESSAGE_LIMIT) {
            setGuestAllowanceNotice(25);
            return;
          }
        }

        if (
          !options?.skipDocumentFormWarning
          && screenMode === 'chat'
          && trimmed
          && hasExpandedDocumentWizard()
        ) {
          setDocumentFormWarningVisible(true);
          return;
        }

        if (screenMode === 'chat' && options?.skipDocumentFormWarning && hasExpandedDocumentWizard()) {
          collapseAllDocumentWizards();
        }

        if (
          isDedicatedMediaScreen
          && !trimmed
          && attachmentsForSend.some((asset) => (asset.mimeType ?? '').toLowerCase().startsWith('image/'))
        ) {
          setMessages((prev) => {
            const withoutSyntheticWelcome = prev.filter((message) => !isWelcomeMessage(message));
            return [
              ...withoutSyntheticWelcome,
              {
                id: `assistant-prompt-required-${Date.now()}`,
                role: 'assistant',
                content:
                  screenMode === 'image-to-video'
                    ? 'Add a prompt describing the motion, camera movement, or scene you want before sending this image.'
                    : 'Add a prompt describing the changes you want before sending this image.',
                createdAt: Date.now(),
              },
            ];
          });
          autoScrollEnabledRef.current = true;
          setShowScrollToBottom(false);
          scrollToBottom();
          return;
        }

        if (!options?.fromQueue && sinceLastAttemptMs < SEND_DEBOUNCE_MS) {
          return;
        }

        if (isSendRunInFlightRef.current || isSending || isUnderstandingPrompt) {
          if (options?.fromQueue) {
            setSendQueue((prev) => [options.fromQueue!, ...prev]);
            return;
          }
          // Another reply is still generating: line this message up behind it
          // instead of dropping it (same idea as Claude/ChatGPT follow-ups).
          if (screenMode === 'chat' && isAuthenticated && !isDedicatedMediaScreen) {
            if (sendQueue.length >= MAX_QUEUED_SENDS) {
              showTransientNotice(t('chat.queue.full'));
              return;
            }
            lastSendAttemptAtRef.current = now;
            setSendQueue((prev) => [
              ...prev,
              { id: `queued-${now}-${prev.length}`, text: trimmed, attachments: attachmentsForSend },
            ]);
            inputValueRef.current = '';
            setInput('');
            setIsEditingPrompt(false);
            if (attachmentsForSend.length) setAttachedAssets([]);
            hapticSelection();
          }
          return;
        }
        lastSendAttemptAtRef.current = now;
        isSendRunInFlightRef.current = true;
        setIsSending(true);
        setIsEditingPrompt(false);
        setStatusNotice('');
        const runHandle: ActiveSendRun = {
          id: ++runSeqRef.current,
          controller: new AbortController(),
          stoppedByUser: false,
          detached: false,
        };
        activeRunRef.current = runHandle;

        const shouldShowPromptUnderstanding =
          (screenMode === 'image-to-video' || screenMode === 'edit-image') && trimmed.length > 0;
        if (shouldShowPromptUnderstanding) {
          setIsUnderstandingPrompt(true);
        }

        let requestKind: 'chat' | 'image' | 'video' = 'chat';
        let usedVideoReferenceFollowUp = false;
        let requestedVideoPrompt = '';
        let requestedVideoConversationId = '';
        let requestedVideoStartedAt = 0;
        let didMutateChats = false;
        let preserveLimitNotice = false;
        let preClassifiedChatType: 'text' | 'search' | undefined;
        let responseLogEmitted = false;
        let assistantResponseBuffer = '';
        let responseRecoveryStartAt = 0;
        let assistantId = '';
        let activeAssistantId = '';

        const logResponsePayloadForAttempt = (responsePayload: Record<string, unknown>) => {
          if (!__DEV__ || responseLogEmitted) return;
          responseLogEmitted = true;
          const payload = {
            endpoint: lastEndpoint,
            requestKind,
            isAuthenticated,
            conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
            idempotencyKey: lastIdempotencyKey || null,
            ...responsePayload,
          };
          try {
            console.log('[chat-send:response]', JSON.stringify(payload));
          } catch {
            console.log('[chat-send:response]', payload);
          }
        };
        const logParsedResponseForAttempt = (raw: string) => {
          const parsedText = raw.trim();
          if (!parsedText) return;
          logResponsePayloadForAttempt({ responseText: parsedText });
        };

        try {
          let effectivePrompt = trimmed;
          const hasImageAttachment = attachmentsForSend.some((asset) =>
            (asset.mimeType ?? '').toLowerCase().startsWith('image/'),
          );
          let imageRequirement: ImageRequirementConfig | null = null;
          let screenHandoff: ScreenHandoffConfig | null = null;

          if (screenMode !== 'chat') {
            // The rewrite only improves the prompt and routes misplaced
            // requests. The web no longer calls it (it 500s), so it's off by
            // default; the user's own prompt is sent through the chat stream.
            let interpretation: Awaited<ReturnType<typeof rewriteMediaPrompt>>['result'] | null = null;
            if (USE_MEDIA_PROMPT_REWRITE) try {
              lastEndpoint = `${API_BASE_URL}/media/prompts/rewrite`;
              logSendPayload({
                endpoint: lastEndpoint,
                mode: 'backend-media-intent-detect',
                screen: screenMode,
                prompt: trimmed,
                language,
              });
              const interpretationResponse = await rewriteMediaPrompt({
                screen: screenMode,
                prompt: trimmed,
                language,
              });
              interpretation = interpretationResponse.result;
              if (__DEV__) {
                try {
                  console.log('[media-intent:backend-response]', JSON.stringify({
                    endpoint: lastEndpoint,
                    request: { screen: screenMode, prompt: trimmed, language },
                    response: interpretationResponse.rawResponse,
                  }));
                } catch {
                  console.log('[media-intent:backend-response]', interpretationResponse.rawResponse);
                }
              }
            } catch (rewriteError) {
              if (__DEV__) console.warn('[media-intent:rewrite-failed] using original prompt', rewriteError);
            }
            effectivePrompt = interpretation?.rewrittenPrompt.trim() || trimmed;

            if (!interpretation) {
              // Needs an attached image or a referenced past image (web rule).
              if (!hasImageAttachment && !composerMediaReference) {
                imageRequirement = {
                  title: 'Add an image first',
                  description: screenMode === 'image-to-video'
                    ? 'Upload an image before sending this prompt so Cafa AI can generate a video from it.'
                    : 'Upload an image before sending this prompt so Cafa AI can edit it for you.',
                  ctaLabel: 'Upload image',
                  iconName: 'image-outline',
                };
              }
            } else if (!interpretation.belongsToCurrentScreen) {
              screenHandoff = interpretation.intent === 'edit-image'
                ? {
                    target: 'edit-image',
                    title: 'Better in Edit Image',
                    description: interpretation.reason || 'This request is better handled in the Edit Image screen.',
                    ctaLabel: 'Open Edit Image',
                    iconName: 'color-wand-outline',
                  }
                : interpretation.intent === 'image-to-video'
                  ? {
                      target: 'image-to-video',
                      title: 'Better in Image-to-Video',
                      description: interpretation.reason || 'This request is better handled in the Image-to-Video screen.',
                      ctaLabel: 'Open Image-to-Video',
                      iconName: 'film-outline',
                    }
                  : {
                      target: 'index',
                      title: 'Use main chat for this',
                      description: interpretation.reason || 'This request is better handled in the main chat.',
                      ctaLabel: 'Open main chat',
                      iconName: 'chatbubble-ellipses-outline',
                    };
            } else if (interpretation.requiresImage && !hasImageAttachment) {
              imageRequirement = {
                title: 'Add an image first',
                description: screenMode === 'image-to-video'
                  ? 'Upload an image before sending this prompt so Cafa AI can generate a video from it.'
                  : 'Upload an image before sending this prompt so Cafa AI can edit it for you.',
                ctaLabel: 'Upload image',
                iconName: 'image-outline',
              };
            }
          }

          if (imageRequirement) {
            logSendPayload({
              endpoint: lastEndpoint,
              mode: 'backend-media-intent-image-required',
              conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
              screenMode,
              message: trimmed,
              language,
              model: activeModel,
              attachments: attachmentsForSend.map((asset) => ({
                id: asset.id,
                label: asset.label,
                fileName: asset.fileName,
                mimeType: asset.mimeType,
                uri: asset.uri,
              })),
            });
            setMessages((prev) => {
              const withoutSyntheticWelcome = prev.filter((message) => !isWelcomeMessage(message));
              return [
                ...withoutSyntheticWelcome,
                {
                  id: `assistant-image-required-${Date.now()}`,
                  role: 'assistant',
                  content: '',
                  createdAt: Date.now(),
                  imageRequirement,
                },
              ];
            });
            autoScrollEnabledRef.current = true;
            setShowScrollToBottom(false);
            scrollToBottom();
            return;
          }

          if (screenHandoff) {
            logSendPayload({
              endpoint: lastEndpoint,
              mode: 'backend-media-intent-handoff',
              conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
              screenMode,
              message: trimmed,
              language,
              model: activeModel,
              reference: composerMediaReference ?? null,
              attachments: attachmentsForSend.map((asset) => ({
                id: asset.id,
                label: asset.label,
                fileName: asset.fileName,
                mimeType: asset.mimeType,
                uri: asset.uri,
              })),
              handoffTarget: screenHandoff.target,
            });
            const userMessage: UiMessage = {
              id: `user-${Date.now()}`,
              role: 'user',
              content: trimmed,
              createdAt: Date.now(),
              attachments: attachmentsForSend.map((asset) => ({
                id: asset.id,
                originalName: asset.fileName ?? asset.label,
                mimeType: asset.mimeType,
                fileType: (asset.mimeType ?? '').toLowerCase().startsWith('image/') ? 'image' : 'document',
                url: asset.uri,
                thumbnailUrl: asset.uri,
              })),
            };
            const assistantMessage: UiMessage = {
              id: `assistant-handoff-${Date.now()}`,
              role: 'assistant',
              content: '',
              createdAt: Date.now() + 1,
              screenHandoff,
            };
            setAttachmentMenuOpen(false);
            setModelMenuOpen(false);
            if (!options?.fromQueue) {
              if (attachmentsForSend.length) {
                setAttachedAssets([]);
              }
              inputValueRef.current = '';
              setInput('');
            }
            setMessages((prev) => {
              const withoutSyntheticWelcome = prev.filter((message) => !isWelcomeMessage(message));
              return [...withoutSyntheticWelcome, userMessage, assistantMessage];
            });
            autoScrollEnabledRef.current = true;
            setShowScrollToBottom(false);
            scrollToBottom();
            return;
          }

          setIsUnderstandingPrompt(false);

          let detectedExpectedResponseType: import('@/types').ExpectedResponseType = 'text';
          let classificationLoadingLabel: string | null = null;
          let analyzedUserMessage: UiMessage | null = null;
          let analyzedAssistantId = '';
          if (screenMode === 'chat' && isAuthenticated) {
            analyzedUserMessage = {
              id: `user-${Date.now()}`,
              role: 'user',
              content: trimmed,
              createdAt: Date.now(),
              referencedMedia: composerMediaReference ? { ...composerMediaReference } : undefined,
              attachments: attachmentsForSend.map((asset) => ({
                id: asset.id,
                originalName: asset.fileName ?? asset.label,
                mimeType: asset.mimeType,
                fileType: (asset.mimeType ?? '').toLowerCase().startsWith('image/') ? 'image' : 'document',
                url: asset.uri,
                thumbnailUrl: asset.uri,
              })),
            };
            analyzedAssistantId = `assistant-${Date.now()}`;
            setAttachmentMenuOpen(false);
            setModelMenuOpen(false);
            if (!options?.fromQueue) {
              if (attachmentsForSend.length) setAttachedAssets([]);
              Keyboard.dismiss();
              inputValueRef.current = '';
              setInput('');
            }
            setMessages((prev) => [
              ...prev.filter((message) => !isWelcomeMessage(message)),
              analyzedUserMessage!,
              { id: analyzedAssistantId, role: 'assistant', content: '', createdAt: Date.now() + 1, isAnalyzing: true },
            ]);
            autoScrollEnabledRef.current = true;
            setShowScrollToBottom(false);
            scrollToBottom();

            const hasAttachment = attachmentsForSend.length > 0;
            // Real cleanup (2026-09-12): this used to call /chat/classify
            // (and, on an 'artifact' result, /documents/wizard/detect)
            // before every send. Both routes' only real backend
            // (apis.niveel.com/ai-inference-hub) is permanently
            // decommissioned -- confirmed live against cafatest.niveel.com,
            // where /chat/classify always falls through to a hardcoded
            // { responseType: 'text' } after a wasted round trip. The new
            // tool-calling backend decides media/document intent itself via
            // real tool calls, so mobile no longer needs a pre-send guess --
            // this local default is exactly what the network call always
            // resolved to anyway, just without the latency.
            const classification: import('@/types').ChatClassificationResult = hasAttachment
              ? {
                  responseType: 'text',
                  confidence: 1,
                  subIntent: null,
                  label: t('chat.status.analyzingAttachment'),
                  description: t('chat.status.analyzingAttachmentHint'),
                }
              : {
                  responseType: 'text',
                  confidence: 0.5,
                  subIntent: 'general',
                  label: t('chat.status.thinking'),
                  description: t('chat.status.thinkingHint'),
                };
            const actionableClassificationResponseType = classification.responseType;
            const detection: import('@/types').DetectDocumentRequestResult = {
              isDocumentRequest: false,
              documentType: null,
              format: null,
              confidence: 0,
              expectedResponseType: 'text',
              needsForm: false,
              formReason: null,
            };
            detectedExpectedResponseType = detection.expectedResponseType === 'artifact'
              ? 'artifact'
              : actionableClassificationResponseType;
            if (!hasAttachment && (classification.responseType === 'text' || classification.responseType === 'search')) {
              preClassifiedChatType = classification.responseType;
            }
            classificationLoadingLabel = classification.label;
            setStreamingModelLabel(classification.label);
            setStatusNotice(classification.description);
            if (__DEV__) {
              try {
                console.log('[chat-classify:result]', JSON.stringify({
                  endpoint: `${API_BASE_URL}/chat/classify`,
                  conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
                  responseType: classification.responseType,
                  actionableResponseType: actionableClassificationResponseType,
                  confidence: classification.confidence,
                  subIntent: classification.subIntent,
                  classificationSkipped: hasAttachment,
                  routeThroughRegularChat: false,
                }));
                console.log('[document-detect:result]', JSON.stringify({
                  endpoint: `${API_BASE_URL}/documents/wizard/detect`,
                  skipped: true,
                  conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
                  isDocumentRequest: detection.isDocumentRequest,
                  documentType: detection.documentType,
                  format: detection.format,
                  confidence: detection.confidence,
                  expectedResponseType: detection.expectedResponseType,
                  needsForm: detection.needsForm,
                  formReason: detection.formReason,
                }));
              } catch {
                console.log('[chat-classify:result]', {
                  endpoint: `${API_BASE_URL}/chat/classify`,
                  conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
                  responseType: classification.responseType,
                  actionableResponseType: actionableClassificationResponseType,
                  confidence: classification.confidence,
                  subIntent: classification.subIntent,
                  classificationSkipped: hasAttachment,
                  routeThroughRegularChat: false,
                });
                console.log('[document-detect:result]', {
                  endpoint: `${API_BASE_URL}/documents/wizard/detect`,
                  skipped: true,
                  conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
                  isDocumentRequest: detection.isDocumentRequest,
                  documentType: detection.documentType,
                  format: detection.format,
                  confidence: detection.confidence,
                  expectedResponseType: detection.expectedResponseType,
                  needsForm: detection.needsForm,
                  formReason: detection.formReason,
                });
              }
            }

            const shouldStartDocumentWizard = detection.needsForm && (
              detection.isDocumentRequest
              || detection.expectedResponseType === 'artifact'
              || classification.responseType === 'artifact'
            );
            if (shouldStartDocumentWizard) {
              try {
                let wizardConversationId = activeAuthConversationId ?? authConversationId;
                if (!wizardConversationId) {
                  lastEndpoint = `${API_BASE_URL}/chat`;
                  const created = await createAuthenticatedConversation(getPromptTitle(trimmed, t('drawer.newChat')));
                  wizardConversationId = created.conversationId;
                  activeAuthConversationId = wizardConversationId;
                  setAuthConversationId(wizardConversationId);
                  didMutateChats = true;
                }
                lastEndpoint = `${API_BASE_URL}/documents/wizard/start`;
                logSendPayload({
                  endpoint: lastEndpoint,
                  mode: 'auth-document-start',
                  conversationId: wizardConversationId ?? activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
                  message: trimmed,
                  language,
                  model: activeModel,
                  reference: composerMediaReference ?? null,
                  attachments: [],
                  documentType: detection.documentType ?? null,
                  format: detection.format ?? null,
                  confidence: detection.confidence,
                  userRequest: trimmed,
                });
                setStatusNotice('Preparing your form...');
                const detectedDocumentType = detection.documentType?.trim() || 'document';
                const started = await startDocumentWizard(trimmed, {
                  conversationId: wizardConversationId ?? undefined,
                  documentType: detection.documentType ?? undefined,
                  format: detection.format ?? undefined,
                });
                wizardConversationId = started.conversationId ?? wizardConversationId;
                activeAuthConversationId = wizardConversationId ?? null;
                if (wizardConversationId) {
                  setAuthConversationId(wizardConversationId);
                }
                logResponsePayloadForAttempt({
                  responseType: 'document-wizard-start',
                  htmlLength: started.html.length,
                  userMessageId: started.userMessageId,
                  assistantMessageId: started.assistantMessageId,
                });
                const persistedUserMessage: UiMessage = {
                  ...analyzedUserMessage,
                  id: started.userMessageId,
                };
                const assistantMessage: UiMessage = {
                  id: started.assistantMessageId,
                  role: 'assistant',
                  content: `Fill in the form below and submit it here in chat. I’ll use it to create a stronger ${detectedDocumentType} for you.`,
                  createdAt: Date.now() + 1,
                  documentWizard: {
                    html: started.html,
                    documentType: detectedDocumentType,
                    format: detection.format ?? 'pdf',
                    collapsed: false,
                    userMessageId: started.userMessageId,
                    assistantMessageId: started.assistantMessageId,
                  },
                };

                Keyboard.dismiss();
                inputValueRef.current = '';
                setInput('');
                setComposerMediaReference(null);
                setAttachmentMenuOpen(false);
                setModelMenuOpen(false);
                const nextMessages = messages
                  .filter((message) => !isWelcomeMessage(message))
                  .map((message) => (
                    message.documentWizard
                      ? {
                          ...message,
                          documentWizard: {
                            ...message.documentWizard,
                            collapsed: true,
                          },
                        }
                      : message
                  ));
                nextMessages.push(persistedUserMessage, assistantMessage);
                setMessages((prev) => {
                  const withoutTemporaryAnalysis = prev.filter((message) => (
                    !isWelcomeMessage(message)
                    && message.id !== analyzedUserMessage?.id
                    && message.id !== analyzedAssistantId
                  ));
                  return [
                    ...withoutTemporaryAnalysis.map((message) => message.documentWizard
                      ? {
                          ...message,
                          documentWizard: { ...message.documentWizard, collapsed: true },
                        }
                      : message),
                    persistedUserMessage,
                    assistantMessage,
                  ];
                });
                await setDocumentWizardDraftMessages(
                  getDocumentWizardDraftKey(wizardConversationId ?? null),
                  collectDocumentWizardDraftMessages(nextMessages),
                );
                if (wizardConversationId && wizardConversationId !== params.conversationId) {
                  router.setParams({ conversationId: wizardConversationId, newChat: undefined });
                }
                autoScrollEnabledRef.current = true;
                setShowScrollToBottom(false);
                scrollToBottom();
                return;
              } catch (wizardError) {
                // A form-required request must not fall through to normal chat: the
                // chat endpoint can only respond with instructions to fill a form.
                throw wizardError;
              } finally {
                setStatusNotice('');
              }
            } else {
              // Real cleanup (2026-09-12): the direct-generate branch that
              // used to live here was gated on shouldRunDocumentDetection,
              // tied to the now-removed /documents/wizard/detect call --
              // detection.isDocumentRequest is always false now, so it could
              // never trigger. shouldStartDocumentWizard's own real
              // form-based path above still covers document requests.
              setStatusNotice('');
            }
          }

          const userMessage: UiMessage = analyzedUserMessage ?? {
            id: `user-${Date.now()}`,
            role: 'user',
            content: trimmed,
            createdAt: Date.now(),
            referencedMedia: composerMediaReference ? { ...composerMediaReference } : undefined,
            attachments: attachmentsForSend.map((asset) => ({
              id: asset.id,
              originalName: asset.fileName ?? asset.label,
              mimeType: asset.mimeType,
              fileType: (asset.mimeType ?? '').toLowerCase().startsWith('image/') ? 'image' : 'document',
              url: asset.uri,
              thumbnailUrl: asset.uri,
            })),
          };
          responseRecoveryStartAt = userMessage.createdAt - 1000;
          if (composerMediaReference) {
            pendingReferencedUserMessagesRef.current.push({
              sentAt: userMessage.createdAt,
              content: trimmed,
              reference: { ...composerMediaReference },
            });
          }

          assistantId = analyzedAssistantId || `assistant-${Date.now()}`;
          activeAssistantId = assistantId;
          const shouldUseBackendResponseTypeForLoading = screenMode === 'chat'
            && isAuthenticated;
          const shouldShowBackendArtifactLoading = shouldUseBackendResponseTypeForLoading
            && detectedExpectedResponseType === 'artifact';
          const suppressStreamingTextForArtifact = shouldShowBackendArtifactLoading;
          const shouldShowBackendImageLoading = !suppressStreamingTextForArtifact
            && shouldUseBackendResponseTypeForLoading
            && (detectedExpectedResponseType === 'image' || detectedExpectedResponseType === 'chart');
          const shouldShowBackendVideoLoading = !suppressStreamingTextForArtifact
            && shouldUseBackendResponseTypeForLoading
            && detectedExpectedResponseType === 'video';

          hapticImpact();
          assistantFirstDeltaRef.current = false;
          pendingAssistantIdRef.current = assistantId;
          pendingDeltaRef.current = '';
          if (deltaFlushTimerRef.current) {
            clearTimeout(deltaFlushTimerRef.current);
            deltaFlushTimerRef.current = null;
          }
          setAttachmentMenuOpen(false);
          setModelMenuOpen(false);
          if (attachmentsForSend.length) {
            setAttachedAssets([]);
          }
          Keyboard.dismiss();
          inputValueRef.current = '';
          setInput('');
          setComposerMediaReference(null);
          setStreamingModelLabel(
            classificationLoadingLabel ?? t(`chat.model.label.${activeModel}`),
          );
          setMessages((prev) => {
            const withoutSyntheticWelcome = prev.filter((message) => !isWelcomeMessage(message));
            const assistantMessage: UiMessage = {
              id: assistantId,
              role: 'assistant',
              content: '',
              createdAt: Date.now(),
              isAnalyzing: false,
              isArtifactGenerating: shouldShowBackendArtifactLoading || suppressStreamingTextForArtifact,
              isImageGenerating: shouldShowBackendImageLoading,
              isVideoGenerating: shouldShowBackendVideoLoading,
            };
            if (analyzedUserMessage) {
              return withoutSyntheticWelcome.map((message) => message.id === assistantId ? assistantMessage : message);
            }
            return [
              ...withoutSyntheticWelcome,
              userMessage,
              assistantMessage,
            ];
          });
          autoScrollEnabledRef.current = true;
          setShowScrollToBottom(false);
          scrollToBottom();

        if (!isAuthenticated) {
          if (screenMode !== 'chat' || isMediaGenerationPrompt(trimmed)) {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: t('chat.mediaNeedsLogin'),
                    }
                  : message,
              ),
            );
            return;
          }

          let conversationId = guestConversationId;
          if (!conversationId) {
            lastEndpoint = `${API_BASE_URL}/guest/session`;
            await ensureGuestSession();
            lastEndpoint = `${API_BASE_URL}/guest/chat`;
            const created = await createGuestConversation(getPromptTitle(trimmed, t('drawer.newChat')));
            conversationId = created.conversationId;
            setGuestConversationId(conversationId);
            didMutateChats = true;
          }

          lastEndpoint = `${API_BASE_URL}/guest/chat/${conversationId}/messages`;
          logSendPayload({
            endpoint: lastEndpoint,
            mode: 'guest-stream-chat',
            conversationId,
            message: trimmed,
            language,
            model: activeModel,
            reference: composerMediaReference ?? null,
            attachments: attachmentsForSend.map((asset) => ({
              id: asset.id,
              label: asset.label,
              fileName: asset.fileName,
              mimeType: asset.mimeType,
              uri: asset.uri,
            })),
          });
          await sendGuestMessageStream(
            conversationId,
            trimmed,
            (event) => {
              if (event.type === 'meta') {
                setStreamingModelLabel(
                  resolveModelBadgeLabel(event.model, activeModel),
                );
              }
              if (event.type === 'delta') {
                if (!assistantFirstDeltaRef.current) {
                  assistantFirstDeltaRef.current = true;
                  hapticSelection();
                }
                assistantResponseBuffer += event.content;
                if (!suppressStreamingTextForArtifact) {
                  queueAssistantDelta(assistantId, event.content);
                }
              }
              if (event.type === 'done') {
                if (!suppressStreamingTextForArtifact) {
                  flushPendingAssistantDelta();
                }
                hapticSuccess();
                setStreamingModelLabel(null);
                logParsedResponseForAttempt(assistantResponseBuffer);
                const now = Date.now();
                const currentUpsellState = guestUpsellStateRef.current;
                const isExpired =
                  currentUpsellState.windowStartedAt <= 0
                  || now - currentUpsellState.windowStartedAt >= GUEST_UPSELL_WINDOW_MS;
                const baseState = isExpired
                  ? { windowStartedAt: now, responseCount: 0, shown: false }
                  : currentUpsellState;
                const nextUpsellState = {
                  ...baseState,
                  responseCount: baseState.responseCount + 1,
                };
                const shouldShowUpsellNow =
                  !nextUpsellState.shown && nextUpsellState.responseCount >= GUEST_UPSELL_AFTER_RESPONSES;
                if (shouldShowUpsellNow) {
                  nextUpsellState.shown = true;
                  setGuestUpsellVisible(true);
                }
                guestUpsellStateRef.current = nextUpsellState;
                void AsyncStorage.setItem(GUEST_UPSELL_STATE_KEY, JSON.stringify(nextUpsellState));

                const nextGuestMessageCount = Math.min(
                  GUEST_MESSAGE_LIMIT,
                  guestMessageCountRef.current + 1,
                );
                guestMessageCountRef.current = nextGuestMessageCount;
                setGuestMessageCount(nextGuestMessageCount);
                void AsyncStorage.setItem(GUEST_MESSAGE_COUNT_KEY, String(nextGuestMessageCount));
                if (
                  nextGuestMessageCount === 16
                  || nextGuestMessageCount === 20
                  || nextGuestMessageCount === 23
                  || nextGuestMessageCount === GUEST_MESSAGE_LIMIT
                ) {
                  setGuestUpsellVisible(false);
                  setGuestAllowanceNotice(nextGuestMessageCount as 16 | 20 | 23 | 25);
                }
              }
              if (event.type === 'error') {
                throw new Error(event.message || 'Guest chat stream failed.');
              }
            },
            createIdempotencyKey(conversationId),
            language,
          );
          didMutateChats = true;
          return;
        }

        const extractedVideoPrompt = extractVideoPrompt(trimmed);
        const extractedImagePrompt = extractImagePrompt(trimmed);
        const hasAnyAttachment = attachmentsForSend.length > 0;
        const shouldUseBackendResponseTypeForMediaIntent = screenMode === 'chat'
          && isAuthenticated
          && !hasAnyAttachment;
        const inferredImagePrompt = shouldUseBackendResponseTypeForMediaIntent
          ? (detectedExpectedResponseType === 'image' ? trimmed : null)
          : (!extractedImagePrompt && isLikelyImageGenerationIntent(trimmed)
            ? trimmed
            : null);
        // Dedicated media screens always go through the chat stream (web
        // parity), never the old direct image/video routes below.
        const isDedicatedScreenSend = screenMode !== 'chat';
        const effectiveImagePrompt = isDedicatedScreenSend || hasAnyAttachment
          ? null
          : (
            shouldUseBackendResponseTypeForMediaIntent
              ? inferredImagePrompt
              : (extractedImagePrompt ?? inferredImagePrompt)
          );
        const effectiveChartPrompt = shouldUseBackendResponseTypeForMediaIntent
          && detectedExpectedResponseType === 'chart'
          ? trimmed
          : null;
        const imageAttachmentForVideoIntent = attachmentsForSend.find((asset) =>
          (asset.mimeType ?? '').toLowerCase().startsWith('image/'),
        );
        const inferredVideoFromImagePrompt = shouldUseBackendResponseTypeForMediaIntent
          ? (detectedExpectedResponseType === 'video' ? trimmed : null)
          : (
            !extractedVideoPrompt && imageAttachmentForVideoIntent && isLikelyVideoGenerationIntent(trimmed)
              ? trimmed
              : null
          );
        const effectiveVideoPrompt = isDedicatedScreenSend || hasAnyAttachment
          ? null
          : (
            shouldUseBackendResponseTypeForMediaIntent
              ? inferredVideoFromImagePrompt
              : (extractedVideoPrompt ?? inferredVideoFromImagePrompt)
          );
        const referencedKind = composerMediaReference?.kind;
        const isReferencedMediaQuestion = Boolean(composerMediaReference) && (
          shouldUseBackendResponseTypeForMediaIntent
            ? detectedExpectedResponseType === 'text' || detectedExpectedResponseType === 'search'
            : isLikelyReferencedMediaQuestionPrompt(trimmed)
        );
        const shouldUseVideoFollowUp =
          !isDedicatedScreenSend
          && !shouldUseBackendResponseTypeForMediaIntent
          && referencedKind === 'video'
          && !isReferencedMediaQuestion
          && isLikelyVideoFollowUpPrompt(trimmed);
        const shouldUseImageFollowUp =
          !isDedicatedScreenSend
          && !shouldUseBackendResponseTypeForMediaIntent
          && referencedKind === 'image'
          && !isReferencedMediaQuestion
          && isLikelyImageFollowUpPrompt(trimmed);
        const shouldUseReferencedNonStreamChat =
          !isDedicatedScreenSend
          && Boolean(composerMediaReference)
          && (
            isReferencedMediaQuestion
            || (
              !shouldUseVideoFollowUp
              && !shouldUseImageFollowUp
              && !effectiveVideoPrompt
              && !effectiveImagePrompt
              && !effectiveChartPrompt
            )
          );

        if (USE_LEGACY_DEDICATED_MEDIA_CALLS && screenMode === 'image-to-video') {
          const imageAttachmentForVideo = imageAttachmentForVideoIntent;
          if (!imageAttachmentForVideo) {
            throw new Error('Please upload an image to continue.');
          }

          requestKind = 'video';
          if (videoGenerationInFlightRef.current || videoFromImageInFlightRef.current) {
            const inProgressMessage = t('chat.videoGenerationInProgress');
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      content: inProgressMessage,
                      isVideoGenerating: false,
                    }
                  : item,
              ),
            );
            showTransientNotice(inProgressMessage, 5000);
            return;
          }

          const now = Date.now();
          const elapsedSinceLastStart = now - lastVideoGenerationStartAtRef.current;
          if (elapsedSinceLastStart < 8000) {
            const waitSeconds = Math.max(1, Math.ceil((8000 - elapsedSinceLastStart) / 1000));
            const cooldownMessage = t('chat.videoGenerationCooldown', { seconds: `${waitSeconds}` });
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      content: cooldownMessage,
                      isVideoGenerating: false,
                    }
                  : item,
              ),
            );
            showTransientNotice(cooldownMessage, 5000);
            return;
          }

          videoGenerationInFlightRef.current = true;
          videoFromImageInFlightRef.current = true;
          requestedVideoPrompt = trimmed;
          requestedVideoStartedAt = Date.now();
          lastVideoGenerationStartAtRef.current = now;
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: effectivePrompt,
                    videoPrompt: effectivePrompt,
                    isVideoGenerating: true,
                  }
                : item,
            ),
          );

          lastEndpoint = `${API_BASE_URL}/media/video/image-to-video`;
          logSendPayload({
            endpoint: lastEndpoint,
            mode: 'auth-direct-media-image-to-video',
            prompt: effectivePrompt,
            duration: 5,
            aspectRatio: '16:9',
            attachments: [
              {
                id: imageAttachmentForVideo.id,
                label: imageAttachmentForVideo.label,
                fileName: imageAttachmentForVideo.fileName,
                mimeType: imageAttachmentForVideo.mimeType,
                uri: imageAttachmentForVideo.uri,
              },
            ],
          });

          const generatedVideo = await generateVideoFromImageDirect({
            prompt: effectivePrompt,
            durationSeconds: 5,
            aspectRatio: '16:9',
            image: {
              uri: imageAttachmentForVideo.uri,
              fileName: imageAttachmentForVideo.fileName ?? imageAttachmentForVideo.label,
              mimeType: imageAttachmentForVideo.mimeType ?? 'image/jpeg',
            },
          });
          if (generatedVideo.conversationId) {
            setAuthConversationId(generatedVideo.conversationId);
          }

          let resolvedVideoUrl = resolveBackendAssetUrl(generatedVideo.videoUrl);
          let resolvedVideoPrompt = effectivePrompt;
          let resolvedVideoId: string | undefined;

          if (!resolvedVideoUrl && generatedVideo.jobId) {
            const resolvedVideo = await waitForVideoGeneration(generatedVideo.jobId);
            resolvedVideoUrl = resolvedVideo.videoUrl;
            resolvedVideoPrompt = resolvedVideo.videoPrompt || effectivePrompt;
            resolvedVideoId = resolvedVideo.videoId;
          }

          if (!resolvedVideoUrl) {
            throw new Error('Could not generate video right now.');
          }

          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: resolvedVideoPrompt,
                    videoId: resolvedVideoId,
                    videoPrompt: resolvedVideoPrompt,
                    videoUrl: resolvedVideoUrl,
                    isVideoGenerating: false,
                  }
                : item,
            ),
          );
          try {
            await hydrateDedicatedMediaConversation('image-to-video', {
              attempts: 8,
              delayMs: 900,
              preserveOnUnavailable: true,
            });
          } catch {
            // Keep the optimistic local media card if dedicated history is not yet reachable.
          }
          logResponsePayloadForAttempt({
            response: {
              videoUrl: generatedVideo.videoUrl ?? resolvedVideoUrl,
              jobId: generatedVideo.jobId ?? null,
              generationTime: generatedVideo.generationTime ?? null,
              duration: generatedVideo.duration ?? 5,
            },
          });
          hapticSuccess();
          videoGenerationInFlightRef.current = false;
          videoFromImageInFlightRef.current = false;
          didMutateChats = true;
          return;
        }

        if (USE_LEGACY_DEDICATED_MEDIA_CALLS && screenMode === 'edit-image') {
          const imageAttachmentForEdit = attachmentsForSend.find((asset) =>
            (asset.mimeType ?? '').toLowerCase().startsWith('image/'),
          );
          if (!imageAttachmentForEdit) {
            throw new Error('Please upload an image to continue.');
          }

          requestKind = 'image';
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: effectivePrompt,
                    imagePrompt: effectivePrompt,
                    isImageGenerating: true,
                  }
                : item,
            ),
          );

          lastEndpoint = `${API_BASE_URL}/media/image/edit`;
          logSendPayload({
            endpoint: lastEndpoint,
            mode: 'auth-direct-media-image-edit',
            prompt: effectivePrompt,
            attachments: [
              {
                id: imageAttachmentForEdit.id,
                label: imageAttachmentForEdit.label,
                fileName: imageAttachmentForEdit.fileName,
                mimeType: imageAttachmentForEdit.mimeType,
                uri: imageAttachmentForEdit.uri,
              },
            ],
          });

          const editedImage = await editImage({
            prompt: effectivePrompt,
            image: {
              uri: imageAttachmentForEdit.uri,
              fileName: imageAttachmentForEdit.fileName ?? imageAttachmentForEdit.label,
              mimeType: imageAttachmentForEdit.mimeType ?? 'image/jpeg',
            },
          });
          if (editedImage.conversationId) {
            setAuthConversationId(editedImage.conversationId);
          }
          const resolvedImageUrl = resolveBackendAssetUrl(editedImage.imageUrl);
          if (!resolvedImageUrl) {
            throw new Error('Could not edit image right now.');
          }

          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: effectivePrompt,
                    imagePrompt: effectivePrompt,
                    imageUrl: resolvedImageUrl,
                    isImageGenerating: false,
                  }
                : item,
            ),
          );
          try {
            await hydrateDedicatedMediaConversation('edit-image', {
              attempts: 5,
              delayMs: 450,
              preserveOnUnavailable: true,
            });
          } catch {
            // Keep the optimistic local media card if dedicated history is not yet reachable.
          }
          logResponsePayloadForAttempt({
            response: {
              imageUrl: editedImage.imageUrl,
              generationTime: editedImage.generationTime ?? null,
            },
          });
          hapticSuccess();
          didMutateChats = true;
          return;
        }

        let conversationId = authConversationId;
        if (!conversationId) {
          lastEndpoint = `${API_BASE_URL}/chat`;
          const created = await createAuthenticatedConversation(getPromptTitle(trimmed, t('drawer.newChat')));
          conversationId = created.conversationId;
          setAuthConversationId(conversationId);
          router.setParams({ conversationId, newChat: undefined });
          didMutateChats = true;
        }
        if (conversationId !== params.conversationId) {
          router.setParams({ conversationId, newChat: undefined });
        }
        activeAuthConversationId = conversationId;

        if (shouldUseVideoFollowUp || shouldUseImageFollowUp || shouldUseReferencedNonStreamChat) {
          requestKind = shouldUseVideoFollowUp ? 'video' : shouldUseImageFollowUp ? 'image' : 'chat';
          usedVideoReferenceFollowUp = shouldUseVideoFollowUp;
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: shouldUseReferencedNonStreamChat ? '' : trimmed,
                    videoPrompt: shouldUseVideoFollowUp ? trimmed : item.videoPrompt,
                    imagePrompt: shouldUseImageFollowUp ? trimmed : item.imagePrompt,
                    isVideoGenerating: shouldUseVideoFollowUp,
                    isImageGenerating: shouldUseImageFollowUp,
                  }
                : item,
            ),
          );
          lastEndpoint = `${API_BASE_URL}/chat/${conversationId}/messages`;
          logSendPayload({
            endpoint: lastEndpoint,
            mode: shouldUseVideoFollowUp
              ? 'auth-non-stream-followup-video'
              : shouldUseImageFollowUp
                ? 'auth-non-stream-followup-image'
                : 'auth-non-stream-referenced-chat',
            conversationId,
            message: trimmed,
            reference: composerMediaReference ?? null,
            model: activeModel,
            preClassifiedAs: preClassifiedChatType ?? null,
          });
          const nonStreamResult = await sendAuthenticatedMessageNonStream(
            conversationId,
            trimmed,
            activeModel,
            composerMediaReference ?? undefined,
            attachmentsForSend,
            preClassifiedChatType,
          );
          const detail = await getAuthenticatedConversation(conversationId, { force: true });
          applyAuthConversationDetail(detail);
          const latestAssistant = [...detail.messages]
            .reverse()
            .find((item) => (
              item.role === 'assistant'
              && item.content.trim().length > 0
              && new Date(item.createdAt).getTime() >= responseRecoveryStartAt
            ));
          if (latestAssistant?.content) {
            logParsedResponseForAttempt(latestAssistant.content);
          } else if (nonStreamResult.data?.recoveredText) {
            logParsedResponseForAttempt(nonStreamResult.data.recoveredText);
          }
          hapticSuccess();
          didMutateChats = true;
          return;
        }

        if (effectiveVideoPrompt) {
          const fullVideoPrompt = trimmed;
          const imageAttachmentForVideo = imageAttachmentForVideoIntent;
          requestKind = 'video';
          if (videoGenerationInFlightRef.current) {
            const inProgressMessage = t('chat.videoGenerationInProgress');
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      content: inProgressMessage,
                      isVideoGenerating: false,
                    }
                  : item,
              ),
            );
            showTransientNotice(inProgressMessage, 5000);
            return;
          }
          if (imageAttachmentForVideo && videoFromImageInFlightRef.current) {
            const inProgressMessage = t('chat.videoGenerationInProgress');
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      content: inProgressMessage,
                      isVideoGenerating: false,
                    }
                  : item,
              ),
            );
            showTransientNotice(inProgressMessage, 5000);
            return;
          }
          const now = Date.now();
          const elapsedSinceLastStart = now - lastVideoGenerationStartAtRef.current;
          if (elapsedSinceLastStart < 8000) {
            const waitSeconds = Math.max(1, Math.ceil((8000 - elapsedSinceLastStart) / 1000));
            const cooldownMessage = t('chat.videoGenerationCooldown', { seconds: `${waitSeconds}` });
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      content: cooldownMessage,
                      isVideoGenerating: false,
                    }
                  : item,
              ),
            );
            showTransientNotice(cooldownMessage, 5000);
            return;
          }
          videoGenerationInFlightRef.current = true;
          if (imageAttachmentForVideo) {
            videoFromImageInFlightRef.current = true;
          }
          requestedVideoPrompt = fullVideoPrompt;
          requestedVideoConversationId = conversationId;
          requestedVideoStartedAt = Date.now();
          lastVideoGenerationStartAtRef.current = now;
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: fullVideoPrompt,
                    videoPrompt: fullVideoPrompt,
                    isVideoGenerating: true,
                  }
                : item,
            ),
          );
          lastEndpoint = imageAttachmentForVideo
            ? `${API_BASE_URL}/videos/from-image`
            : `${API_BASE_URL}/videos/generate`;
          logSendPayload({
            endpoint: lastEndpoint,
            mode: imageAttachmentForVideo ? 'auth-direct-video-from-image' : 'auth-direct-video-generate',
            conversationId,
            prompt: fullVideoPrompt,
            aspectRatio: '16:9',
            model: activeModel,
            reference: composerMediaReference ?? null,
            attachments: imageAttachmentForVideo
              ? [
                  {
                    id: imageAttachmentForVideo.id,
                    label: imageAttachmentForVideo.label,
                    fileName: imageAttachmentForVideo.fileName,
                    mimeType: imageAttachmentForVideo.mimeType,
                    uri: imageAttachmentForVideo.uri,
                  },
                ]
              : [],
          });
          const job = imageAttachmentForVideo
            ? await startVideoGenerationFromImage({
                conversationId,
                prompt: fullVideoPrompt,
                aspectRatio: '16:9',
                image: {
                  uri: imageAttachmentForVideo.uri,
                  fileName: imageAttachmentForVideo.fileName ?? imageAttachmentForVideo.label,
                  mimeType: imageAttachmentForVideo.mimeType ?? 'image/jpeg',
                },
              })
            : await startVideoGeneration({
                conversationId,
                prompt: fullVideoPrompt,
                aspectRatio: '16:9',
              });

          const resolvedVideo = await waitForVideoGeneration(job.jobId);

          try {
            const detail = await getAuthenticatedConversation(conversationId, { force: true });
            applyAuthConversationDetail(detail);
          } catch {
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      content: resolvedVideo.videoPrompt || fullVideoPrompt,
                      videoId: resolvedVideo.videoId,
                      videoPrompt: resolvedVideo.videoPrompt || fullVideoPrompt,
                      videoUrl: resolvedVideo.videoUrl ?? undefined,
                      isVideoGenerating: false,
                    }
                  : item,
              ),
            );
          }
          hapticSuccess();
          videoGenerationInFlightRef.current = false;
          videoFromImageInFlightRef.current = false;
          didMutateChats = true;
          return;
        }

        if (effectiveChartPrompt) {
          requestKind = 'image';
          setMessages((prev) => prev.map((item) => item.id === assistantId
            ? { ...item, content: effectiveChartPrompt, imagePrompt: effectiveChartPrompt, isImageGenerating: true }
            : item));
          lastEndpoint = `${API_BASE_URL}/charts/generate`;
          logSendPayload({
            endpoint: lastEndpoint,
            mode: 'auth-direct-chart-generate',
            conversationId,
            prompt: effectiveChartPrompt,
            model: activeModel,
          });
          const generated = await generateChart({ conversationId, prompt: effectiveChartPrompt });
          const resolvedImageUrl = resolveBackendAssetUrl(generated.imageUrl);
          if (!resolvedImageUrl) throw new Error('Chart generation failed. Please try rephrasing your request.');
          logResponsePayloadForAttempt({
            responseType: 'chart',
            id: generated.id,
            imageUrl: resolvedImageUrl,
            generationTime: generated.generationTime ?? null,
            model: generated.model ?? null,
          });
          try {
            const detail = await getAuthenticatedConversation(conversationId, { force: true });
            applyAuthConversationDetail(detail);
          } catch {
            setMessages((prev) => prev.map((item) => item.id === assistantId
              ? {
                  ...item,
                  content: generated.prompt || effectiveChartPrompt,
                  imageId: generated.id,
                  imagePrompt: generated.prompt || effectiveChartPrompt,
                  imageUrl: resolvedImageUrl,
                  isImageGenerating: false,
                }
              : item));
          }
          hapticSuccess();
          didMutateChats = true;
          return;
        }

        if (effectiveImagePrompt) {
          const fullImagePrompt = trimmed;
          requestKind = 'image';
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content: fullImagePrompt,
                    imagePrompt: fullImagePrompt,
                    isImageGenerating: true,
                  }
                : item,
            ),
          );
          lastEndpoint = `${API_BASE_URL}/images/generate`;
          logSendPayload({
            endpoint: lastEndpoint,
            mode: 'auth-direct-image-generate',
            conversationId,
            prompt: fullImagePrompt,
            style: 'cinematic',
            model: activeModel,
            reference: composerMediaReference ?? null,
          });
          const generated = await generateImage({
            conversationId,
            prompt: fullImagePrompt,
            style: 'cinematic',
          });
          const resolvedImageUrl = resolveBackendAssetUrl(generated.imageUrl);
          if (!resolvedImageUrl) {
            throw new Error('Could not generate image right now.');
          }
          try {
            const detail = await getAuthenticatedConversation(conversationId, { force: true });
            applyAuthConversationDetail(detail);
          } catch {
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      content: generated.prompt || fullImagePrompt,
                      imageId: generated.id,
                      imagePrompt: generated.prompt || fullImagePrompt,
                      imageUrl: resolvedImageUrl,
                      isImageGenerating: false,
                    }
                  : item,
              ),
            );
          }
          hapticSuccess();
          didMutateChats = true;
          return;
        }

        lastEndpoint = `${API_BASE_URL}/chat/${conversationId}/messages`;
        const useMobileNonStreamWorkaround = false;
        const authSendMode =
          Platform.OS !== 'web'
            ? (useMobileNonStreamWorkaround ? 'auth-non-stream-chat-mobile' : 'auth-stream-chat-mobile')
            : 'auth-stream-chat';
        const mobileAuthModelForTextChat: 'ultra' | 'smart' | 'swift' = activeModel;
        logSendPayload({
          endpoint: lastEndpoint,
          mode: authSendMode,
          conversationId,
          message: trimmed,
          language,
          model: mobileAuthModelForTextChat,
          reference: composerMediaReference ?? null,
          preClassifiedAs: preClassifiedChatType ?? null,
          attachments: attachmentsForSend.map((asset) => ({
            id: asset.id,
            label: asset.label,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            uri: asset.uri,
          })),
        });
        const cancelledPrompts = cancelledPromptsRef.current.get(conversationId) ?? [];
        cancelledPromptsRef.current.delete(conversationId);
        const messageForServer = cancelledPrompts.length
          ? `${cancelledPrompts.map((prompt) => `${buildCancellationNote(prompt)}\n`).join('')}\n${trimmed}`
          : trimmed;
        let toolCalls: UiMessageToolCall[] = [];
        let reasoningText = '';
        let reasoningStartedAt = 0;
        let liveArtifacts: UiArtifactItem[] = [];
        let artifactCounter = 0;
        await sendAuthenticatedMessageStream(
          conversationId,
          messageForServer,
          attachmentsForSend,
          (event) => {
              if (runHandle.detached || runHandle.stoppedByUser) return;
              if (event.type === 'meta') {
                setStreamingModelLabel(
                  resolveModelBadgeLabel(event.model, activeModel),
                );
                if (event.messageId) {
                  const previousAssistantId = activeAssistantId;
                  activeAssistantId = event.messageId;
                  pendingAssistantIdRef.current = event.messageId;
                  setMessages((prev) =>
                    prev.map((message) =>
                      message.id === previousAssistantId ? { ...message, id: event.messageId! } : message,
                    ),
                  );
                }
                return;
              }

              if (event.type === 'delta') {
                if (!assistantFirstDeltaRef.current) {
                  assistantFirstDeltaRef.current = true;
                  hapticSelection();
                }
                assistantResponseBuffer += event.content;
                if (!suppressStreamingTextForArtifact) {
                  queueAssistantDelta(activeAssistantId, event.content);
                }
                return;
              }

              if (event.type === 'reasoning') {
                if (!reasoningStartedAt) reasoningStartedAt = Date.now();
                reasoningText += event.text;
                const capturedReasoning = reasoningText;
                const capturedStartedAt = reasoningStartedAt;
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === activeAssistantId
                      ? { ...message, reasoning: capturedReasoning, reasoningStartedAt: capturedStartedAt }
                      : message,
                  ),
                );
                return;
              }

              if (event.type === 'reasoning_step') {
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === activeAssistantId ? { ...message, currentStep: event.text } : message,
                  ),
                );
                return;
              }

              if (event.type === 'reasoning_summary') {
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === activeAssistantId ? { ...message, reasoningSummary: event.text } : message,
                  ),
                );
                return;
              }

              if (event.type === 'products') {
                if (event.items?.length) {
                  setMessages((prev) =>
                    prev.map((message) =>
                      message.id === activeAssistantId
                        ? { ...message, products: { query: event.query ?? '', items: event.items! } }
                        : message,
                    ),
                  );
                }
                return;
              }

              if (event.type === 'widget') {
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === activeAssistantId
                      ? { ...message, widget: event.spec, widgetDone: false }
                      : message,
                  ),
                );
                return;
              }

              if (event.type === 'tool_start') {
                runHandle.lastTool = event.tool;
                toolCalls = [...toolCalls, { tool: event.tool, label: event.label, running: true }];
                const artifactKind = event.tool === 'generate_image' || event.tool === 'edit_image'
                  ? 'image' as const
                  : event.tool === 'generate_video' || event.tool === 'image_to_video'
                    ? 'video' as const
                    : event.tool === 'generate_document'
                      ? 'document' as const
                      : null;
                if (artifactKind) {
                  artifactCounter += 1;
                  const rawSourceUrl = event.tool === 'edit_image' && typeof event.args === 'object' && event.args
                    ? String((event.args as Record<string, unknown>).image_url ?? '').trim()
                    : '';
                  liveArtifacts = [
                    ...liveArtifacts,
                    {
                      id: `${activeAssistantId}-artifact-${artifactCounter}`,
                      kind: artifactKind,
                      sourceUrl: rawSourceUrl ? resolveBackendAssetUrl(rawSourceUrl) ?? rawSourceUrl : undefined,
                      messageId: activeAssistantId,
                      createdAt: Date.now(),
                      generating: true,
                      titleHint: artifactKind === 'document' ? documentTitleFromArgs(event.args) : undefined,
                      formatHint: artifactKind === 'document' ? documentFormatFromArgs(event.args) : undefined,
                    },
                  ];
                }
                const capturedTools = toolCalls;
                const capturedArtifacts = liveArtifacts;
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === activeAssistantId
                      ? { ...message, tools: capturedTools, artifacts: capturedArtifacts.length ? capturedArtifacts : message.artifacts }
                      : message,
                  ),
                );
                return;
              }

              if (event.type === 'tool_end') {
                const nextTools = [...toolCalls];
                for (let i = nextTools.length - 1; i >= 0; i -= 1) {
                  if (nextTools[i].tool === event.tool && nextTools[i].running) {
                    nextTools[i] = { ...nextTools[i], ok: event.ok, ms: event.ms, running: false };
                    break;
                  }
                }
                toolCalls = nextTools;
                if (!event.ok) {
                  const nextArtifacts = [...liveArtifacts];
                  for (let i = nextArtifacts.length - 1; i >= 0; i -= 1) {
                    if (nextArtifacts[i].generating) {
                      nextArtifacts[i] = { ...nextArtifacts[i], generating: false, failed: true };
                      break;
                    }
                  }
                  liveArtifacts = nextArtifacts;
                }
                const capturedTools = toolCalls;
                const capturedArtifacts = liveArtifacts;
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === activeAssistantId
                      ? { ...message, tools: capturedTools, artifacts: capturedArtifacts.length ? capturedArtifacts : message.artifacts }
                      : message,
                  ),
                );
                return;
              }

              // A tool call hit a plan credit or rate limit mid-turn (API_INTEGRATION_GUIDE.md
              // §2, §3). Kept on the message rather than shown as a one-off toast, since the rest
              // of the turn's text/tools are still real and worth keeping visible alongside it.
              if (event.type === 'upgrade_prompt') {
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === activeAssistantId
                      ? { ...message, upgradePrompt: { reason: event.reason, feature: event.feature } }
                      : message,
                  ),
                );
                return;
              }

              // generate_website started a live build. Backend confirmed (2026-09-24) this is
              // reachable from mobile chat -- no platform gating -- but there is no in-app viewer
              // for the build stream yet, so show a notice instead of dropping it silently.
              if (event.type === 'sandbox_session') {
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === activeAssistantId ? { ...message, sandboxSessionId: event.sessionId } : message,
                  ),
                );
                return;
              }

              if (event.type === 'media') {
                const nextArtifacts = [...liveArtifacts];
                const pendingIndex = nextArtifacts.findIndex((artifact) => artifact.generating);
                if (pendingIndex >= 0) {
                  const resolvedUrl = resolveBackendAssetUrl(event.url) ?? event.url;
                  const artifactKind = nextArtifacts[pendingIndex].kind;
                  nextArtifacts[pendingIndex] = {
                    ...nextArtifacts[pendingIndex],
                    url: resolvedUrl,
                    name: event.name,
                    mimeType: event.mimeType,
                    thumbnailUrl: resolveBackendAssetUrl(event.thumbnailUrl) ?? undefined,
                    generating: false,
                  };
                  liveArtifacts = nextArtifacts;
                  const capturedArtifacts = liveArtifacts;
                  // Real fix (2026-09-13, Issue 5): also populate imageUrl/videoUrl
                  // on the message itself -- the tool-calling artifacts pipeline only
                  // ever wrote to message.artifacts, but the message bubble's inline
                  // download/preview branches (isImageMessage/isVideoMessage) check
                  // message.imageUrl/videoUrl, not artifacts. Without this, a freshly
                  // generated image/video from this pipeline was invisible inline and
                  // only reachable via the separate Artifacts panel.
                  setMessages((prev) =>
                    prev.map((message) =>
                      message.id === activeAssistantId
                        ? {
                            ...message,
                            artifacts: capturedArtifacts,
                            imageUrl: artifactKind === 'image' ? resolvedUrl : message.imageUrl,
                            videoUrl: artifactKind === 'video' ? resolvedUrl : message.videoUrl,
                          }
                        : message,
                    ),
                  );
                }
                return;
              }

              if (event.type === 'done') {
                if (!suppressStreamingTextForArtifact) {
                  flushPendingAssistantDelta();
                }
                hapticSuccess();
                setStreamingModelLabel(null);
                logParsedResponseForAttempt(assistantResponseBuffer);
                const handoffFromAssistantText = getScreenHandoffConfigFromAssistantText(assistantResponseBuffer);
                const streamedAttachments = event.attachments ?? [];
                if (event.messageId) {
                  const previousAssistantId = activeAssistantId;
                  activeAssistantId = event.messageId;
                  setMessages((prev) =>
                    prev.map((message) =>
                      message.id === previousAssistantId
                        ? {
                          ...message,
                          id: event.messageId!,
                          content: handoffFromAssistantText ? '' : message.content,
                          tokens: event.tokens,
                          attachments: streamedAttachments.length ? streamedAttachments : message.attachments,
                          screenHandoff: handoffFromAssistantText ?? message.screenHandoff,
                        }
                        : message,
                    ),
                  );
                  void syncAssistantMessageAfterStream(
                    conversationId,
                    event.messageId,
                    previousAssistantId,
                    streamedAttachments,
                  );
                  return;
                }
                if (streamedAttachments.length) {
                  setMessages((prev) =>
                    prev.map((message) =>
                      message.id === activeAssistantId
                        ? {
                            ...message,
                            content: handoffFromAssistantText ? '' : message.content,
                            attachments: streamedAttachments,
                            screenHandoff: handoffFromAssistantText ?? message.screenHandoff,
                          }
                        : message,
                    ),
                  );
                } else if (handoffFromAssistantText) {
                  setMessages((prev) =>
                    prev.map((message) =>
                      message.id === activeAssistantId
                        ? {
                            ...message,
                            content: '',
                            screenHandoff: handoffFromAssistantText,
                          }
                        : message,
                    ),
                  );
                }
                void syncAssistantMessageAfterStream(
                  conversationId,
                  activeAssistantId,
                  assistantId,
                  streamedAttachments,
                );
              }
            },
          language,
          activeModel,
          (debugEvent) => {
            lastIdempotencyKey = debugEvent.idempotencyKey;
          },
          preClassifiedChatType,
          attachmentsForSend.length
            ? (percent) => {
                setUploadProgressPercent(percent < 100 ? percent : null);
              }
            : undefined,
          composerMediaReference ?? undefined,
          runHandle.controller.signal,
        );
        // Quick replies (web parity): find the saved assistant message's real
        // id, poll its quick-replies, and attach them to the reply on screen.
        {
          const streamedAssistantId = activeAssistantId;
          void (async () => {
            try {
              const detail = await getAuthenticatedConversation(conversationId, { force: true });
              const savedAssistant = [...detail.messages].reverse().find((item) => item.role === 'assistant');
              if (!savedAssistant?.id || !/^[a-f0-9]{24}$/i.test(savedAssistant.id)) return;
              const replies = await pollQuickReplies(conversationId, savedAssistant.id);
              if (!replies.length) return;
              setMessages((prev) =>
                prev.map((item) =>
                  item.id === streamedAssistantId || item.id === savedAssistant.id
                    ? { ...item, quickReplies: replies.slice(0, 4) }
                    : item,
                ),
              );
            } catch {
              // Best effort: no chips on failure.
            }
          })();
        }
        const streamedText = assistantResponseBuffer.trim();
        if (streamedText.length > 0) {
          // Do not let an eventually-consistent backend snapshot overwrite already rendered text.
          // Reconcile in the background only when server has a non-empty assistant response.
          void (async () => {
            for (let attempt = 1; attempt <= 8; attempt += 1) {
              try {
                const detail = await getAuthenticatedConversation(conversationId, { force: true });
                const recoveredAssistant = [...detail.messages]
                  .reverse()
                  .find((item) => (
                    item.role === 'assistant'
                    && item.content.trim().length > 0
                    && new Date(item.createdAt).getTime() >= responseRecoveryStartAt
                  ));
                if (recoveredAssistant) {
                  // A queued/next turn may already be running. The server snapshot
                  // doesn't contain its local bubbles yet, so applying it now would
                  // wipe them and leave only the status label on screen.
                  if (activeRunRef.current && activeRunRef.current !== runHandle) return;
                  applyAuthConversationDetail(detail);
                  break;
                }
              } catch {
                // keep trying
              }
              if (activeRunRef.current && activeRunRef.current !== runHandle) return;
              await new Promise((resolve) => setTimeout(resolve, 220 * attempt));
            }
          })();
        } else {
          try {
            await reconcileAuthConversationAfterSend(conversationId);
          } catch {
            throw new Error('Could not sync conversation after response.');
          }
        }
        didMutateChats = true;
      } catch (error) {
        const assistantMessageIdForRecovery = activeAssistantId || assistantId;
        const message = error instanceof Error ? error.message : t('chat.sendFailed');
        const friendlyMessage = getFriendlyErrorMessage(error, requestKind);
        const code = ((error as { code?: string } | undefined)?.code ?? '').toUpperCase();
        if (code === 'AUTH_STREAM_ABORTED' || runHandle.detached || runHandle.stoppedByUser) {
          // The user left this chat: its UI state was already reset, and the
          // server keeps the turn. Nothing to show here.
          if (runHandle.detached) return;
          // The user pressed Stop: keep what streamed so far, drop the spinners
          // and mark the turn so it can be retried.
          const stoppedIds = [activeAssistantId, assistantId].filter(Boolean);
          rememberStoppedAssistantIds(stoppedIds);
          const stoppedConversationId = activeAuthConversationId ?? currentConversationIdRef.current;
          if (stoppedConversationId && trimmed) {
            cancelledPromptsRef.current.set(stoppedConversationId, [
              ...(cancelledPromptsRef.current.get(stoppedConversationId) ?? []),
              trimmed,
            ]);
            const stoppedTool = runHandle.lastTool;
            rememberStoppedTurn({
              conversationId: stoppedConversationId,
              text: trimmed,
              occurrence: messages.filter((item) => item.role === 'user' && item.content.trim() === trimmed).length,
              ...(stoppedTool
                ? {
                    tool: stoppedTool,
                    // Earlier assistant messages that used this tool: still on screen,
                    // plus earlier stopped turns whose result is hidden by the ledger.
                    toolOccurrence:
                      messages.filter((item) => item.role === 'assistant' && item.tools?.some((tool) => tool.tool === stoppedTool)).length
                      + stoppedTurnsRef.current.filter(
                        (turn) => turn.conversationId === stoppedConversationId && turn.tool === stoppedTool,
                      ).length,
                  }
                : {}),
            });
          }
          setMessages((prev) =>
            prev.map((item) =>
              stoppedIds.includes(item.id)
                ? {
                    ...item,
                    isAnalyzing: false,
                    isImageGenerating: false,
                    isVideoGenerating: false,
                    isArtifactGenerating: false,
                    tools: item.tools?.filter((tool) => !tool.running),
                    artifacts: item.artifacts?.filter((artifact) => !artifact.generating),
                    stopped: true,
                  }
                : item,
            ),
          );
          return;
        }
        const status = (error as { status?: number } | undefined)?.status;
        const rawErrorMessage = (error as { message?: string } | undefined)?.message ?? '';
        const normalizedErrorMessage = rawErrorMessage.toLowerCase();
        const isLimitError = isLimitOrUpgradeError(error);
        const isRateLimited = isRateLimitedError(error);
        const limitRequestKind = getLimitKind(error, requestKind);
        const limitResetHours = getLimitResetHours(error);
        const limitVisibleMessage = getLimitNoticeMessage(limitRequestKind)
          + (limitResetHours !== null ? ` Your allowance resets in ${formatLimitResetDuration(limitResetHours)}.` : '');
        const isAuthStreamTransportError = code.startsWith('AUTH_STREAM_');
        const isIdempotencyInProgress =
          code === 'IDEMPOTENCY_IN_PROGRESS'
          || normalizedErrorMessage.includes('idempotency key is already in use')
          || normalizedErrorMessage.includes('idempotency_in_progress');
        const isLikelyTimeoutOrDisconnect =
          normalizedErrorMessage.includes('timeout')
          || normalizedErrorMessage.includes('network request failed')
          || normalizedErrorMessage.includes('socket hang up')
          || normalizedErrorMessage.includes('aborted');
        const delayedVideoError =
          requestKind === 'video'
          && (
            code === 'VIDEO_GENERATION_PENDING'
            || code === 'VIDEO_GENERATION_TIMEOUT'
            || message.toLowerCase().includes('too many video generation requests')
            || message.toLowerCase().includes('too many requests')
          );
        const isAuthStreamActiveServerError =
          isAuthenticated
          && requestKind === 'chat'
          && code === 'AUTH_STREAM_ACTIVE_SERVER_ERROR';
        const idempotencyVisibleMessage = 'Your previous request is still processing. Please wait a moment and try again.';
        const fastFailVisibleMessage = isIdempotencyInProgress
          ? idempotencyVisibleMessage
          : friendlyMessage;
        const bufferedAssistantText = assistantResponseBuffer.trim();
        if (isAuthenticated && attachmentsForSend.length) {
          setAttachedAssets(attachmentsForSend);
        }
        if (requestKind === 'video') {
          videoGenerationInFlightRef.current = false;
          videoFromImageInFlightRef.current = false;
        }
        if (
          requestKind === 'chat'
          && bufferedAssistantText.length > 0
          && isAuthStreamActiveServerError
        ) {
          setMessages((prev) => {
            let matched = false;
            const next = prev.map((item) => {
              if (item.id !== assistantMessageIdForRecovery) return item;
              matched = true;
              return {
                ...item,
                isImageGenerating: false,
                isVideoGenerating: false,
                isArtifactGenerating: false,
                content: bufferedAssistantText,
              };
            });
            if (!matched) {
              next.push({
                id: assistantMessageIdForRecovery,
                role: 'assistant',
                content: bufferedAssistantText,
                createdAt: Date.now(),
                isImageGenerating: false,
                isVideoGenerating: false,
                isArtifactGenerating: false,
              });
            }
            return next;
          });
          hapticSuccess();
          didMutateChats = true;
          return;
        }
        if (isAuthenticated && requestKind === 'chat' && !isLimitError && (isRateLimited || isIdempotencyInProgress)) {
          setStreamingModelLabel(null);
          hapticError();
          setMessages((prev) => {
            let matched = false;
            const next = prev.map((item) => {
              if (item.id !== assistantMessageIdForRecovery) return item;
              matched = true;
              return {
                ...item,
                isImageGenerating: false,
                isVideoGenerating: false,
                isArtifactGenerating: false,
                content: fastFailVisibleMessage,
              };
            });
            if (!matched) {
              next.push({
                id: assistantMessageIdForRecovery || `assistant-error-${Date.now()}`,
                role: 'assistant',
                content: fastFailVisibleMessage,
                createdAt: Date.now(),
                isImageGenerating: false,
                isVideoGenerating: false,
                isArtifactGenerating: false,
              });
            }
            return next;
          });
          showTransientNotice(fastFailVisibleMessage, isIdempotencyInProgress ? 5000 : 4000);
          didMutateChats = true;
          return;
        }
        if (usedVideoReferenceFollowUp && isLikelyTimeoutOrDisconnect && activeAuthConversationId) {
          for (let recoveryAttempt = 1; recoveryAttempt <= 24; recoveryAttempt += 1) {
            try {
              await new Promise((resolve) => setTimeout(resolve, 5000));
              const detail = await getAuthenticatedConversation(activeAuthConversationId, { force: true });
              const hasRecoveredVideo = detail.messages
                .slice()
                .reverse()
                .some((item) => (
                  item.role === 'assistant'
                  && Boolean(item.videoUrl)
                  && new Date(item.createdAt).getTime() >= responseRecoveryStartAt
                ));
              if (!hasRecoveredVideo) continue;
              applyAuthConversationDetail(detail);
              hapticSuccess();
              didMutateChats = true;
              return;
            } catch {
              // Continue recovery polling.
            }
          }
        }
        if (isAuthStreamActiveServerError && !activeAuthConversationId && !authConversationId) {
          const buffered = assistantResponseBuffer.trim();
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantMessageIdForRecovery
                ? {
                    ...item,
                    isImageGenerating: false,
                    isVideoGenerating: false,
                    isArtifactGenerating: false,
                    content: buffered || 'Response was interrupted. Please tap send to retry.',
                  }
                : item,
            ),
          );
          if (!buffered) {
            showTransientNotice('Response was interrupted. Please retry.');
          } else {
            hapticSuccess();
          }
          didMutateChats = true;
          return;
        }
        const recoveryConversationId = activeAuthConversationId ?? authConversationId;
        if (
          isAuthStreamActiveServerError
          && recoveryConversationId
        ) {
          // Re-read the conversation instead of re-sending the message: the
          // first send may already be saved, and resending would duplicate
          // the user's turn (web parity: refetch after a turn, never resend).
          let fallbackResponseText = '';
          try {
            const detail = await getAuthenticatedConversation(recoveryConversationId, { force: true });
            const savedAssistant = [...detail.messages]
              .reverse()
              .find((item) => (
                item.role === 'assistant'
                && item.content.trim().length > 0
                && new Date(item.createdAt).getTime() >= responseRecoveryStartAt
              ));
            fallbackResponseText = savedAssistant?.content.trim() ?? '';
          } catch {
            // Continue with best-effort recovery paths below.
          }

          if (fallbackResponseText) {
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantMessageIdForRecovery
                  ? {
                      ...item,
                      isImageGenerating: false,
                      isVideoGenerating: false,
                      isArtifactGenerating: false,
                      content: fallbackResponseText,
                    }
                  : item,
              ),
            );
            hapticSuccess();
            didMutateChats = true;
            void getAuthenticatedConversation(recoveryConversationId, { force: true })
              .then((detail) => {
                const recoveredAssistant = [...detail.messages]
                  .reverse()
                  .find((item) => (
                    item.role === 'assistant'
                    && item.content.trim().length > 0
                    && new Date(item.createdAt).getTime() >= responseRecoveryStartAt
                  ));
                if (recoveredAssistant) {
                  applyAuthConversationDetail(detail);
                }
              })
              .catch(() => {
                // Best-effort sync only; keep recovered text in-place.
              });
            return;
          }

          for (let recoveryAttempt = 1; recoveryAttempt <= 5; recoveryAttempt += 1) {
            try {
              if (recoveryAttempt > 1) {
                await new Promise((resolve) => setTimeout(resolve, 240 * recoveryAttempt));
              }
              const detail = await getAuthenticatedConversation(recoveryConversationId, { force: true });
              const recoveredAssistant = [...detail.messages]
                .reverse()
                .find((item) => (
                  item.role === 'assistant'
                  && item.content.trim().length > 0
                  && new Date(item.createdAt).getTime() >= responseRecoveryStartAt
                ));
              if (!recoveredAssistant) continue;
              applyAuthConversationDetail(detail);
              hapticSuccess();
              didMutateChats = true;
              return;
            } catch {
              // Keep trying.
            }
          }

          if (assistantResponseBuffer.trim()) {
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantMessageIdForRecovery
                  ? {
                      ...item,
                      isImageGenerating: false,
                      isVideoGenerating: false,
                      isArtifactGenerating: false,
                      content: assistantResponseBuffer.trim(),
                    }
                  : item,
              ),
            );
            hapticSuccess();
            didMutateChats = true;
            return;
          }

          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantMessageIdForRecovery
                ? {
                    ...item,
                    isImageGenerating: false,
                    isVideoGenerating: false,
                    isArtifactGenerating: false,
                    content: 'Response was interrupted. Please tap send to retry.',
                  }
                : item,
            ),
          );
          showTransientNotice('Response was interrupted. Please retry.');
          didMutateChats = true;
          return;
        }
        if (isAuthenticated && (isAuthStreamTransportError || isIdempotencyInProgress)) {
          if (recoveryConversationId) {
            for (let recoveryAttempt = 1; recoveryAttempt <= 8; recoveryAttempt += 1) {
              try {
                await new Promise((resolve) => setTimeout(resolve, 280 * recoveryAttempt));
                const detail = await getAuthenticatedConversation(recoveryConversationId, { force: true });
                const recoveredAssistant = [...detail.messages]
                  .reverse()
                  .find((item) => (
                    item.role === 'assistant'
                    && item.content.trim().length > 0
                    && new Date(item.createdAt).getTime() >= responseRecoveryStartAt
                  ));
                if (!recoveredAssistant) continue;
                applyAuthConversationDetail(detail);
                logParsedResponseForAttempt(recoveredAssistant.content);
                didMutateChats = true;
                return;
              } catch {
                // continue recovery retries
              }
            }
          }
        }
        try {
          console.log(
            '[chat-send:error]',
            JSON.stringify({
              endpoint: lastEndpoint,
              requestKind,
              isAuthenticated,
              conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
              idempotencyKey: lastIdempotencyKey || null,
              code: code || null,
              status: status ?? null,
              message,
              rawErrorMessage,
            }),
          );
        } catch {
          console.log('[chat-send:error]', {
            endpoint: lastEndpoint,
            requestKind,
            isAuthenticated,
            conversationId: activeAuthConversationId ?? authConversationId ?? guestConversationId ?? null,
            idempotencyKey: lastIdempotencyKey || null,
            code: code || null,
            status: status ?? null,
            message,
            rawErrorMessage,
          });
        }
        if (delayedVideoError) {
          const delayedMessage = t('chat.videoGenerationDelayed');
          if (requestedVideoConversationId) {
            scheduleVideoAutoSync(
              requestedVideoConversationId,
              requestedVideoPrompt || trimmed,
              requestedVideoStartedAt || Date.now(),
            );
          }
          setMessages((prev) =>
            {
              let matched = false;
              const next = prev.map((item) => {
                if (item.id !== assistantMessageIdForRecovery) return item;
                matched = true;
                return {
                  ...item,
                  content: delayedMessage,
                  videoPrompt: requestedVideoPrompt || item.videoPrompt,
                  isVideoGenerating: true,
                };
              });
              if (!matched) {
                next.push({
                  id: `video-delayed-${Date.now()}`,
                  role: 'assistant',
                  content: delayedMessage,
                  createdAt: Date.now(),
                  videoPrompt: requestedVideoPrompt || trimmed,
                  isVideoGenerating: true,
                });
              }
              return next;
            },
          );
          showTransientNotice(delayedMessage, 7000);
          didMutateChats = true;
          return;
        }
        if (isLimitError) {
          setSendQueue([]);
          preserveLimitNotice = true;
          setUpgradeNoticeIsCredits(
            ((error as { code?: string } | undefined)?.code ?? '').toUpperCase() === 'CREDIT_LIMIT_EXCEEDED',
          );
          showLimitNotice(limitRequestKind, limitResetHours);
        }
        hapticError();
        setStreamingModelLabel(null);

        const visibleErrorMessage = isIdempotencyInProgress
          ? idempotencyVisibleMessage
          : friendlyMessage;

        if (requestKind === 'chat' && bufferedAssistantText.length > 0) {
          setMessages((prev) => {
            let matched = false;
            const next = prev.map((item) => {
              if (item.id !== assistantMessageIdForRecovery) return item;
              matched = true;
              return {
                ...item,
                isImageGenerating: false,
                isVideoGenerating: false,
                isArtifactGenerating: false,
                content: bufferedAssistantText,
              };
            });
            if (!matched) {
              next.push({
                id: assistantMessageIdForRecovery,
                role: 'assistant',
                content: bufferedAssistantText,
                createdAt: Date.now(),
                isImageGenerating: false,
                isVideoGenerating: false,
                isArtifactGenerating: false,
              });
            }
            return next;
          });
          didMutateChats = true;
          hapticSuccess();
          return;
        }

        if (!isLimitError) {
          showTransientNotice(visibleErrorMessage, isRateLimited ? 5000 : 3200);
        }
        setMessages((prev) =>
          {
            let matched = false;
            const next = prev.map((item) => {
              if (item.id !== assistantMessageIdForRecovery) return item;
              matched = true;
                return {
                  ...item,
                  isImageGenerating: false,
                  isVideoGenerating: false,
                  isArtifactGenerating: false,
                  content: isLimitError ? limitVisibleMessage : visibleErrorMessage,
                };
            });
            if (!matched) {
              next.push({
                id: `send-error-${Date.now()}`,
                role: 'assistant',
                content: isLimitError ? limitVisibleMessage : visibleErrorMessage,
                createdAt: Date.now(),
                isImageGenerating: false,
                isVideoGenerating: false,
                isArtifactGenerating: false,
              });
            }
            return next;
          },
        );
        didMutateChats = true;
        } finally {
          // A run the user navigated away from was already cleaned up by
          // detachActiveRun(); touching shared state now could clobber the
          // chat they moved to.
          if (!runHandle.detached) {
            flushPendingAssistantDelta();
            if (deltaFlushTimerRef.current) {
              clearTimeout(deltaFlushTimerRef.current);
              deltaFlushTimerRef.current = null;
            }
            setIsUnderstandingPrompt(false);
            setStreamingModelLabel(null);
            settleInterruptedTools([activeAssistantId, assistantId]);
            if (!preserveLimitNotice) {
              setStatusNotice('');
            }
            setIsSending(false);
            setUploadProgressPercent(null);
            isSendRunInFlightRef.current = false;
            if (activeRunRef.current === runHandle) activeRunRef.current = null;
          }
          if (didMutateChats) {
            emitChatMutated();
          }
        }
    };

    void run();
  };

  // Real, native tool-calling feature (render_widget) -- ports web's
  // handleWidgetSubmit. A widget's own submit button sends its formatted
  // "[Form response] ..." line directly as the next turn; there's nothing
  // in the composer to send, so it's staged into the same input state
  // handleSend already reads, then sent through the same path a typed
  // message would take (queues/debounces the same way).
  const handleWidgetSubmit = (line: string) => {
    inputValueRef.current = line;
    setInput(line);
    handleSend({ skipDocumentFormWarning: true });
  };

  // A turn can end (dropped connection, recovery gave up) while a tool chip is
  // still marked running. Nothing else clears it, so it would spin forever.
  // Settle whatever is left as interrupted so the UI shows a failure + retry.
  const settleInterruptedTools = (messageIds: string[]) => {
    const ids = messageIds.filter(Boolean);
    if (!ids.length) return;
    setMessages((prev) =>
      prev.map((message) => {
        if (!ids.includes(message.id)) return message;
        const hasRunningTool = message.tools?.some((tool) => tool.running);
        const hasPendingArtifact = message.artifacts?.some((artifact) => artifact.generating);
        if (!hasRunningTool && !hasPendingArtifact) return message;
        return {
          ...message,
          tools: message.tools?.map((tool) =>
            tool.running ? { ...tool, running: false, ok: false, interrupted: true } : tool,
          ),
          artifacts: message.artifacts?.map((artifact) =>
            artifact.generating ? { ...artifact, generating: false, failed: true } : artifact,
          ),
        };
      }),
    );
  };

  const retryFromAssistantMessage = (assistantMessageId: string) => {
    const index = messages.findIndex((message) => message.id === assistantMessageId);
    if (index < 0) return;
    const previousPrompt = [...messages.slice(0, index)].reverse().find(
      (message) => message.role === 'user' && message.content.trim(),
    );
    if (!previousPrompt) return;
    hapticSelection();
    handleWidgetSubmit(previousPrompt.content.trim());
  };

  useEffect(() => {
    void AsyncStorage.getItem(STOPPED_ASSISTANT_IDS_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => {
            if (typeof id === 'string') stoppedAssistantIdsRef.current.add(id);
          });
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(STOPPED_TURNS_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          stoppedTurnsRef.current = [
            ...parsed.filter(
              (turn): turn is StoppedTurn =>
                Boolean(turn) && typeof turn.conversationId === 'string' && typeof turn.text === 'string'
                && typeof turn.occurrence === 'number',
            ),
            ...stoppedTurnsRef.current,
          ];
        }
      })
      .catch(() => undefined);
  }, []);

  const rememberStoppedTurn = (turn: StoppedTurn) => {
    stoppedTurnsRef.current = [...stoppedTurnsRef.current, turn].slice(-MAX_STORED_STOPPED_TURNS);
    void AsyncStorage.setItem(STOPPED_TURNS_KEY, JSON.stringify(stoppedTurnsRef.current)).catch(() => undefined);
  };

  const rememberStoppedAssistantIds = (ids: string[]) => {
    ids.filter(Boolean).forEach((id) => stoppedAssistantIdsRef.current.add(id));
    const stored = [...stoppedAssistantIdsRef.current].slice(-MAX_STORED_STOPPED_IDS);
    void AsyncStorage.setItem(STOPPED_ASSISTANT_IDS_KEY, JSON.stringify(stored)).catch(() => undefined);
  };

  // Stop button: abort the live request and keep the partial reply. Queued
  // messages stay put: once this turn winds down, the queue effect starts the
  // next one automatically.
  const handleStopGeneration = () => {
    const run = activeRunRef.current;
    if (!run || run.stoppedByUser) return;
    hapticSelection();
    run.stoppedByUser = true;
    run.controller.abort();
  };

  // Leaving a chat mid-reply: stop tracking it here so its spinner, status pill
  // and queue don't follow the user into another conversation. The server keeps
  // generating and saves the reply, which is loaded when they come back.
  const detachActiveRun = () => {
    setSendQueue([]);
    const run = activeRunRef.current;
    if (!run) return;
    run.detached = true;
    activeRunRef.current = null;
    const conversationId = currentConversationIdRef.current;
    if (conversationId) detachedRunsRef.current.set(conversationId, Date.now());
    run.controller.abort();
    pendingDeltaRef.current = '';
    if (deltaFlushTimerRef.current) {
      clearTimeout(deltaFlushTimerRef.current);
      deltaFlushTimerRef.current = null;
    }
    isSendRunInFlightRef.current = false;
    setIsSending(false);
    setIsUnderstandingPrompt(false);
    setStreamingModelLabel(null);
    setUploadProgressPercent(null);
    setStatusNotice('');
  };

  const removeQueuedSend = (id: string) => {
    hapticSelection();
    setSendQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // Start the next queued message as soon as the current turn is finished. Runs
  // as an effect so it always uses this render's conversation id (a brand-new
  // chat gets its id during the first turn).
  useEffect(() => {
    if (!sendQueue.length) return;
    if (isSending || isUnderstandingPrompt || isHydratingAuthChat || isSendRunInFlightRef.current) return;
    const [next, ...rest] = sendQueue;
    setSendQueue(rest);
    handleSend({ skipDocumentFormWarning: true, fromQueue: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendQueue, isSending, isUnderstandingPrompt, isHydratingAuthChat]);

  const insertStarterPrompt = (prompt: string) => {
    hapticSelection();
    const value = prompt.trim();
    inputValueRef.current = value;
    setInput(value);
    setAttachmentMenuOpen(false);
    setModelMenuOpen(false);
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  };

  const openPromptSuggestions = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    hapticSelection();
    setPromptSuggestionsVisible(true);
    setPromptSuggestions([]);
    setIsPromptSuggestionsLoading(true);

    promptSuggestionAbortRef.current?.abort();
    const controller = new AbortController();
    promptSuggestionAbortRef.current = controller;

    void (async () => {
      const authToken = isAuthenticated ? undefined : (await ensureGuestSession()).guestSessionToken;
      return fetchPromptSuggestions({
        partialText: trimmed,
        context: promptSuggestionContext,
        authToken,
        signal: controller.signal,
      });
    })()
      .then((nextSuggestions) => {
        if (controller.signal.aborted) return;
        if (__DEV__) {
          console.log('[prompt-suggestions]', {
            screenMode,
            partialText: trimmed,
            suggestions: nextSuggestions,
          });
        }
        setPromptSuggestions(nextSuggestions);
      })
      .catch((error: unknown) => {
        const maybeError = error as { code?: string; name?: string };
        if (controller.signal.aborted || maybeError?.code === 'ERR_CANCELED' || maybeError?.name === 'CanceledError') {
          return;
        }
        if (__DEV__) {
          console.log('[prompt-suggestions:error]', {
            screenMode,
            partialText: trimmed,
            error,
          });
        }
        setPromptSuggestions([]);
      })
      .finally(() => {
        if (promptSuggestionAbortRef.current === controller) {
          promptSuggestionAbortRef.current = null;
        }
        if (!controller.signal.aborted) {
          setIsPromptSuggestionsLoading(false);
        }
      });
  }, [input, isAuthenticated, promptSuggestionContext, screenMode]);

  const closePromptSuggestions = useCallback(() => {
    promptSuggestionAbortRef.current?.abort();
    promptSuggestionAbortRef.current = null;
    setIsPromptSuggestionsLoading(false);
    setPromptSuggestionsVisible(false);
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  }, []);

  const applyPromptSuggestion = useCallback((suggestion: string) => {
    const value = suggestion.trim();
    inputValueRef.current = value;
    setInput(value);
    setPromptSuggestionsVisible(false);
    announceForA11y(t('promptSuggestions.addedA11y'));
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  }, [announceForA11y, t]);

  const focusComposerInputSoon = useCallback(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        composerInputRef.current?.focus();
      }, 60);
    });
  }, []);

  const applyRandomImagePrompt = useCallback(() => {
    if (IMAGE_MODE_PROMPTS.length === 0) return;
    let nextIndex = Math.floor(Math.random() * IMAGE_MODE_PROMPTS.length);
    if (IMAGE_MODE_PROMPTS.length > 1) {
      while (nextIndex === lastImagePromptIndexRef.current) {
        nextIndex = Math.floor(Math.random() * IMAGE_MODE_PROMPTS.length);
      }
    }
    lastImagePromptIndexRef.current = nextIndex;
    const prompt = IMAGE_MODE_PROMPTS[nextIndex];
    inputValueRef.current = prompt;
    setInput(prompt);
    hapticSelection();
    focusComposerInputSoon();
  }, [focusComposerInputSoon]);

  const applyRandomVideoPrompt = useCallback(() => {
    if (VIDEO_MODE_PROMPTS.length === 0) return;
    let nextIndex = Math.floor(Math.random() * VIDEO_MODE_PROMPTS.length);
    if (VIDEO_MODE_PROMPTS.length > 1) {
      while (nextIndex === lastVideoPromptIndexRef.current) {
        nextIndex = Math.floor(Math.random() * VIDEO_MODE_PROMPTS.length);
      }
    }
    lastVideoPromptIndexRef.current = nextIndex;
    const prompt = VIDEO_MODE_PROMPTS[nextIndex];
    inputValueRef.current = prompt;
    setInput(prompt);
    hapticSelection();
    focusComposerInputSoon();
  }, [focusComposerInputSoon]);

  const toggleRecording = async () => {
    if (isRecordingRef.current) {
      hapticSelection();
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        hapticError();
        showTransientNotice(t('chat.speechPermError'));
        return;
      }

      hapticImpact();
      speechDraftRef.current = '';
      speechRecognitionRequestedRef.current = true;
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
      });
    } catch (error) {
      speechRecognitionRequestedRef.current = false;
      isRecordingRef.current = false;
      setIsRecording(false);
      hapticError();
      showTransientNotice(t('chat.speechError'));
      if (__DEV__) {
        console.log('[speech-recognition:start-error]', error);
      }
    }
  };

  const takePhotoAttachment = async () => {
    setAttachmentMenuOpen(false);
    let result: Awaited<ReturnType<ImagePickerModule['launchCameraAsync']>>;
    try {
      const ImagePicker = await getImagePickerModule();
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showTransientNotice('Camera permission is required to take a photo.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.9,
        mediaTypes: ['images'],
      });
    } catch {
      showTransientNotice('Camera is unavailable in this build.');
      return;
    }

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const fallbackFileName = `image-${Date.now()}.jpg`;
    logUploadSelection({
      source: 'camera',
      screenMode,
      fileName: asset.fileName ?? fallbackFileName,
      mimeType: asset.mimeType ?? 'image/jpeg',
      uri: asset.uri,
    });
    setAttachedAssets((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: asset.fileName ?? fallbackFileName,
        uri: asset.uri,
        fileName: asset.fileName ?? fallbackFileName,
        mimeType: asset.mimeType ?? 'image/jpeg',
      },
    ]);
    focusComposerInputSoon();
  };

  const handleUploadImagePress = () => {
    setUploadOptionModalVisible(true);
  };

  const closeAttachmentMenu = useCallback(() => {
    setAttachmentMenuOpen(false);
    setTimeout(() => focusAccessibilityNode(uploadTriggerButtonRef.current), 120);
  }, []);

  const closeUploadOptionModal = useCallback(() => {
    setUploadOptionModalVisible(false);
    setTimeout(() => focusAccessibilityNode(uploadTriggerButtonRef.current), 120);
  }, []);

  const pickAttachment = async () => {
    setAttachmentMenuOpen(false);
    let asset: { fileName?: string | null; uri: string; mimeType?: string | null } | null;
    try {
      const ImagePicker = await getImagePickerModule();
      asset = await pickSingleImageFromLibrary(ImagePicker, {
        allowsEditing: false,
        quality: 0.9,
      });
    } catch (error) {
      showTransientNotice(error instanceof Error ? error.message : 'Image picker is unavailable in this build.');
      return;
    }

    if (!asset) return;
    const fallbackFileName = `image-${Date.now()}.jpg`;
    logUploadSelection({
      source: 'gallery',
      screenMode,
      fileName: asset.fileName ?? fallbackFileName,
      mimeType: asset.mimeType ?? 'image/jpeg',
      uri: asset.uri,
    });
    setAttachedAssets((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: asset.fileName ?? fallbackFileName,
        uri: asset.uri,
        fileName: asset.fileName ?? fallbackFileName,
        mimeType: asset.mimeType ?? 'image/jpeg',
      },
    ]);
    focusComposerInputSoon();
  };

  const pickDocumentAttachment = async () => {
    if (!canAttachDocuments) {
      showTransientNotice('Document upload is available on paid plans only.');
      return;
    }

    if (documentPickerInFlightRef.current) {
      showTransientNotice('Document picker is already opening.');
      return;
    }

    documentPickerInFlightRef.current = true;
    try {
      let DocumentPicker: DocumentPickerModule;
      try {
        DocumentPicker = await getDocumentPickerModule();
      } catch (error) {
        showTransientNotice(error instanceof Error ? error.message : 'Document picker is unavailable in this build.');
        return;
      }

      let result: Awaited<ReturnType<DocumentPickerModule['getDocumentAsync']>>;
      try {
        result = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          multiple: false,
          type: Platform.OS === 'ios'
            ? '*/*'
            : [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
              ],
        });
      } catch (error) {
        if (__DEV__) {
          console.log('[document-picker:pick-failed]', error);
        }
        showTransientNotice('Unable to open the document picker right now. Please try again.');
        return;
      }

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const lowerName = (asset.name ?? '').toLowerCase();
      const mime = (asset.mimeType ?? '').toLowerCase();
      const isAllowedMime =
        mime === 'application/pdf' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mime === 'text/plain';
      const isAllowedExtension =
        lowerName.endsWith('.pdf') ||
        lowerName.endsWith('.docx') ||
        lowerName.endsWith('.txt');

      if (!isAllowedMime && !isAllowedExtension) {
        showTransientNotice('Only document attachments are supported: PDF, DOCX, TXT.');
        return;
      }

      setAttachedAssets((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label: asset.name ?? 'document-attachment',
          uri: asset.uri,
          fileName: asset.name ?? `document-${Date.now()}`,
          mimeType: lowerName.endsWith('.pdf') ? 'application/pdf' : (asset.mimeType ?? undefined),
        },
      ]);
    } finally {
      documentPickerInFlightRef.current = false;
    }
  };

  const handleDocumentUploadPress = () => {
    setAttachmentMenuOpen(false);
    const openPicker = () => {
      void pickDocumentAttachment();
    };
    if (Platform.OS === 'ios') {
      setTimeout(openPicker, MOTION.duration.normal);
      return;
    }
    openPicker();
  };

  const removeAttachment = (id: string) => {
    setAttachedAssets((prev) => prev.filter((item) => item.id !== id));
  };

  const showTransientNotice = (message: string, durationMs = 3200) => {
    setUpgradeNoticeKind(null);
    setUpgradeNoticeResetHours(null);
    setStatusNotice(message);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => {
      setStatusNotice('');
      noticeTimeoutRef.current = null;
    }, durationMs);
  };

  const toggleReaction = async (messageId: string, reaction: 'like' | 'dislike') => {
    const previous = messageReactions[messageId];
    const next = previous === reaction ? undefined : reaction;

    setMessageReactions((prev) => ({
      ...prev,
      [messageId]: next,
    }));
    hapticSelection();

    if (!isAuthenticated || !authConversationId) return;

    try {
      const server = await toggleAuthenticatedMessageReaction(authConversationId, messageId, reaction);
      setMessageReactions((prev) => ({
        ...prev,
        [messageId]: server.liked ? 'like' : server.disliked ? 'dislike' : undefined,
      }));
    } catch {
      setMessageReactions((prev) => ({
        ...prev,
        [messageId]: previous,
      }));
      showTransientNotice(t('chat.reactionFailed'));
    }
  };

  const toggleLocalReaction = (messageId: string, reaction: 'like' | 'dislike') => {
    const previous = messageReactions[messageId];
    const next = previous === reaction ? undefined : reaction;
    setMessageReactions((prev) => ({
      ...prev,
      [messageId]: next,
    }));
    hapticSelection();
  };

  const downloadImageMessage = async (message: UiMessage) => {
    const resolvedUrl = resolveBackendAssetUrl(message.imageUrl);
    if (!resolvedUrl) {
      showTransientNotice(t('chat.imageDownloadFailed'));
      return;
    }

    hapticSelection();
    showDownloadToast(t('chat.imageDownloadStarting'), null);

    try {
      const extensionMatch = resolvedUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      const extension = extensionMatch?.[1]?.toLowerCase() || 'jpg';
      const fileName = `cafa-ai-image-${message.imageId ?? Date.now()}.${extension}`;
      const target = new File(Paths.cache, fileName);
      if (target.exists) {
        target.delete();
      }

      const accessToken = await getAccessToken();
      const downloaded = await File.downloadFileAsync(resolvedUrl, target, {
        idempotent: true,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      await saveMediaToCafaAlbum(downloaded.uri);
      showDownloadToast(t('chat.imageDownloadSuccess'));
      hapticSuccess();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown image download failure';
      console.log(
        `[chat-image-download:error] endpoint=${resolvedUrl} message="${messageText}"`,
      );
      if (
        Platform.OS === 'ios'
        && (error as { code?: string } | undefined)?.code === IOS_PHOTO_PERMISSION_DENIED_CODE
      ) {
        Alert.alert(
          'Photos Permission Needed',
          'Allow Photos access in Settings to save images and videos.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
          ],
        );
      }
      showDownloadToast(t('chat.imageDownloadFailed'), 5000);
      hapticError();
    }
  };

  const downloadVideoMessage = async (message: UiMessage) => {
    const resolvedUrl = resolveBackendAssetUrl(message.videoUrl);
    if (!resolvedUrl) {
      showTransientNotice(t('chat.videoDownloadFailed'));
      return;
    }

    hapticSelection();
    showDownloadToast(t('chat.videoDownloadStarting'), null);

    try {
      const extensionMatch = resolvedUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      const extension = extensionMatch?.[1]?.toLowerCase() || 'mp4';
      const fileName = `cafa-ai-video-${message.videoId ?? Date.now()}.${extension}`;
      const target = new File(Paths.cache, fileName);
      if (target.exists) {
        target.delete();
      }

      const accessToken = await getAccessToken();
      const downloaded = await File.downloadFileAsync(resolvedUrl, target, {
        idempotent: true,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      await saveMediaToCafaAlbum(downloaded.uri);
      showDownloadToast(t('chat.videoDownloadSuccess'));
      hapticSuccess();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown video download failure';
      console.log(
        `[chat-video-download:error] endpoint=${resolvedUrl} message="${messageText}"`,
      );
      if (
        Platform.OS === 'ios'
        && (error as { code?: string } | undefined)?.code === IOS_PHOTO_PERMISSION_DENIED_CODE
      ) {
        Alert.alert(
          'Photos Permission Needed',
          'Allow Photos access in Settings to save images and videos.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
          ],
        );
      }
      showDownloadToast(t('chat.videoDownloadFailed'), 5000);
      hapticError();
    }
  };

  const allArtifacts = useMemo(
    () => messages.flatMap((message) => message.artifacts ?? []),
    [messages],
  );

  const downloadArtifact = async (artifact: UiArtifactItem) => {
    if (artifact.kind === 'document') {
      const lowerName = (artifact.name ?? artifact.url ?? '').toLowerCase();
      const mimeType = lowerName.includes('.pdf')
        ? 'application/pdf'
        : lowerName.includes('.docx')
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : lowerName.includes('.doc')
            ? 'application/msword'
            : 'application/octet-stream';
      await downloadGeneratedFileAttachment(
        {
          id: artifact.id,
          url: artifact.url,
          originalName: artifact.name,
          mimeType: artifact.mimeType ?? mimeType,
        },
        artifact.messageId,
      );
      return;
    }
    const resolvedUrl = resolveBackendAssetUrl(artifact.url);
    if (!resolvedUrl) {
      showTransientNotice(t('chat.imageDownloadFailed'));
      return;
    }
    hapticSelection();
    showDownloadToast(t(artifact.kind === 'video' ? 'chat.videoDownloadStarting' : 'chat.imageDownloadStarting'), null);
    try {
      const extensionMatch = resolvedUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      const extension = extensionMatch?.[1]?.toLowerCase() || (artifact.kind === 'video' ? 'mp4' : 'jpg');
      const fileName = `cafa-ai-${artifact.kind}-${artifact.id}.${extension}`;
      const target = new File(Paths.cache, fileName);
      if (target.exists) target.delete();
      const accessToken = await getAccessToken();
      const downloaded = await File.downloadFileAsync(resolvedUrl, target, {
        idempotent: true,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      await saveMediaToCafaAlbum(downloaded.uri);
      showDownloadToast(t(artifact.kind === 'video' ? 'chat.videoDownloadSuccess' : 'chat.imageDownloadSuccess'));
      hapticSuccess();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown artifact download failure';
      console.log(`[artifact-download:error] endpoint=${resolvedUrl} message="${messageText}"`);
      showDownloadToast(t(artifact.kind === 'video' ? 'chat.videoDownloadFailed' : 'chat.imageDownloadFailed'), 5000);
      hapticError();
    }
  };

  const deleteArtifactAndUpdate = async (artifact: UiArtifactItem) => {
    if (typeof artifact.toolCallIndex !== 'number' || !authConversationId) {
      throw new Error('This file cannot be deleted yet.');
    }
    await deleteArtifact(authConversationId, artifact.messageId, artifact.toolCallIndex);
    setMessages((prev) =>
      prev.map((message) =>
        message.id === artifact.messageId
          ? { ...message, artifacts: (message.artifacts ?? []).filter((item) => item.id !== artifact.id) }
          : message,
      ),
    );
  };

  const shareGeneratedMediaMessage = async (options: {
    messageId: string;
    remoteUrl?: string;
    mediaId?: string;
    defaultExtension: string;
    filePrefix: 'image' | 'video';
    mimeType: string;
    notAvailableNotice: string;
    failedNotice: string;
  }) => {
    if (mediaShareInFlightRef.current) {
      showTransientNotice(t('chat.shareInProgress'));
      return;
    }

    const resolvedUrl = resolveBackendAssetUrl(options.remoteUrl);
    if (!resolvedUrl) {
      showTransientNotice(options.notAvailableNotice);
      return;
    }

    hapticSelection();
    showTransientNotice(t('chat.mediaSharePreparing'));
    setSharingMediaMessageId(options.messageId);
    mediaShareInFlightRef.current = true;
    try {
      const cacheKey = `${options.filePrefix}:${options.mediaId ?? resolvedUrl}`;
      const extensionMatch = resolvedUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      const extension = extensionMatch?.[1]?.toLowerCase() || options.defaultExtension;
      const fileName = `cafa-ai-${options.filePrefix}-${options.mediaId ?? Date.now()}.${extension}`;
      const shareLocalUri = async (uri: string) => {
        const Sharing = await getSharingModule();
        if (Sharing && await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: options.mimeType,
            dialogTitle: 'Share media',
          });
          return;
        }
        await Share.share({ url: uri });
      };

      const cached = sharedMediaCacheRef.current[cacheKey];
      if (cached?.uri) {
        try {
          await shareLocalUri(cached.uri);
          hapticSuccess();
          return;
        } catch {
          delete sharedMediaCacheRef.current[cacheKey];
        }
      }

      const target = new File(Paths.cache, fileName);
      if (target.exists) target.delete();

      const accessToken = await getAccessToken();
      let downloaded: Awaited<ReturnType<typeof File.downloadFileAsync>> | null = null;
      let lastDownloadError: unknown = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          downloaded = await File.downloadFileAsync(resolvedUrl, target, {
            idempotent: true,
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          });
          break;
        } catch (error) {
          lastDownloadError = error;
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
          }
        }
      }
      if (!downloaded) throw lastDownloadError ?? new Error('Media download failed.');

      sharedMediaCacheRef.current[cacheKey] = { uri: downloaded.uri, mimeType: options.mimeType, fileName };
      await shareLocalUri(downloaded.uri);
      hapticSuccess();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown media share failure';
      console.log(`[chat-media-share:error] endpoint=${resolvedUrl} message="${messageText}"`);
      showTransientNotice(options.failedNotice);
      hapticError();
    } finally {
      mediaShareInFlightRef.current = false;
      setSharingMediaMessageId((current) => (current === options.messageId ? null : current));
    }
  };

  const shareImageMessage = async (message: UiMessage) => {
    await shareGeneratedMediaMessage({
      messageId: message.id,
      remoteUrl: message.imageUrl,
      mediaId: message.imageId,
      defaultExtension: 'jpg',
      filePrefix: 'image',
      mimeType: 'image/jpeg',
      notAvailableNotice: t('chat.imageDownloadFailed'),
      failedNotice: t('chat.shareFailed'),
    });
  };

  const shareVideoMessage = async (message: UiMessage) => {
    await shareGeneratedMediaMessage({
      messageId: message.id,
      remoteUrl: message.videoUrl,
      mediaId: message.videoId,
      defaultExtension: 'mp4',
      filePrefix: 'video',
      mimeType: 'video/mp4',
      notAvailableNotice: t('chat.videoDownloadFailed'),
      failedNotice: t('chat.shareFailed'),
    });
  };

  const setComposerReferenceFromMessage = (message: UiMessage, kind: 'image' | 'video') => {
    const candidateUrl = kind === 'image' ? message.imageUrl : message.videoUrl;
    const resolvedUrl = resolveBackendAssetUrl(candidateUrl);
    if (!resolvedUrl) {
      showTransientNotice(kind === 'image' ? t('chat.reference.imageUnavailable') : t('chat.reference.videoUnavailable'));
      return;
    }
    setComposerMediaReference({
      kind,
      id: kind === 'image' ? message.imageId : message.videoId,
      url: resolvedUrl,
    });
    const addedMessage = kind === 'image' ? t('chat.reference.imageAdded') : t('chat.reference.videoAdded');
    showTransientNotice(addedMessage);
    announceForA11y(addedMessage);
    hapticSuccess();
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  };

  const downloadGeneratedFileAttachment = async (attachment: UiMessageAttachment, messageId: string) => {
    const rawUrl = attachment.url;
    const resolvedUrl = resolveBackendAssetUrl(rawUrl);
    if (!resolvedUrl) {
      showTransientNotice('Could not download this file right now.');
      return;
    }

    const attachmentId = attachment.id ?? `${messageId}-${attachment.originalName ?? 'file'}`;
    setDownloadingAttachmentId(attachmentId);
    hapticSelection();
    showTransientNotice('Downloading file...');

    try {
      // One shared pipeline for every download: detects the real file type from
      // the content, names it properly, saves it to Downloads (or the Gallery for
      // media), posts a tappable "Download complete" notification and remembers
      // the saved copy so file cards can say "Open".
      const accessToken = await getAccessToken();
      const saved = await downloadAndSaveFile({
        url: resolvedUrl,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        fileName: attachment.originalName,
        mimeType: attachment.mimeType,
        registryKey: resolvedUrl,
      });
      showDownloadToast(saved.persisted ? `Saved to ${saved.displayPath}` : 'File ready to save or share.');
      hapticSuccess();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown file download failure';
      console.log(`[chat-file-download:error] endpoint=${resolvedUrl} message="${messageText}"`);
      showTransientNotice('Could not download this file right now.');
      hapticError();
    } finally {
      setDownloadingAttachmentId((current) => (current === attachmentId ? null : current));
    }
  };

  // Native paste: long-press > Paste (or the keyboard's clipboard suggestion) hands
  // pasted images and files to the app. React Native's Android text box turns every
  // paste into plain text and drops anything else, so a small native module registers
  // a content listener on the underlying input.
  const attachPasteSupport = useCallback(() => {
    if (Platform.OS !== 'android' || !CafaPaste) return;
    const tag = findNodeHandle(composerInputRef.current);
    if (tag) void CafaPaste.enablePaste(tag).catch(() => undefined);
  }, []);

  const handlePastedItems = (items: PastedItem[]) => {
    let attached = 0;
    for (const pasted of items) {
      const identity = identityFromMime(pasted.mimeType) ?? identityFromExtension(extensionOf(pasted.fileName));
      const lowerName = pasted.fileName.toLowerCase();
      const isImage = identity?.kind === 'image' || pasted.mimeType.startsWith('image/');
      if (!isImage) {
        const isAllowedDocument = lowerName.endsWith('.pdf') || lowerName.endsWith('.docx') || lowerName.endsWith('.txt');
        if (!isAllowedDocument) {
          showTransientNotice(t('chat.paste.unsupportedFile'));
          continue;
        }
        if (!canAttachDocuments) {
          showTransientNotice('Document upload is available on paid plans only.');
          continue;
        }
      }
      setAttachedAssets((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label: pasted.fileName,
          uri: pasted.uri,
          fileName: pasted.fileName,
          mimeType: pasted.mimeType,
        },
      ]);
      attached += 1;
    }
    if (attached > 0) {
      hapticSuccess();
      focusComposerInputSoon();
    }
  };
  // iPhone has no content listener on the text box, and on Android this is a fallback if
  // the long-press Paste is not offered: an explicit "Paste image" row in the attach menu.
  const pasteImageFromClipboard = async () => {
    setAttachmentMenuOpen(false);
    try {
      if (!(await Clipboard.hasImageAsync())) {
        showTransientNotice(t('chat.paste.noImage'));
        return;
      }
      const image = await Clipboard.getImageAsync({ format: 'png' });
      if (!image?.data) throw new Error('The clipboard image was empty.');
      const file = new File(Paths.cache, `pasted-image-${Date.now()}.png`);
      file.write(image.data.replace(/^data:[^;]+;base64,/, ''), { encoding: 'base64' });
      setAttachedAssets((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label: 'image.png',
          uri: file.uri,
          fileName: `image-${Date.now()}.png`,
          mimeType: 'image/png',
        },
      ]);
      hapticSuccess();
      focusComposerInputSoon();
    } catch (error) {
      console.log(`[clipboard-image:error] ${error instanceof Error ? error.message : 'unknown'}`);
      showTransientNotice(t('chat.paste.failed'));
    }
  };

  const pasteHandlerRef = useRef(handlePastedItems);
  pasteHandlerRef.current = handlePastedItems;

  useEffect(() => {
    if (!isAuthenticated || Platform.OS !== 'android' || !CafaPaste) return undefined;
    const subscription = CafaPaste.addListener('onPaste', ({ items }) => pasteHandlerRef.current(items));
    const timer = setTimeout(attachPasteSupport, 500);
    return () => {
      subscription.remove();
      clearTimeout(timer);
    };
  }, [isAuthenticated, attachPasteSupport]);

  // Copy / share the ASSET (image, video, document), not text about it.
  type AssetRef = { url?: string | null; name?: string | null; mimeType?: string | null; titleHint?: string | null };

  const assetRequestOptions = async (asset: AssetRef) => {
    const resolved = resolveBackendAssetUrl(asset.url ?? undefined);
    if (!resolved) return null;
    const accessToken = await getAccessToken();
    return {
      url: resolved,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      fileName: asset.name,
      mimeType: asset.mimeType,
      titleHint: asset.titleHint,
    };
  };

  const copyAssetMessage = async (asset: AssetRef) => {
    hapticSelection();
    try {
      const options = await assetRequestOptions(asset);
      if (!options) throw new Error('Asset is not available.');
      const result = await copyAssetToClipboard(options);
      showTransientNotice(t(result === 'image' ? 'chat.assetCopied.image' : result === 'file' ? 'chat.assetCopied.file' : 'chat.assetCopied.shared'));
      if (result !== 'shared') hapticSuccess();
    } catch (error) {
      console.log(`[asset-copy:error] ${error instanceof Error ? error.message : 'unknown'}`);
      showTransientNotice(t('chat.assetCopyFailed'));
      hapticError();
    }
  };

  const shareAssetMessage = async (asset: AssetRef) => {
    hapticSelection();
    try {
      const options = await assetRequestOptions(asset);
      if (!options) throw new Error('Asset is not available.');
      await shareAssetFile(options);
    } catch (error) {
      console.log(`[asset-share:error] ${error instanceof Error ? error.message : 'unknown'}`);
      showTransientNotice(t('chat.assetCopyFailed'));
      hapticError();
    }
  };

  const copyMessage = async (content: string) => {
    if (!content.trim()) return;
    await Clipboard.setStringAsync(sanitizeModelText(content));
    showTransientNotice(t('chat.copied'));
    hapticSuccess();
  };

  const editPrompt = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    if (activeRunRef.current) handleStopGeneration();
    inputValueRef.current = trimmed;
    setInput(trimmed);
    setIsEditingPrompt(true);
    hapticSelection();
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  };

  const renderSendButton = (className: string) => (
    <Pressable
      onPress={() => (showStopButton ? handleStopGeneration() : handleSend())}
      onLongPress={(event) => showTooltip(showStopButton ? t('chat.stop') : t('chat.send'), event)}
      disabled={isSendDisabled}
      accessibilityRole="button"
      accessibilityLabel={showStopButton ? t('chat.stop') : t('chat.send')}
      accessibilityHint={showStopButton ? t('chat.stopHint') : t('chat.sendHint')}
      className={className}
      style={{
        backgroundColor: isSendDisabled ? '#5F7FB8' : colors.primary,
      }}
    >
      <Ionicons name={showStopButton ? 'stop' : 'send'} size={showStopButton ? 16 : 15} color="#FFFFFF" />
    </Pressable>
  );

  const cancelEditingPrompt = () => {
    inputValueRef.current = '';
    setInput('');
    setIsEditingPrompt(false);
  };

  const shareMessage = async (content: string) => {
    if (!content.trim()) return;
    hapticSelection();
    try {
      await Share.share({ message: content });
    } catch {
      showTransientNotice(t('chat.shareFailed'));
    }
  };

  const stopReadAloudPlayback = useCallback(() => {
    try {
      ttsPlayerSubRef.current?.remove();
    } catch {
      // no-op
    }
    ttsPlayerSubRef.current = null;

    try {
      ttsPlayerRef.current?.pause();
    } catch {
      // no-op
    }
    try {
      ttsPlayerRef.current?.remove();
    } catch {
      // no-op
    }
    ttsPlayerRef.current = null;

    ttsFilesRef.current.forEach((file) => {
      try {
        if (file?.exists) {
          file.delete();
        }
      } catch {
        // no-op
      }
    });
    ttsFilesRef.current = [];

    Speech.stop();
    setReadingMessageId(null);
    setReadAloudSpeaker(null);
    setIsReadAloudLoading(false);
    setIsReadAloudPaused(false);
    readAloudUsesNativeFallbackRef.current = false;
  }, []);

  const splitTextForTts = (text: string, maxLen = 1900) => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];

    const parts: string[] = [];
    let remaining = normalized;

    while (remaining.length > maxLen) {
      let breakAt = Math.max(
        remaining.lastIndexOf('. ', maxLen),
        remaining.lastIndexOf('! ', maxLen),
        remaining.lastIndexOf('? ', maxLen),
      );
      if (breakAt < Math.floor(maxLen * 0.5)) {
        breakAt = remaining.lastIndexOf(' ', maxLen);
      }
      if (breakAt <= 0) {
        breakAt = maxLen;
      }
      const chunk = remaining.slice(0, breakAt).trim();
      if (chunk) parts.push(chunk);
      remaining = remaining.slice(breakAt).trim();
    }

    if (remaining) parts.push(remaining);
    return parts;
  };

  // Real fix (2026-09-13, Issue 4): genuine pause/resume matching web's
  // pauseVoicePlayback/resumeVoicePlayback (both just call .pause()/.play()
  // on the same underlying player, no re-synthesis). Native Speech fallback
  // uses expo-speech's own pause/resume, which Android's TextToSpeech engine
  // supports natively.
  const pauseReadAloud = useCallback(() => {
    if (readAloudUsesNativeFallbackRef.current) {
      Speech.pause();
    } else {
      try {
        ttsPlayerRef.current?.pause();
      } catch {
        // no-op
      }
    }
    setIsReadAloudPaused(true);
    hapticSelection();
  }, []);

  const resumeReadAloud = useCallback(() => {
    if (readAloudUsesNativeFallbackRef.current) {
      Speech.resume();
    } else {
      try {
        ttsPlayerRef.current?.play();
      } catch {
        // no-op
      }
    }
    setIsReadAloudPaused(false);
    hapticSelection();
  }, []);

  const toggleReadAloud = (messageId: string, content: string) => {
    if (!content.trim()) return;

    if (readingMessageId === messageId) {
      if (isReadAloudPaused) {
        resumeReadAloud();
      } else {
        pauseReadAloud();
      }
      return;
    }

    hapticSelection();
    activeReadAloudRequestRef.current += 1;
    const requestId = activeReadAloudRequestRef.current;
    stopReadAloudPlayback();
    setReadingMessageId(messageId);

    const speakWithNativeFallback = () => {
      readAloudUsesNativeFallbackRef.current = true;
      Speech.speak(content, {
        rate: GUEST_TTS_RATE,
        pitch: 1,
        onDone: () => {
          setReadingMessageId((current) => (current === messageId ? null : current));
          setReadAloudSpeaker(null);
        },
        onStopped: () => {
          setReadingMessageId((current) => (current === messageId ? null : current));
          setReadAloudSpeaker(null);
        },
        onError: () => {
          setReadingMessageId((current) => (current === messageId ? null : current));
          setReadAloudSpeaker(null);
          showTransientNotice(t('chat.readAloudFailed'));
        },
      });
    };

    const run = async () => {
      if (!isAuthenticated) {
        speakWithNativeFallback();
        return;
      }

      readAloudUsesNativeFallbackRef.current = false;
      const synthEndpoint = `${API_BASE_URL}/voice/synthesize`;
      let selectedVoice: string | null = null;
      try {
        selectedVoice = await getDefaultVoicePreference();
        const selectedVoiceLabel = await resolveVoiceLabel(selectedVoice);
        setReadAloudSpeaker(
          t('chat.speakingWith', { voice: selectedVoiceLabel }),
        );
        setIsReadAloudLoading(true);
        const chunks = splitTextForTts(content);
        if (!chunks.length) {
          throw new Error('No text available for read-aloud.');
        }

        if (activeReadAloudRequestRef.current !== requestId) {
          return;
        }

        // Real fix (2026-09-13, Issue 4 Tier 1): the old code awaited every
        // chunk's synthesis before playing ANY audio -- for a long response
        // split into several ~1900-char chunks, that meant waiting for the
        // full response to finish converting before the user heard a single
        // word. The backend's real per-chunk synthesis time is the only
        // latency that should matter: fetch chunk 0, start playing it the
        // moment it's ready, then synthesize the rest in the background
        // while it plays -- by the time chunk 0's few seconds of audio
        // finish, later chunks have almost always already arrived.
        const files: (File | undefined)[] = new Array(chunks.length).fill(undefined);
        ttsFilesRef.current = files as File[];

        const fetchChunk = async (index: number) => {
          const bytes = await synthesizeVoice({ text: chunks[index], voice: selectedVoice ?? undefined, speed: 1 });
          if (!bytes?.length) {
            throw new Error(`Empty TTS payload for chunk ${index + 1}.`);
          }
          const file = new File(Paths.cache, `chat-read-aloud-${messageId}-${Date.now()}-${index}.wav`);
          file.create({ intermediates: true, overwrite: true });
          file.write(bytes);
          files[index] = file;
          return file;
        };

        const playChunk = async (index: number) => {
          if (activeReadAloudRequestRef.current !== requestId) return;
          let target = files[index];
          if (!target && index < chunks.length) {
            for (let waitTick = 0; waitTick < 100 && !target; waitTick += 1) {
              await new Promise((resolve) => setTimeout(resolve, 50));
              if (activeReadAloudRequestRef.current !== requestId) return;
              target = files[index];
            }
          }
          if (!target) {
            stopReadAloudPlayback();
            return;
          }
          if (index === 0) {
            setIsReadAloudLoading(false);
          }
          const { createAudioPlayer } = await getExpoAudioModule();
          const player = createAudioPlayer(target.uri, { keepAudioSessionActive: true });
          ttsPlayerRef.current = player;
          ttsPlayerSubRef.current = player.addListener('playbackStatusUpdate', (status) => {
            if (!status.didJustFinish) return;
            try {
              ttsPlayerSubRef.current?.remove();
            } catch {
              // no-op
            }
            ttsPlayerSubRef.current = null;
            try {
              player.remove();
            } catch {
              // no-op
            }
            ttsPlayerRef.current = null;
            void playChunk(index + 1);
          });
          player.play();
        };

        // Real build (2026-09-13, Issue 4 Tier 2): chunk 0 still had to wait
        // for its full arrayBuffer to arrive before any audio played, even
        // with Tier 1's background prefetch of later chunks. A native audio
        // player can progressively stream a GET response as bytes arrive --
        // it just can't submit the POST body synthesizeVoice() needs -- so
        // mint a short-lived signed token and stream chunk 0 straight from
        // the network instead of buffering it to a file first. Falls back to
        // the proven fetch-then-play path if the streaming attempt fails.
        const playFirstChunkStreaming = async () => {
          try {
            const { token } = await createSynthesizeStreamToken({
              text: chunks[0],
              voice: selectedVoice ?? undefined,
              speed: 1,
            });
            if (activeReadAloudRequestRef.current !== requestId) return true;
            const accessToken = await getAccessToken();
            const { createAudioPlayer } = await getExpoAudioModule();
            const player = createAudioPlayer(
              {
                uri: getSynthesizeStreamUrl(token),
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
              },
              { keepAudioSessionActive: true },
            );
            ttsPlayerRef.current = player;
            setIsReadAloudLoading(false);
            ttsPlayerSubRef.current = player.addListener('playbackStatusUpdate', (status) => {
              if (!status.didJustFinish) return;
              try {
                ttsPlayerSubRef.current?.remove();
              } catch {
                // no-op
              }
              ttsPlayerSubRef.current = null;
              try {
                player.remove();
              } catch {
                // no-op
              }
              ttsPlayerRef.current = null;
              void playChunk(1);
            });
            player.play();
            return true;
          } catch (streamError) {
            console.log(
              `[tts:stream-fallback] message="${streamError instanceof Error ? streamError.message : 'unknown'}"`,
            );
            return false;
          }
        };

        const streamedFirstChunk = await playFirstChunkStreaming();
        if (activeReadAloudRequestRef.current !== requestId) {
          return;
        }

        if (!streamedFirstChunk) {
          await fetchChunk(0);
          if (activeReadAloudRequestRef.current !== requestId) {
            return;
          }
        }

        if (chunks.length > 1) {
          void (async () => {
            for (let i = 1; i < chunks.length; i += 1) {
              if (activeReadAloudRequestRef.current !== requestId) return;
              try {
                await fetchChunk(i);
              } catch (backgroundError) {
                console.log(
                  `[tts:background-chunk-error] index=${i} message="${backgroundError instanceof Error ? backgroundError.message : 'unknown'}"`,
                );
                return;
              }
            }
          })();
        }

        if (!streamedFirstChunk) {
          await playChunk(0);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown TTS failure';
        console.log(
          `[tts:error] endpoint=${synthEndpoint} voice=${selectedVoice ?? 'default'} message="${message}"`,
        );
        if (activeReadAloudRequestRef.current !== requestId) {
          return;
        }
        setReadAloudSpeaker(t('chat.speakingWith', { voice: t('chat.voice.device') }));
        setIsReadAloudLoading(false);
        showTtsToast(t('chat.readAloudFallbackNative'));
        speakWithNativeFallback();
      }
    };

    void run();
  };

  useSpeechRecognitionEvent('start', () => {
    isRecordingRef.current = true;
    setIsRecording(true);
    hapticSelection();
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    speechDraftRef.current = transcript;
  });

  useSpeechRecognitionEvent('end', () => {
    speechRecognitionRequestedRef.current = false;
    isRecordingRef.current = false;
    setIsRecording(false);
    const transcript = speechDraftRef.current.trim();
    if (!transcript) {
      return;
    }
    const nextValue = `${inputValueRef.current}${inputValueRef.current ? '\n' : ''}${transcript}`;
    inputValueRef.current = nextValue;
    setInput(nextValue);
    hapticSuccess();
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!speechRecognitionRequestedRef.current && !isRecordingRef.current) {
      if (__DEV__) {
        console.log('[speech-recognition:ignored-idle-error]', event);
      }
      return;
    }
    speechRecognitionRequestedRef.current = false;
    isRecordingRef.current = false;
    setIsRecording(false);
    // "no-speech" means the recognizer ran but heard nothing (silence, or an emulator
    // with no live microphone) -- that is not a recognition failure, so say what happened.
    if (event.error === 'no-speech') {
      hapticSelection();
      showTransientNotice(t('chat.speechNoSpeech'));
    } else {
      hapticError();
      showTransientNotice(event.error === 'not-allowed' ? t('chat.speechPermError') : t('chat.speechError'));
    }
    if (__DEV__) {
      console.log('[speech-recognition:session-error]', event);
    }
  });

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
      if (downloadToastTimeoutRef.current) clearTimeout(downloadToastTimeoutRef.current);
      if (ttsToastTimeoutRef.current) clearTimeout(ttsToastTimeoutRef.current);
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
      if (deltaFlushTimerRef.current) clearTimeout(deltaFlushTimerRef.current);
      speechRecognitionRequestedRef.current = false;
      ExpoSpeechRecognitionModule.abort();
      activeReadAloudRequestRef.current += 1;
      stopReadAloudPlayback();
    };
  }, [stopReadAloudPlayback]);

  useEffect(() => {
    if (!isAuthenticated) return;

    setAttachmentMenuOpen(false);
    setIsRecording(false);
    setAttachedAssets([]);
    setComposerMediaReference(null);
    setGuestConversationId(null);

    setIsHydratingAuthChat(true);
    setAuthConversationId(null);
    setMessages([createWelcomeMessage()]);
    setMessageReactions({});
    rotateStarterPrompts();
    router.setParams({ conversationId: undefined, newChat: undefined });
    setIsHydratingAuthChat(false);
  }, [createWelcomeMessage, isAuthenticated, rotateStarterPrompts]);

  useEffect(() => {
    if (!isAuthenticated || !isDedicatedMediaScreen) return;

    let cancelled = false;
    const hydrate = async () => {
      setIsHydratingAuthChat(true);
      setAuthConversationId(null);
      try {
        const loaded = await hydrateDedicatedMediaConversation(screenMode, { attempts: 1 });
        if (!loaded && !cancelled) {
          rotateStarterPrompts();
        }
      } catch {
        if (!cancelled) {
          setMessages([createWelcomeMessage()]);
          setMessageReactions({});
          rotateStarterPrompts();
        }
      } finally {
        if (!cancelled) {
          setIsHydratingAuthChat(false);
        }
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    createWelcomeMessage,
    hydrateDedicatedMediaConversation,
    isAuthenticated,
    isDedicatedMediaScreen,
    rotateStarterPrompts,
    screenMode,
  ]);

  useEffect(() => {
    documentDraftHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (isDedicatedMediaScreen) return;
    const targetConversationId = typeof params.conversationId === 'string' ? params.conversationId : '';
    if (!documentDraftHydratedRef.current) return;
    const activeConversationId = isAuthenticated ? authConversationId : guestConversationId;
    if (targetConversationId !== (activeConversationId ?? '')) return;
    if (isHydratingAuthChat) return;

    const draftKey = getDocumentWizardDraftKey(targetConversationId);
    const drafts = collectDocumentWizardDraftMessages(messages);
    if (drafts.length === 0) {
      void clearDocumentWizardDraftMessages(draftKey);
      return;
    }
    void setDocumentWizardDraftMessages(draftKey, drafts);
    if (targetConversationId) {
      void clearDocumentWizardDraftMessages('standalone');
    }
  }, [
    collectDocumentWizardDraftMessages,
    getDocumentWizardDraftKey,
    authConversationId,
    guestConversationId,
    isAuthenticated,
    isHydratingAuthChat,
    isDedicatedMediaScreen,
    messages,
    params.conversationId,
  ]);

  useEffect(() => {
    if (isDedicatedMediaScreen) return;
    const targetConversationId = typeof params.conversationId === 'string' ? params.conversationId : '';
    const newChatToken = typeof params.newChat === 'string' ? params.newChat.trim() : '';
    const isHydratingActiveConversationWhileSending = Boolean(
      isSendRunInFlightRef.current
      && targetConversationId
      && (
        (isAuthenticated && authConversationId === targetConversationId)
        || (!isAuthenticated && guestConversationId === targetConversationId)
      ),
    );

    if (isHydratingActiveConversationWhileSending) {
      return;
    }

    if (initialNewChatTokenRef.current === null) {
      initialNewChatTokenRef.current = newChatToken || '';
    }
    const shouldStartNewChat =
      newChatToken.length > 0
      && newChatToken !== initialNewChatTokenRef.current
      && newChatToken !== lastHandledNewChatTokenRef.current;
    if (shouldStartNewChat) {
      detachActiveRun();
      conversationHydrationRequestRef.current += 1;
      lastHandledNewChatTokenRef.current = newChatToken;
      setIsHydratingAuthChat(false);
      setIsResumingRun(false);
      setAuthConversationId(null);
      setGuestConversationId(null);
      setInput('');
      inputValueRef.current = '';
      setAttachedAssets([]);
      setComposerMediaReference(null);
      setMessages([createWelcomeMessage()]);
      setDocumentFormWarningVisible(false);
      void clearDocumentWizardDraftMessages('standalone');
      rotateStarterPrompts();
      router.setParams({ newChat: undefined, conversationId: undefined });
      return;
    }
    if (!targetConversationId) {
      conversationHydrationRequestRef.current += 1;
      setIsHydratingAuthChat(false);
      return;
    }

    if (targetConversationId !== currentConversationIdRef.current) {
      detachActiveRun();
      setIsResumingRun(false);
    }
    const requestId = conversationHydrationRequestRef.current + 1;
    conversationHydrationRequestRef.current = requestId;
    let cancelled = false;
    setIsHydratingAuthChat(true);
    setMessages([]);
    setMessageReactions({});
    if (isAuthenticated) {
      setAuthConversationId(targetConversationId);
      setGuestConversationId(null);
    } else {
      setGuestConversationId(targetConversationId);
      setAuthConversationId(null);
    }

    const isCurrentRequest = () => (
      !cancelled && conversationHydrationRequestRef.current === requestId
    );

    const hydrateTarget = async () => {
      try {
        if (isAuthenticated) {
          const detail = await getAuthenticatedConversation(targetConversationId, { force: true });
          if (!isCurrentRequest()) return;
          const mappedMessages = applyDescriptiveAttachmentNames(
            applyStoppedTurns(
              detail.messages.map(mapAuthMessageToUiMessage),
              targetConversationId,
              stoppedAssistantIdsRef.current,
              stoppedTurnsRef.current,
            ),
          );
          const localDrafts = await getDocumentWizardDraftMessages(getDocumentWizardDraftKey(targetConversationId));
          if (!isCurrentRequest()) return;
          const mergedMessages = applyWidgetSubmissionState(mergeDocumentWizardDraftMessages(mappedMessages, localDrafts));
          if (!mergedMessages.length) {
            setMessages([createWelcomeMessage()]);
            rotateStarterPrompts();
            setMessageReactions({});
            return;
          }
          setMessages(mergedMessages);
          setMessageReactions(() =>
            detail.messages.reduce<Record<string, 'like' | 'dislike' | undefined>>((acc, message) => {
              if (message.role !== 'assistant') return acc;
              acc[message.id] = message.reactions?.liked
                ? 'like'
                : message.reactions?.disliked
                  ? 'dislike'
                  : undefined;
              return acc;
            }, {}),
          );
          // This chat was left mid-reply: the server is still working, so wait
          // for its answer instead of leaving a question with no reply.
          const detachedAt = detachedRunsRef.current.get(targetConversationId);
          const lastMessage = detail.messages[detail.messages.length - 1];
          if (
            detachedAt
            && Date.now() - detachedAt < DETACHED_RUN_RESUME_WINDOW_MS
            && lastMessage?.role === 'user'
          ) {
            setIsResumingRun(true);
            for (let attempt = 0; attempt < 60 && isCurrentRequest(); attempt += 1) {
              await new Promise((resolve) => setTimeout(resolve, 3000));
              if (!isCurrentRequest()) return;
              try {
                const latest = await getAuthenticatedConversation(targetConversationId, { force: true });
                const latestMessage = latest.messages[latest.messages.length - 1];
                if (latestMessage?.role === 'assistant' && (latestMessage.content.trim() || latestMessage.toolCalls?.length)) {
                  if (!isCurrentRequest()) return;
                  setMessages(applyWidgetSubmissionState(applyDescriptiveAttachmentNames(
                    applyStoppedTurns(
                      latest.messages.map(mapAuthMessageToUiMessage),
                      targetConversationId,
                      stoppedAssistantIdsRef.current,
                      stoppedTurnsRef.current,
                    ),
                  )));
                  break;
                }
              } catch {
                // keep waiting
              }
            }
            detachedRunsRef.current.delete(targetConversationId);
            if (isCurrentRequest()) setIsResumingRun(false);
          }
          return;
        }

        const detail = await getGuestConversation(targetConversationId, { force: true });
        if (!isCurrentRequest()) return;
        if (!detail.messages.length) {
          setMessages([createWelcomeMessage()]);
          rotateStarterPrompts();
          return;
        }
        setMessages(
          detail.messages.map((message) => ({
            id: message._id,
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: message.content,
            createdAt: new Date(message.createdAt).getTime(),
          })),
        );
      } catch {
        if (!isCurrentRequest()) return;
        setMessages([{
          id: `conversation-load-error-${targetConversationId}`,
          role: 'assistant',
          content: 'This conversation could not be loaded. Please select it again to retry.',
          createdAt: Date.now(),
        }]);
        setMessageReactions({});
      } finally {
        if (isCurrentRequest()) {
          setIsHydratingAuthChat(false);
        }
      }
    };

    void hydrateTarget();
    return () => {
      cancelled = true;
    };
  }, [
    applyDescriptiveAttachmentNames,
    applyWidgetSubmissionState,
    authConversationId,
    createWelcomeMessage,
    getDocumentWizardDraftKey,
    guestConversationId,
    isAuthenticated,
    mergeDocumentWizardDraftMessages,
    mapAuthMessageToUiMessage,
    params.conversationId,
    params.newChat,
    isDedicatedMediaScreen,
    rotateStarterPrompts,
  ]);

  useEffect(() => {
    if (isAuthenticated) return;
    setAttachmentMenuOpen(false);
    setIsRecording(false);
    setAttachedAssets([]);
    setComposerMediaReference(null);
    setAuthConversationId(null);
    setGuestConversationId(null);
    setMessages([createWelcomeMessage()]);
    rotateStarterPrompts();
  }, [createWelcomeMessage, isAuthenticated, rotateStarterPrompts]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const syncOffset = (screenY?: number, fallbackHeight?: number) => {
      const windowHeight = Dimensions.get('window').height;
      const keyboardHeight = Math.max(0, fallbackHeight ?? 0);
      if (typeof screenY === 'number') {
        const overlap = Math.max(0, windowHeight - screenY);
        const resolvedOffset = Math.max(overlap, keyboardHeight);
        setAndroidComposerOffset(Math.max(0, resolvedOffset - ANDROID_KEYBOARD_CALIBRATION));
        return;
      }
      setAndroidComposerOffset(Math.max(0, keyboardHeight - ANDROID_KEYBOARD_CALIBRATION));
    };

    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      syncOffset(event.endCoordinates.screenY, event.endCoordinates.height);
    });
    const changeSub = Keyboard.addListener('keyboardDidChangeFrame', (event) => {
      syncOffset(event.endCoordinates.screenY, event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setAndroidComposerOffset(0));

    return () => {
      showSub.remove();
      changeSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const EPSILON = 2;

    const syncOffset = (screenY?: number, fallbackHeight?: number) => {
      const windowHeight = Dimensions.get('window').height;
      const keyboardHeight = Math.max(0, fallbackHeight ?? 0);
      const updateOffset = (next: number) => {
        const rounded = Math.max(0, Math.round(next));
        setIosComposerOffset((prev) => (Math.abs(prev - rounded) <= EPSILON ? prev : rounded));
      };
      if (typeof screenY === 'number') {
        const overlap = Math.max(0, windowHeight - screenY);
        const resolvedOffset = Math.max(overlap, keyboardHeight);
        updateOffset(resolvedOffset - safeBottomInset);
        return;
      }
      updateOffset(keyboardHeight - safeBottomInset);
    };

    const showSub = Keyboard.addListener('keyboardWillShow', (event) => {
      syncOffset(event.endCoordinates.screenY, event.endCoordinates.height);
    });
    const changeSub = Keyboard.addListener('keyboardWillChangeFrame', (event) => {
      const height = event.endCoordinates.height ?? 0;
      if (height <= safeBottomInset + EPSILON) {
        setIosComposerOffset(0);
        return;
      }
      syncOffset(event.endCoordinates.screenY, event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      setIosComposerOffset(0);
    });

    return () => {
      showSub.remove();
      changeSub.remove();
      hideSub.remove();
    };
  }, [safeBottomInset]);

  useEffect(() => {
    if (!messages.length) return;
    if (!autoScrollEnabledRef.current) return;
    scrollToBottom(false);
  }, [messages]);

  useEffect(() => {
    if (!isAuthenticated) return;
    announceForA11y(
      attachmentMenuOpen
        ? screenConfig.attachmentMenuAnnouncement
        : 'Upload menu closed.',
    );
  }, [announceForA11y, attachmentMenuOpen, isAuthenticated, screenConfig.attachmentMenuAnnouncement]);

  useEffect(() => {
    if (!attachmentMenuOpen || !isAuthenticated) return;
    const timer = setTimeout(() => {
      const focusTarget = uploadImageOptionRef.current ?? (allowDocumentAttachment ? uploadDocumentOptionRef.current : uploadCancelOptionRef.current);
      focusAccessibilityNode(focusTarget);
    }, 180);
    return () => clearTimeout(timer);
  }, [allowDocumentAttachment, attachmentMenuOpen, isAuthenticated]);

  useEffect(() => {
    if (!uploadOptionModalVisible) return;
    const timer = setTimeout(() => {
      focusAccessibilityNode(takePhotoOptionRef.current ?? chooseGalleryOptionRef.current ?? chooserCancelOptionRef.current);
    }, 180);
    return () => clearTimeout(timer);
  }, [uploadOptionModalVisible]);

  useEffect(() => {
    if (activeModel === 'ultra' && !canUseUltraModel) {
      setActiveModel('smart');
    }
  }, [activeModel, canUseUltraModel]);

  const topBarModelSwitcher = isAuthenticated ? (
    <View className="flex-row items-center" style={{ gap: 8 }}>
      <NotificationBell isDark={isDark} onNavigate={(link) => router.push(resolveNotificationRoute(link) as never)} />
      {allArtifacts.length ? (
        <Pressable
          onPress={() => {
            hapticSelection();
            setArtifactsPanelOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Artifacts"
          className="h-8 w-8 items-center justify-center rounded-full border"
          style={{ borderColor: colors.primary, backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' }}
        >
          <Ionicons name="images-outline" size={16} color={colors.primary} />
        </Pressable>
      ) : null}
    <View
      className="relative rounded-full border px-1.5 py-1"
      style={{
        borderColor: topPillBorder,
        backgroundColor: topPillBg,
        zIndex: modelMenuOpen ? 120 : 1,
        elevation: modelMenuOpen ? 30 : 0,
      }}
    >
      <Pressable
        onPress={() => {
          hapticSelection();
          setModelMenuOpen((prev) => !prev);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('chat.model.select')}
        className="h-8 flex-row items-center rounded-full border px-3"
        style={{ borderColor: colors.primary, backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' }}
      >
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.1}
          style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}
        >
          {t(`chat.model.label.${activeModel}`)}
        </Text>
        <Ionicons
          name={modelMenuOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={14}
          color={colors.textSecondary}
          style={{ marginLeft: 6 }}
        />
      </Pressable>

      {modelMenuOpen ? (
        <Animated.View
          entering={FadeInDown.duration(MOTION.duration.normal)}
          className="absolute right-0 z-40 min-w-[240px] rounded-xl border p-1"
          style={{
            top: 44,
            zIndex: 80,
            elevation: 24,
            borderColor: topPillBorder,
            backgroundColor: isDark ? '#0B0B0B' : '#FFFFFF',
            shadowColor: '#000000',
            shadowOpacity: isDark ? 0.4 : 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
          }}
          onTouchStart={() => {
            menuTouchRef.current = true;
          }}
        >
          {availableChatModelOptions.map((model) => {
            const active = activeModel === model.key;
            const modelDescription = t(`chat.model.desc.${model.key}`);
            return (
              <Pressable
                key={model.key}
                onPress={() => {
                  hapticSelection();
                  setActiveModel(model.key as 'ultra' | 'smart' | 'swift');
                  setModelMenuOpen(false);
                }}
                className="rounded-lg px-3 py-2"
                style={{ backgroundColor: active ? `${colors.primary}1A` : 'transparent' }}
                accessibilityRole="button"
                accessibilityLabel={t('chat.model.accessibility', { model: t(`chat.model.label.${model.key}`) })}
                accessibilityHint={modelDescription}
              >
                <Text style={{ color: active ? colors.primary : colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
                  {t(`chat.model.label.${model.key}`)}
                </Text>
                <Text style={{ color: active ? colors.primary : colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                  {modelDescription}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
    </View>
  ) : undefined;

  return (
    <AppScreen
      title={t('app.name')}
      showHeading={false}
      contentTopOffset={-12}
      topAuthRightContent={topBarModelSwitcher}
      // Real fix: image-to-video and edit-image are dedicated "tool" entry
      // points into this same chat screen (screenMode), reached from the
      // Tools hub -- but this screen is also the drawer's default route
      // (plain chat), so it can't unconditionally show a back button.
      // Only the dedicated-tool modes get one, routed to Tools; plain chat
      // keeps the drawer toggle.
      onBackPress={isDedicatedMediaScreen ? () => router.replace('/(drawer)/tools') : undefined}
    >
      <Modal
        visible={uploadOptionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeUploadOptionModal}
        statusBarTranslucent
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.68)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            accessible={false}
            importantForAccessibility="no"
            onPress={closeUploadOptionModal}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          <Animated.View
            entering={FadeInDown.duration(MOTION.duration.normal)}
            accessibilityViewIsModal
            accessible
            accessibilityRole="menu"
            accessibilityLabel="Image upload options"
            accessibilityHint="Choose whether to take a photo or pick an image from your gallery."
            onAccessibilityEscape={closeUploadOptionModal}
            style={{
              backgroundColor: isDark ? '#0C0C0E' : '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: Math.max(insets.bottom + 16, 24),
              borderTopWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000000',
              shadowOpacity: 0.25,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: -4 },
              elevation: 20,
            }}
          >
            {/* Drag Handle */}
            <View
              style={{
                width: 42,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: 'center',
                marginBottom: 20,
                opacity: 0.6,
              }}
            />

            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: colors.textPrimary,
                marginBottom: 18,
                textAlign: 'center',
              }}
            >
              Upload Image
            </Text>

            <Pressable
              onPress={() => {
                setUploadOptionModalVisible(false);
                void takePhotoAttachment();
              }}
              ref={takePhotoOptionRef}
              focusable
              accessibilityRole="button"
              accessibilityLabel="Take a photo with camera"
              accessibilityHint="Opens the camera so you can capture an image to upload."
              className="flex-row items-center py-3.5 px-4 rounded-xl mb-3 border"
              style={{
                backgroundColor: isDark ? '#141416' : '#F9FAFB',
                borderColor: colors.border,
              }}
            >
              <Ionicons name="camera-outline" size={20} color={colors.primary} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.textPrimary,
                  marginLeft: 12,
                }}
              >
                Take a Photo
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setUploadOptionModalVisible(false);
                void pickAttachment();
              }}
              ref={chooseGalleryOptionRef}
              focusable
              accessibilityRole="button"
              accessibilityLabel="Choose an image from gallery"
              accessibilityHint="Opens your photo gallery so you can pick an image to upload."
              className="flex-row items-center py-3.5 px-4 rounded-xl mb-5 border"
              style={{
                backgroundColor: isDark ? '#141416' : '#F9FAFB',
                borderColor: colors.border,
              }}
            >
              <Ionicons name="images-outline" size={20} color={colors.primary} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.textPrimary,
                  marginLeft: 12,
                }}
              >
                Choose from Gallery
              </Text>
            </Pressable>

            <Pressable
              onPress={closeUploadOptionModal}
              ref={chooserCancelOptionRef}
              focusable
              accessibilityRole="button"
              accessibilityLabel="Cancel upload"
              accessibilityHint="Closes image upload options and returns to the composer."
              className="items-center py-3.5 px-4 rounded-xl"
              style={{
                backgroundColor: isDark ? '#222227' : '#E5E7EB',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.textPrimary,
                }}
              >
                Cancel
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={attachmentMenuOpen && screenMode !== 'image-to-video' && screenMode !== 'edit-image'}
        transparent
        animationType="fade"
        onRequestClose={closeAttachmentMenu}
        statusBarTranslucent
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.36)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            accessible={false}
            importantForAccessibility="no"
            onPress={closeAttachmentMenu}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          <Animated.View
            entering={FadeInDown.duration(MOTION.duration.normal)}
            accessibilityViewIsModal
            accessible
            accessibilityRole="menu"
            accessibilityLabel="Upload options"
            accessibilityHint="Choose image upload or document upload."
            onAccessibilityEscape={closeAttachmentMenu}
            style={{
              backgroundColor: isDark ? '#0C0C0E' : '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: Math.max(insets.bottom + 16, 24),
              borderTopWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000000',
              shadowOpacity: 0.2,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: -4 },
              elevation: 18,
            }}
          >
            <View
              style={{
                width: 42,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: 'center',
                marginBottom: 16,
                opacity: 0.6,
              }}
            />

            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: colors.textPrimary,
                marginBottom: 16,
                textAlign: 'center',
              }}
            >
              Upload
            </Text>

            <Pressable
              ref={uploadImageOptionRef}
              focusable
              onPress={() => {
                setAttachmentMenuOpen(false);
                setUploadOptionModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={screenConfig.attachImageLabel}
              accessibilityHint={screenConfig.attachImageHint}
              className="flex-row items-center rounded-xl border px-4 py-3.5 mb-3"
              style={{
                backgroundColor: isDark ? '#141416' : '#F9FAFB',
                borderColor: colors.border,
              }}
            >
              <Ionicons name="image-outline" size={18} color={colors.textPrimary} />
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginLeft: 12 }}>
                {screenConfig.attachImageLabel}
              </Text>
            </Pressable>

            <Pressable
              focusable
              onPress={() => {
                void pasteImageFromClipboard();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('chat.paste.menuLabel')}
              className="flex-row items-center rounded-xl border px-4 py-3.5 mb-3"
              style={{
                backgroundColor: isDark ? '#141416' : '#F9FAFB',
                borderColor: colors.border,
              }}
            >
              <Ionicons name="clipboard-outline" size={18} color={colors.textPrimary} />
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginLeft: 12 }}>
                {t('chat.paste.menuLabel')}
              </Text>
            </Pressable>

            {allowDocumentAttachment ? (
              <Pressable
                ref={uploadDocumentOptionRef}
                focusable
                onPress={handleDocumentUploadPress}
                accessibilityRole="button"
                accessibilityLabel={screenConfig.attachDocumentLabel}
                accessibilityHint={screenConfig.attachDocumentHint}
                className="flex-row items-center rounded-xl border px-4 py-3.5 mb-5"
                style={{
                  backgroundColor: isDark ? '#141416' : '#F9FAFB',
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginLeft: 12 }}>
                  {screenConfig.attachDocumentLabel}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              ref={uploadCancelOptionRef}
              focusable
              onPress={closeAttachmentMenu}
              accessibilityRole="button"
              accessibilityLabel="Cancel upload menu"
              accessibilityHint="Closes upload options and returns to the composer."
              className="items-center rounded-xl px-4 py-3.5"
              style={{
                backgroundColor: isDark ? '#222227' : '#E5E7EB',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                Cancel
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={!isAuthenticated && (guestUpsellVisible || guestAllowanceNotice !== null)}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (guestAllowanceNoticeIsLocked) return;
          setGuestUpsellVisible(false);
          setGuestAllowanceNotice(null);
        }}
        statusBarTranslucent
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(4, 6, 12, 0.58)',
            justifyContent: 'flex-end',
            paddingHorizontal: 0,
            paddingBottom: 0,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('modal.closeDialog')}
            onPress={() => {
              if (guestAllowanceNoticeIsLocked) return;
              setGuestUpsellVisible(false);
              setGuestAllowanceNotice(null);
            }}
            style={{ position: 'absolute', inset: 0 }}
          />

          <View
            accessibilityViewIsModal
            accessibilityRole="alert"
            style={{
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderWidth: 1.5,
              borderColor: colors.primary,
              backgroundColor: isDark ? '#101015' : '#FFFFFF',
              padding: 18,
              paddingBottom: Math.max(insets.bottom + 10, 18),
              shadowColor: '#000000',
              shadowOpacity: isDark ? 0.5 : 0.18,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 8,
            }}
          >
            <View className="mb-3 flex-row items-center">
              <View
                className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: `${colors.primary}24` }}
              >
                <AppLogo compact showWordmark={false} />
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', flex: 1 }}>
                {guestAllowanceNotice !== null ? guestAllowanceNoticeTitle : t('chat.guestUpsell.title')}
              </Text>
              {!guestAllowanceNoticeIsLocked ? (
                <Pressable
                  onPress={() => {
                    hapticSelection();
                    setGuestUpsellVisible(false);
                    setGuestAllowanceNotice(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.limit.dismiss')}
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: isDark ? '#0C0C0F' : '#F3F4F6' }}
                >
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>
              {guestAllowanceNotice !== null ? guestAllowanceNoticeBody : t('chat.guestUpsell.body')}
            </Text>

            <View className="mt-5 flex-row justify-end gap-2">
              {!guestAllowanceNoticeIsLocked ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.limit.dismiss')}
                  onPress={() => {
                    hapticSelection();
                    setGuestUpsellVisible(false);
                    setGuestAllowanceNotice(null);
                  }}
                  className="h-10 items-center justify-center rounded-full px-4"
                  style={{
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                    backgroundColor: isDark ? '#0C0C0F' : '#FFFFFF',
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                    {t('chat.limit.dismiss')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('auth.signup')}
                onPress={() => {
                  hapticSelection();
                  setGuestUpsellVisible(false);
                  setGuestAllowanceNotice(null);
                  router.push('/(auth)/signup');
                }}
                className="h-10 items-center justify-center rounded-full px-4"
                style={{
                  borderWidth: 1.5,
                  borderColor: colors.primary,
                  backgroundColor: isDark ? '#0C0C0F' : '#FFFFFF',
                }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>
                  {t('auth.signup')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('auth.login')}
                onPress={() => {
                  hapticSelection();
                  setGuestUpsellVisible(false);
                  setGuestAllowanceNotice(null);
                  router.push('/(auth)/login');
                }}
                className="h-10 items-center justify-center rounded-full px-4"
                style={{ backgroundColor: colors.primary }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                  {t('auth.login')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        enabled={false}
      >
          <View
            className="flex-1"
            onTouchEnd={() => {
              if (menuTouchRef.current) {
                menuTouchRef.current = false;
                return;
              }
              if (modelMenuOpen || attachmentMenuOpen) {
                setModelMenuOpen(false);
                setAttachmentMenuOpen(false);
              }
            }}
          >

            {!isAuthenticated ? (
              <Animated.View entering={FadeInDown.duration(MOTION.duration.normal)} className="mb-2 rounded-xl border px-3 py-2" style={{ borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {t('chat.guestNotice')}
                </Text>
              </Animated.View>
            ) : null}
            {isAuthenticated && !!readAloudSpeaker ? (
              <Animated.View
                entering={FadeInDown.duration(MOTION.duration.quick)}
                exiting={FadeOutDown.duration(MOTION.duration.quick)}
                className="mb-2 self-start rounded-full border px-3 py-1.5"
                style={{ borderColor: `${colors.primary}66`, backgroundColor: `${colors.primary}14` }}
              >
                <View className="flex-row items-center">
                  {isReadAloudLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="volume-high-outline" size={13} color={colors.primary} />
                  )}
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', marginLeft: 6 }}>
                    {isReadAloudLoading ? t('chat.voicePreparing') : readAloudSpeaker}
                  </Text>
                </View>
              </Animated.View>
            ) : null}
            {isAuthenticated && !!ttsToastNotice ? (
              <Animated.View
                entering={FadeInDown.duration(MOTION.duration.quick)}
                exiting={FadeOutDown.duration(MOTION.duration.quick)}
                className="mb-2 self-start rounded-xl border px-3 py-2"
                style={{ borderColor: '#F59E0B', backgroundColor: isDark ? 'rgba(120,53,15,0.28)' : 'rgba(255,237,213,0.95)' }}
              >
                <View className="flex-row items-center">
                  <Ionicons name="warning-outline" size={14} color="#F59E0B" />
                  <Text style={{ color: isDark ? '#FDE68A' : '#92400E', fontSize: 12, fontWeight: '600', marginLeft: 8 }}>
                    {ttsToastNotice}
                  </Text>
                </View>
              </Animated.View>
            ) : null}
            {isUnderstandingPrompt || !!streamingModelLabel || isResumingRun ? (
              <Animated.View
                entering={FadeInDown.duration(MOTION.duration.quick)}
                exiting={FadeOutDown.duration(MOTION.duration.quick)}
                className="mb-2 self-start"
                accessibilityHint={isUnderstandingPrompt ? 'Cafa AI is interpreting your request before sending it.' : undefined}
              >
                <ShimmerText
                  text={
                    isUnderstandingPrompt
                      ? `${t('chat.status.understanding')}…`
                      : streamingModelLabel
                        ? `${streamingModelLabel}…`
                        : `${t('chat.status.resuming')}…`
                  }
                  color={isDark ? '#9A9A9A' : '#6B6B6B'}
                  fontSize={14}
                />
              </Animated.View>
            ) : null}

            <View className="mb-2 items-center">
              <View
                className="h-1.5 rounded-full"
                style={{
                  width: 88,
                  backgroundColor: dividerPill,
                }}
              />
            </View>

            {isFreshChatState ? (
              <View className="mb-2">
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 6 }}>
                  {t('chat.starter.tap')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 2, gap: 8 }}
                >
                  {starterPrompts.map((prompt) => {
                    return (
                      <Pressable
                        key={prompt}
                        onPress={() => insertStarterPrompt(prompt)}
                        accessibilityRole="button"
                        accessibilityLabel={t('chat.quickPrompt.insert', { prompt })}
                        accessibilityHint={t('chat.quickPrompt.hint')}
                        className="rounded-2xl border px-3 py-2"
                        style={{
                          borderColor: colors.border,
                          backgroundColor: isDark ? '#111111' : '#F5F5F5',
                          maxWidth: Math.max(220, Math.min(296, screenWidth - 80)),
                        }}
                      >
                        <Text style={{ color: colors.textPrimary, fontSize: 12 }} numberOfLines={2}>
                          {prompt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <FlashList
              ref={messagesListRef}
              className="flex-1"
              getItemType={getMessageItemType}
              removeClippedSubviews={Platform.OS === 'android'}
              ListEmptyComponent={
                isAuthenticated && isHydratingAuthChat ? (
                  <View className="px-2 py-2">
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('drawer.loadingChats')}</Text>
                  </View>
                ) : null
              }
              data={visibleMessages}
              showsVerticalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingHorizontal: 2,
                paddingVertical: 6,
                paddingBottom: 72 + (keyboardComposerOffset > 0 ? 0 : Math.min(safeBottomInset, 8)),
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              scrollEventThrottle={16}
              onContentSizeChange={() => {
                if (autoScrollEnabledRef.current) {
                  scrollToBottom(false);
                }
              }}
              onScroll={(event) => {
                const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
                const isNearBottom = distanceFromBottom < 48;
                autoScrollEnabledRef.current = isNearBottom;
                const nextShow = !isNearBottom;
                if (showScrollButtonRef.current !== nextShow) {
                  showScrollButtonRef.current = nextShow;
                  setShowScrollToBottom(nextShow);
                }
              }}
              onScrollBeginDrag={() => Keyboard.dismiss()}
              renderItem={({ item }) => {
                const isUser = item.role === 'user';
                const reaction = messageReactions[item.id];
                const isReading = readingMessageId === item.id;
                const messageAttachments = item.attachments ?? [];
                const imageAttachments = messageAttachments.filter((attachment) => isImageAttachment(attachment));
                const fileAttachments = messageAttachments.filter((attachment) => !isImageAttachment(attachment));
                const isImageGenerating = !isUser && item.isImageGenerating && !item.imageUrl;
                const isVideoGenerating = !isUser && item.isVideoGenerating && !item.videoUrl;
                const isArtifactGenerating = !isUser && item.isArtifactGenerating && !item.videoUrl && !item.imageUrl;
                const isAnalyzing = !isUser && item.isAnalyzing;
                const hasDocumentArtifact = !isUser && (item.artifacts ?? []).some(
                  (artifact) => artifact.kind === 'document' && !artifact.generating && !artifact.failed,
                );
                // A generated PDF/DOCX can carry a thumbnail or legacy imageUrl in
                // the response. It is document metadata, not a standalone image to
                // show in the image lightbox. Rendering it as media produced the
                // large blank card and black fullscreen preview.
                const isImageMessage = !isUser && !hasDocumentArtifact && Boolean(item.imageUrl);
                const isVideoMessage = !isUser && !hasDocumentArtifact && Boolean(item.videoUrl);
                const isScreenHandoffMessage = !isUser && Boolean(item.screenHandoff);
                const isImageRequirementMessage = !isUser && Boolean(item.imageRequirement);
                const isDocumentWizardMessage = !isUser && Boolean(item.documentWizard);
                const isReferencedMediaHighlighted = highlightedReferencedMediaTarget?.messageId === item.id
                  && (
                    (highlightedReferencedMediaTarget.kind === 'image' && isImageMessage)
                    || (highlightedReferencedMediaTarget.kind === 'video' && isVideoMessage)
                  );
                const hasAttachmentPreviews = imageAttachments.length > 0 || fileAttachments.length > 0;
                const shouldRenderMixedAttachmentMessage =
                  !isUser
                  && hasAttachmentPreviews
                  && !isImageMessage
                  && !isVideoMessage;
                // The file card is the download, so the model's own "Download: [x.pdf](url)"
                // line (or a pasted file URL) is removed from the text shown under it.
                const generatedFileUrls = isUser
                  ? []
                  : [
                      ...(item.artifacts ?? [])
                        .filter((artifact) => artifact.kind === 'document' && artifact.url)
                        .map((artifact) => artifact.url as string),
                      ...fileAttachments
                        .filter((attachment) => isGeneratedDownloadableFileAttachment(attachment))
                        .map((attachment) => attachment.url as string),
                    ];
                const promptTitle = !isUser && generatedFileUrls.length
                  ? titleFromPrompt(
                      [...messages.slice(0, Math.max(0, messages.findIndex((message) => message.id === item.id)))]
                        .reverse()
                        .find((message) => message.role === 'user' && message.content.trim())?.content,
                    )
                  : undefined;
                const generatedDocument = isUser
                  ? undefined
                  : (item.artifacts ?? []).find((artifact) => artifact.kind === 'document' && artifact.url);
                const generatedAttachment = isUser
                  ? undefined
                  : fileAttachments.find((attachment) => isGeneratedDownloadableFileAttachment(attachment));
                const generatedFileAsset = {
                  url: generatedDocument?.url ?? generatedAttachment?.url,
                  name: generatedDocument?.name ?? generatedAttachment?.originalName,
                  mimeType: generatedDocument?.mimeType ?? generatedAttachment?.mimeType,
                  titleHint: generatedDocument?.titleHint ?? extractQuotedTitle(item.content) ?? promptTitle,
                };
                const isLiveReply = isSending && !isUser && item.id === messages[messages.length - 1]?.id;
                const cleanedReplyText = isUser ? item.content : sanitizeModelText(item.content, isLiveReply);
                const displayContent = generatedFileUrls.length
                  ? stripFileDownloadLinks(cleanedReplyText, generatedFileUrls, isLiveReply)
                  : cleanedReplyText;
                return (
                  <Animated.View entering={FadeInUp.duration(MOTION.duration.normal)} className={`flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <View
                      className={`${isUser ? 'max-w-[88%]' : 'w-[96%] max-w-[96%]'} rounded-2xl`}
                      style={highlightedMessageId === item.id
                        ? {
                            borderWidth: 1,
                            borderColor: `${colors.primary}88`,
                            backgroundColor: isDark ? 'rgba(95,127,184,0.14)' : 'rgba(32,64,121,0.08)',
                            padding: 4,
                          }
                        : undefined}
                    >
                      {isAnalyzing ? (
                        <View className="flex-row items-center rounded-2xl px-3 py-2" style={{ backgroundColor: isDark ? '#111111' : '#F5F5F5' }}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={{ marginLeft: 8, color: colors.textSecondary, fontSize: 13 }}>{t('chat.status.analyzing')}</Text>
                        </View>
                      ) : null}
                      {isImageGenerating ? (
                        <ImageGenerationPlaceholder
                          width={236}
                          height={248}
                          isDark={isDark}
                          accentColor={colors.primary}
                        />
                      ) : null}

                      {isVideoGenerating ? (
                        <>
                          <VideoGenerationPlaceholder
                            width={236}
                            height={133}
                            isDark={isDark}
                            accentColor={colors.primary}
                            timingNote={t('chat.videoGenerationTimingNote')}
                          />
                          <PushNudgeBanner isDark={isDark} />
                        </>
                      ) : null}

                      {isArtifactGenerating ? (
                        <FileGenerationPlaceholder
                          width={236}
                          height={116}
                          isDark={isDark}
                          accentColor={colors.primary}
                        />
                      ) : null}

                      {/* Real fix: generate_document's tool_end (ok:true) never
                          cleared the artifact's `generating` flag itself -- only
                          the later `media` event does, by filling in url/name.
                          Once it did, nothing ever rendered a "document ready"
                          card inline (only image/video get an inline bubble via
                          imageUrl/videoUrl) -- the assistant text was empty for
                          a document-only turn, so the message rendered as a
                          blank bubble. This card is that missing inline state;
                          the file was always saved server-side and reachable
                          via Artifacts, just never shown here. */}
                      {!isUser && !isArtifactGenerating ? (() => {
                        const readyDoc = [...(item.artifacts ?? [])]
                          .reverse()
                          .find((artifact) => artifact.kind === 'document' && !artifact.generating && artifact.url);
                        if (!readyDoc) return null;
                        return (
                          <FileCard
                            url={resolveBackendAssetUrl(readyDoc.url) ?? (readyDoc.url as string)}
                            name={readyDoc.name}
                            mimeType={readyDoc.mimeType}
                            titleHint={readyDoc.titleHint ?? extractQuotedTitle(item.content) ?? promptTitle}
                            formatHint={readyDoc.formatHint}
                          />
                        );
                      })() : null}

                      {isScreenHandoffMessage ? (
                        <ScreenHandoffCard
                          title={item.screenHandoff!.title}
                          description={item.screenHandoff!.description}
                          ctaLabel={item.screenHandoff!.ctaLabel}
                          iconName={item.screenHandoff!.iconName as keyof typeof Ionicons.glyphMap}
                          isDark={isDark}
                          colors={colors}
                          onPress={() => openHandoffTarget(item.screenHandoff!.target)}
                        />
                      ) : null}

                      {isImageRequirementMessage ? (
                        <ImageRequirementCard
                          title={item.imageRequirement!.title}
                          description={item.imageRequirement!.description}
                          ctaLabel={item.imageRequirement!.ctaLabel}
                          iconName={item.imageRequirement!.iconName as keyof typeof Ionicons.glyphMap}
                          isDark={isDark}
                          colors={colors}
                          onPress={handleUploadImagePress}
                        />
                      ) : null}

                      {isDocumentWizardMessage ? (
                        <DocumentWizardCard
                          html={item.documentWizard!.html}
                          documentType={item.documentWizard!.documentType}
                          format={item.documentWizard!.format}
                          conversationId={authConversationId ?? params.conversationId ?? null}
                          userMessageId={item.documentWizard!.userMessageId}
                          assistantMessageId={item.documentWizard!.assistantMessageId ?? item.id}
                          collapsed={item.documentWizard!.collapsed}
                          initialFormData={item.documentWizard!.formData}
                          isDark={isDark}
                          colors={colors}
                          onExpand={() => {
                            expandDocumentWizard(item.id);
                          }}
                          onFormDataChange={(formData) => {
                            updateDocumentWizardFormData(item.id, formData);
                          }}
                          onComplete={(artifacts) => {
                            handleDocumentWizardComplete(
                              item.id,
                              item.documentWizard!.documentType,
                              artifacts,
                            );
                          }}
                        />
                      ) : null}

                      {!isScreenHandoffMessage && !isImageRequirementMessage && !isDocumentWizardMessage && !isImageGenerating && !isVideoGenerating && !isArtifactGenerating && isImageMessage ? (
                        <View style={{ position: 'relative' }}>
                          <Pressable
                            onPress={() => {
                              if (item.imageUrl) setImageLightboxUri(item.imageUrl);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t('chat.generatedImageAlt')}
                          >
                            <View
                              className="overflow-hidden rounded-2xl border"
                              style={{
                                width: 236,
                                height: 248,
                                borderColor: colors.border,
                                backgroundColor: isDark ? '#101010' : '#FFFFFF',
                              }}
                            >
                              {(() => {
                                const source = resolveImageSource(item.imageUrl);
                                if (!source) {
                                  return <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 112 }} />;
                                }
                                return (
                                  <ExpoImage
                                    source={source}
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      bottom: 0,
                                      left: 0,
                                      right: 0,
                                      transform: [{ scale: 1.06 }],
                                    }}
                                    contentFit="cover"
                                    contentPosition="center"
                                    transition={0}
                                    accessible
                                    accessibilityLabel={item.imagePrompt?.trim()
                                      ? `${t('chat.generatedImageAlt')}: ${item.imagePrompt.trim()}`
                                      : t('chat.generatedImageAlt')}
                                  />
                                );
                              })()}
                            </View>
                          </Pressable>
                          {isReferencedMediaHighlighted ? (
                            <Animated.View
                              entering={FadeInDown.duration(180)}
                              exiting={FadeOutDown.duration(220)}
                              pointerEvents="none"
                              style={{ position: 'absolute', top: 8, right: 8 }}
                            >
                              <View
                                className="flex-row items-center rounded-full px-2 py-1"
                                style={{ backgroundColor: isDark ? 'rgba(32,64,121,0.94)' : 'rgba(32,64,121,0.9)' }}
                              >
                                <Ionicons name="arrow-down-circle" size={13} color="#FFFFFF" />
                                <Text style={{ marginLeft: 5, color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                                  Referenced
                                </Text>
                              </View>
                            </Animated.View>
                          ) : null}
                        </View>
                      ) : null}

                      {!isScreenHandoffMessage && !isImageRequirementMessage && !isDocumentWizardMessage && !isImageGenerating && !isVideoGenerating && !isArtifactGenerating && isVideoMessage ? (
                        <View style={{ position: 'relative' }}>
                          <ChatVideoCard
                            uri={item.videoUrl!}
                            width={236}
                            height={133}
                            borderColor={colors.border}
                            backgroundColor={isDark ? '#101010' : '#FFFFFF'}
                            accessibilityLabel={item.videoPrompt?.trim()
                              ? `${t('chat.generatedVideoAlt')}: ${item.videoPrompt.trim()}`
                              : t('chat.generatedVideoAlt')}
                          />
                          {isReferencedMediaHighlighted ? (
                            <Animated.View
                              entering={FadeInDown.duration(180)}
                              exiting={FadeOutDown.duration(220)}
                              pointerEvents="none"
                              style={{ position: 'absolute', top: 8, right: 8 }}
                            >
                              <View
                                className="flex-row items-center rounded-full px-2 py-1"
                                style={{ backgroundColor: isDark ? 'rgba(32,64,121,0.94)' : 'rgba(32,64,121,0.9)' }}
                              >
                                <Ionicons name="arrow-down-circle" size={13} color="#FFFFFF" />
                                <Text style={{ marginLeft: 5, color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                                  Referenced
                                </Text>
                              </View>
                            </Animated.View>
                          ) : null}
                        </View>
                      ) : null}

                      {!hasDocumentArtifact && !isScreenHandoffMessage && !isImageRequirementMessage && !isDocumentWizardMessage && !isImageGenerating && !isVideoGenerating && !isArtifactGenerating && (shouldRenderMixedAttachmentMessage || (!isImageMessage && !isVideoMessage)) && hasAttachmentPreviews ? (
                        <View className="mb-2 gap-1.5">
                          {!isImageMessage && !isVideoMessage ? imageAttachments.map((attachment, index) => {
                            const imageUri = resolveAttachmentPreviewUri(attachment);
                            if (!imageUri) return null;
                            const previewSource = resolveImageSource(imageUri);
                            return (
                              <Pressable
                                key={`${item.id}-img-${attachment.id ?? index}`}
                                onPress={() => setImageLightboxUri(imageUri)}
                                accessibilityRole="imagebutton"
                                accessibilityLabel={t('chat.attachmentPreviewA11y', { name: attachment.originalName ?? t('chat.uploadedImageAlt') })}
                                accessibilityHint={t('chat.attachmentPreviewHint')}
                                className="overflow-hidden rounded-2xl border"
                                style={{
                                  width: 236,
                                  height: 188,
                                  borderColor: colors.border,
                                  backgroundColor: isDark ? '#101010' : '#FFFFFF',
                                }}
                              >
                                {previewSource ? (
                                  <ExpoImage
                                    source={previewSource}
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      bottom: 0,
                                      left: 0,
                                      right: 0,
                                    }}
                                    contentFit="cover"
                                    contentPosition="center"
                                    transition={0}
                                    accessible
                                    accessibilityLabel={attachment.originalName ?? t('chat.attachImage')}
                                  />
                                ) : (
                                  <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 84 }} />
                                )}
                              </Pressable>
                            );
                          }) : null}

                          {fileAttachments.map((attachment, index) => {
                            const fileName = attachment.originalName ?? 'Attachment';
                            const lowerName = fileName.toLowerCase();
                            const isPdf = lowerName.endsWith('.pdf') || (attachment.mimeType ?? '').includes('pdf');
                            const isMarkdown = lowerName.endsWith('.md') || (attachment.mimeType ?? '').includes('markdown');
                            const isDoc = lowerName.endsWith('.doc') || lowerName.endsWith('.docx');
                            const attachmentId = attachment.id ?? `${item.id}-${fileName}`;
                            const isDownloadingAttachment = downloadingAttachmentId === attachmentId;
                            const showDownloadAction = !isUser && isGeneratedDownloadableFileAttachment(attachment);
                            if (showDownloadAction) {
                              return (
                                <FileCard
                                  key={`${item.id}-file-${attachment.id ?? index}`}
                                  url={resolveBackendAssetUrl(attachment.url) ?? (attachment.url as string)}
                                  name={attachment.originalName}
                                  mimeType={attachment.mimeType}
                                  titleHint={extractQuotedTitle(item.content) ?? promptTitle}
                                />
                              );
                            }
                            const iconName = isPdf
                              ? 'document-attach-outline'
                              : isMarkdown
                                ? 'document-outline'
                              : isDoc
                                ? 'document-text-outline'
                                : 'document-outline';
                            return (
                              <View
                                key={`${item.id}-file-${attachment.id ?? index}`}
                                className="flex-row items-center rounded-xl border px-3 py-2"
                                style={{
                                  borderColor: isUser ? `${colors.primary}99` : colors.border,
                                  backgroundColor: isUser ? colors.primary : isDark ? '#111111' : '#F5F5F5',
                                }}
                              >
                                <Ionicons name={iconName} size={16} color={isUser ? '#FFFFFF' : colors.textSecondary} />
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    marginLeft: 8,
                                    flex: 1,
                                    color: isUser ? '#FFFFFF' : colors.textPrimary,
                                    fontSize: 12,
                                    fontWeight: '600',
                                  }}
                                >
                                  {fileName}
                                </Text>
                                {showDownloadAction ? (
                                  <Pressable
                                    onPress={() => {
                                      void downloadGeneratedFileAttachment(attachment, item.id);
                                    }}
                                    disabled={isDownloadingAttachment}
                                    className="rounded-md px-2 py-1"
                                    style={{
                                      marginLeft: 8,
                                      backgroundColor: isUser ? 'rgba(255,255,255,0.18)' : (isDark ? '#1A1A1A' : '#EAEAEA'),
                                      opacity: isDownloadingAttachment ? 0.65 : 1,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: isUser ? '#FFFFFF' : colors.textPrimary,
                                        fontSize: 11,
                                        fontWeight: '700',
                                      }}
                                    >
                                      {isDownloadingAttachment ? 'Downloading...' : 'Download'}
                                    </Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      ) : null}

                      {!isUser && item.tools?.length ? (
                        <ToolStatusChips
                          tools={item.tools}
                          isDark={isDark}
                          onRetry={!isSending ? () => retryFromAssistantMessage(item.id) : undefined}
                        />
                      ) : null}

                      {!isUser && item.stopped ? (
                        <View className="mb-1 mt-1 self-start">
                          <View className="flex-row items-center">
                            <Ionicons name="stop-circle-outline" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
                              {t('chat.stopped')}
                            </Text>
                          </View>
                          {!isSending ? (
                            <Pressable
                              onPress={() => retryFromAssistantMessage(item.id)}
                              accessibilityRole="button"
                              accessibilityLabel={t('chat.tool.retry')}
                              hitSlop={8}
                              className="mt-1 flex-row items-center self-start rounded-full border px-3 py-1"
                              style={{ borderColor: colors.border }}
                            >
                              <Ionicons name="refresh" size={13} color={colors.textPrimary} />
                              <Text style={{ marginLeft: 6, color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                                {t('chat.tool.retry')}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}

                      {!isUser && item.upgradePrompt ? (
                        <UpgradePromptCard
                          reason={item.upgradePrompt.reason}
                          feature={item.upgradePrompt.feature}
                          isDark={isDark}
                        />
                      ) : null}

                      {!isUser && item.sandboxSessionId ? (
                        <SandboxBuildNotice isDark={isDark} />
                      ) : null}

                      {/* Real fix (2026-09-13): the native tool-calling video path
                          (generate_video/image_to_video) never sets the legacy
                          isVideoGenerating flag -- its live "in progress" signal is
                          a running tool call, not the older dedicated-video-screen
                          flow the nudge banner was originally wired to. Gate on
                          that real, current signal instead so the nudge actually
                          appears during an in-chat video generation. */}
                      {!isUser && item.tools?.some((tool) => tool.running && (tool.tool === 'generate_video' || tool.tool === 'image_to_video')) ? (
                        <PushNudgeBanner isDark={isDark} />
                      ) : null}

                      {!isAnalyzing && !isScreenHandoffMessage && !isImageRequirementMessage && !isDocumentWizardMessage && !isImageGenerating && !isVideoGenerating && !isArtifactGenerating && (shouldRenderMixedAttachmentMessage || (!isImageMessage && !isVideoMessage)) && (displayContent.trim() || !hasAttachmentPreviews) && (displayContent || isUser || !item.tools?.length) && !(item.stopped && !item.content.trim()) ? (
                        <View>
                          {isUser && item.referencedMedia ? (
                            <Pressable
                              onPress={() => jumpToReferencedMedia(item.referencedMedia!)}
                              accessibilityRole="button"
                              accessibilityLabel={t('chat.reference.jumpA11yLabel', { kind: item.referencedMedia.kind })}
                              accessibilityHint={t('chat.reference.jumpA11yHint')}
                              className="mb-1 self-end flex-row items-center rounded-full border px-2 py-1"
                              style={{ borderColor: colors.primary, backgroundColor: isDark ? '#112033' : '#EAF2FF' }}
                            >
                              <Ionicons
                                name={item.referencedMedia.kind === 'image' ? 'image-outline' : 'videocam-outline'}
                                size={12}
                                color={colors.primary}
                              />
                              <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700', marginLeft: 6 }}>
                                {t('chat.reference.bubbleChip', { kind: item.referencedMedia.kind })}
                              </Text>
                            </Pressable>
                          ) : null}
                          <View
                            className="rounded-2xl px-3 py-2"
                            style={{
                              backgroundColor: isUser ? colors.primary : isDark ? '#111111' : '#F5F5F5',
                            }}
                          >
                            {!displayContent && isSending && !isUser ? (
                              <TypingIndicator
                                color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)'}
                                accessibilityLabel={t('chat.status.thinking')}
                              />
                            ) : (() => {
                              const isLiveStreamingMessage = isSending
                                && !isUser
                                && item.id === messages[messages.length - 1]?.id;
                              const visibleContent = displayContent;
                              return (
                                <StreamingMarkdown
                                  content={visibleContent}
                                  isUser={isUser}
                                  isStreaming={isLiveStreamingMessage}
                                  onOpenLink={openInAppBrowser}
                                />
                              );
                            })()}
                          </View>
                        </View>
                      ) : null}

                      {!isUser && item.widget ? (
                        <AssistantWidget
                          spec={item.widget}
                          disabled={item.widgetDone}
                          isDark={isDark}
                          onSubmit={handleWidgetSubmit}
                        />
                      ) : null}

                      {!isUser
                        && item.quickReplies?.length
                        && !isSending
                        && item.id === messages[messages.length - 1]?.id ? (
                        <View className="mt-2 flex-row flex-wrap" style={{ gap: 6 }}>
                          {item.quickReplies.map((reply) => (
                            <Pressable
                              key={reply}
                              onPress={() => {
                                hapticSelection();
                                handleWidgetSubmit(reply);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={reply}
                              className="rounded-full border px-3 py-1.5"
                              style={{ borderColor: colors.border }}
                            >
                              <Text style={{ color: colors.textPrimary, fontSize: 12 }}>{reply}</Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}

                      {!isUser && item.products ? (
                        <ProductCards query={item.products.query} items={item.products.items} isDark={isDark} />
                      ) : null}

                      {!isUser && !isScreenHandoffMessage && !isImageRequirementMessage && !isDocumentWizardMessage && !isImageGenerating && isImageMessage ? (
                        <ImageMessageActionsRow
                          reaction={reaction}
                          primaryColor={colors.primary}
                          borderColor={colors.border}
                          iconColor={colors.textSecondary}
                          showReference={screenMode === 'chat'}
                          onCopyPrompt={() => {
                            void copyAssetMessage({ url: item.imageUrl });
                          }}
                          onLike={() => {
                            toggleLocalReaction(item.id, 'like');
                          }}
                          onUnlike={() => {
                            toggleLocalReaction(item.id, 'dislike');
                          }}
                          onDownload={() => {
                            void downloadImageMessage(item);
                          }}
                          onShare={() => {
                            void shareImageMessage(item);
                          }}
                          onReference={() => {
                            setComposerReferenceFromMessage(item, 'image');
                          }}
                          isShareBusy={sharingMediaMessageId === item.id}
                          onTooltip={showTooltip}
                          labels={{
                            copy: t('chat.tooltip.copyImage'),
                            copyHint: t('chat.tooltip.copyImage'),
                            like: t('chat.tooltip.like'),
                            likeHint: t('chat.tooltip.like'),
                            unlike: t('chat.tooltip.unlike'),
                            unlikeHint: t('chat.tooltip.unlike'),
                            download: t('chat.tooltip.downloadImage'),
                            downloadHint: t('chat.tooltip.downloadImage'),
                            share: t('chat.tooltip.share'),
                            shareHint: t('chat.tooltip.share'),
                            reference: t('chat.tooltip.referenceImage'),
                            referenceHint: t('chat.tooltip.referenceImageHint'),
                          }}
                        />
                      ) : null}

                      {!isUser && !isScreenHandoffMessage && !isImageRequirementMessage && !isDocumentWizardMessage && !isVideoGenerating && isVideoMessage ? (
                        <ImageMessageActionsRow
                          reaction={reaction}
                          primaryColor={colors.primary}
                          borderColor={colors.border}
                          iconColor={colors.textSecondary}
                          showReference={screenMode === 'chat'}
                          onCopyPrompt={() => {
                            void copyAssetMessage({ url: item.videoUrl });
                          }}
                          onLike={() => {
                            toggleLocalReaction(item.id, 'like');
                          }}
                          onUnlike={() => {
                            toggleLocalReaction(item.id, 'dislike');
                          }}
                          onDownload={() => {
                            void downloadVideoMessage(item);
                          }}
                          onShare={() => {
                            void shareVideoMessage(item);
                          }}
                          onReference={() => {
                            setComposerReferenceFromMessage(item, 'video');
                          }}
                          isShareBusy={sharingMediaMessageId === item.id}
                          onTooltip={showTooltip}
                          labels={{
                            copy: t('chat.tooltip.copyVideo'),
                            copyHint: t('chat.tooltip.copyVideo'),
                            like: t('chat.tooltip.like'),
                            likeHint: t('chat.tooltip.like'),
                            unlike: t('chat.tooltip.unlike'),
                            unlikeHint: t('chat.tooltip.unlike'),
                            download: t('chat.tooltip.downloadVideo'),
                            downloadHint: t('chat.tooltip.downloadVideo'),
                            share: t('chat.tooltip.share'),
                            shareHint: t('chat.tooltip.share'),
                            reference: t('chat.tooltip.referenceVideo'),
                            referenceHint: t('chat.tooltip.referenceVideoHint'),
                          }}
                        />
                      ) : null}

                      {!isUser && !isWelcomeMessage(item) && !isScreenHandoffMessage && !isImageRequirementMessage && !isDocumentWizardMessage && !isImageMessage && !isVideoMessage && (displayContent.trim() || generatedFileUrls.length > 0) ? (
                        <MessageActionsRow
                          isReading={isReading}
                          isReadingPaused={isReading && isReadAloudPaused}
                          reaction={reaction}
                          primaryColor={colors.primary}
                          borderColor={colors.border}
                          iconColor={colors.textSecondary}
                          onCopy={() => {
                            // A message with a generated file copies the FILE; plain replies copy their text.
                            if (generatedFileUrls.length) {
                              void copyAssetMessage(generatedFileAsset);
                              return;
                            }
                            void copyMessage(displayContent);
                          }}
                          onLike={() => {
                            void toggleReaction(item.id, 'like');
                          }}
                          onDislike={() => {
                            void toggleReaction(item.id, 'dislike');
                          }}
                          onShare={() => {
                            if (generatedFileUrls.length) {
                              void shareAssetMessage(generatedFileAsset);
                              return;
                            }
                            void shareMessage(displayContent);
                          }}
                          onReadAloud={() => toggleReadAloud(item.id, displayContent || item.content)}
                          onStopReadAloud={() => {
                            activeReadAloudRequestRef.current += 1;
                            stopReadAloudPlayback();
                          }}
                          onTooltip={showTooltip}
                          labels={{
                            copy: generatedFileUrls.length ? t('chat.tooltip.copyFile') : t('chat.tooltip.copyResponse'),
                            copyHint: generatedFileUrls.length ? t('chat.tooltip.copyFile') : t('chat.tooltip.copyResponse'),
                            like: t('chat.tooltip.like'),
                            likeHint: t('chat.tooltip.like'),
                            dislike: t('chat.tooltip.dislike'),
                            dislikeHint: t('chat.tooltip.dislike'),
                            share: t('chat.tooltip.share'),
                            shareHint: t('chat.tooltip.share'),
                            read: t('chat.tooltip.read'),
                            stopRead: t('chat.tooltip.stopRead'),
                            readHint: t('chat.tooltip.read'),
                            pauseRead: 'Pause reading',
                            resumeRead: 'Resume reading',
                          }}
                        />
                      ) : null}

                      {isUser && item.content.trim() ? (
                        <UserPromptActionsRow
                          borderColor={colors.border}
                          iconColor={colors.textSecondary}
                          onCopy={() => {
                            void copyMessage(item.content);
                          }}
                          onEdit={() => editPrompt(item.content)}
                          onTooltip={showTooltip}
                          labels={{
                            copy: t('chat.tooltip.copyPrompt'),
                            copyHint: t('chat.tooltip.copyPrompt'),
                            edit: t('chat.tooltip.editPrompt'),
                            editHint: t('chat.tooltip.editPrompt'),
                          }}
                        />
                      ) : null}
                    </View>
                  </Animated.View>
                );
              }}
            />
            <ImageLightbox
              visible={Boolean(imageLightboxUri)}
              uri={imageLightboxUri}
              headers={resolveImageSource(imageLightboxUri)?.headers}
              onClose={() => setImageLightboxUri(null)}
              accessibilityLabel={t('chat.generatedImageAlt')}
            />
            <ArtifactPanel
              visible={artifactsPanelOpen}
              artifacts={allArtifacts}
              onClose={() => setArtifactsPanelOpen(false)}
              onDownload={downloadArtifact}
              onOpenDocument={(artifact) => {
                const resolvedUrl = resolveBackendAssetUrl(artifact.url);
                if (!resolvedUrl) {
                  showTransientNotice('This document is not available right now.');
                  return;
                }
                void Linking.openURL(resolvedUrl).catch(() => {
                  void downloadArtifact(artifact);
                });
              }}
              onDelete={deleteArtifactAndUpdate}
              onSelect={
                screenMode !== 'chat'
                  ? (artifact) => {
                      if (!artifact.url) return;
                      setComposerMediaReference({ kind: artifact.kind === 'video' ? 'video' : 'image', id: artifact.id, url: artifact.url });
                      hapticSelection();
                      setArtifactsPanelOpen(false);
                    }
                  : undefined
              }
            />

            {showScrollToBottom ? (
              <Animated.View entering={FadeInUp.duration(MOTION.duration.quick)} exiting={FadeOutDown.duration(MOTION.duration.quick)}>
              <Pressable
                onPress={() => {
                  hapticSelection();
                  autoScrollEnabledRef.current = true;
                  setShowScrollToBottom(false);
                  scrollToBottom(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('chat.scrollLatest')}
                accessibilityHint={t('chat.scrollLatestHint')}
                className="absolute right-3 h-10 w-10 items-center justify-center rounded-full border"
                style={{
                  bottom: 96 + composerBottomInset,
                  borderColor: colors.border,
                  backgroundColor: isDark ? '#151515' : '#FFFFFF',
                }}
              >
                <Ionicons name="arrow-down" size={18} color={colors.textPrimary} />
              </Pressable>
              </Animated.View>
            ) : null}

            {sendQueue.length > 0 || isEditingPrompt ? (
              <View className="mt-2" style={{ gap: 6 }}>
                {isEditingPrompt ? (
                  <View
                    className="flex-row items-center rounded-xl border px-3 py-2"
                    style={{ borderColor: colors.border, backgroundColor: isDark ? '#111111' : '#F5F5F5' }}
                  >
                    <Ionicons name="create-outline" size={15} color={colors.textSecondary} />
                    <Text numberOfLines={1} style={{ flex: 1, marginLeft: 8, color: colors.textSecondary, fontSize: 13 }}>
                      {t('chat.edit.banner')}
                    </Text>
                    <Pressable
                      onPress={cancelEditingPrompt}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={t('chat.edit.cancel')}
                    >
                      <Ionicons name="close" size={18} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                ) : null}
                {sendQueue.map((queued, index) => (
                  <View
                    key={queued.id}
                    className="flex-row items-center rounded-xl border px-3 py-2"
                    style={{ borderColor: colors.border, backgroundColor: isDark ? '#111111' : '#F5F5F5' }}
                  >
                    <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
                    <Text numberOfLines={1} style={{ flex: 1, marginLeft: 8, color: colors.textPrimary, fontSize: 13 }}>
                      {queued.text || t('chat.queue.attachmentOnly')}
                    </Text>
                    <Text style={{ marginHorizontal: 8, color: colors.textSecondary, fontSize: 11 }}>
                      {index === 0 ? t('chat.queue.next') : t('chat.queue.queued')}
                    </Text>
                    <Pressable
                      onPress={() => removeQueuedSend(queued.id)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={t('chat.queue.remove')}
                    >
                      <Ionicons name="close" size={18} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <Animated.View
          layout={Platform.OS === 'ios' ? undefined : LinearTransition.springify().damping(24).stiffness(300).mass(0.72)}
          className="relative mt-2 rounded-[28px] border p-1.5"
          style={{
            borderColor: colors.primary,
            backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF',
            marginBottom: composerBottomInset,
          }}
        >
          {useCompactComposerPlaceholder && !input.trim() ? (
            <Text
              pointerEvents="none"
              accessible={false}
              style={{
                position: 'absolute',
                top: COMPOSER_VERTICAL_PADDING + 6,
                left: 12,
                right: isAuthenticated ? 52 : 16,
                color: colors.textSecondary,
                fontSize: 15,
                lineHeight: 21,
                zIndex: 1,
              }}
            >
              {composerPlaceholder}
            </Text>
          ) : null}

          <TextInput
            ref={composerInputRef}
            onFocus={attachPasteSupport}
            value={input}
            onChangeText={(text) => {
              inputValueRef.current = text;
              setInput(text);
              if (!text) {
                clearPromptSuggestions();
                setComposerHeight(COMPOSER_MIN_HEIGHT);
                setComposerScrollable(false);
              }
            }}
            placeholder={useCompactComposerPlaceholder ? '' : composerPlaceholder}
            placeholderTextColor={colors.textSecondary}
            editable
            multiline
            maxLength={3000}
            onContentSizeChange={(event) => {
              if (!inputValueRef.current.trim()) {
                setComposerHeight((prev) => (prev === COMPOSER_MIN_HEIGHT ? prev : COMPOSER_MIN_HEIGHT));
                setComposerScrollable(false);
                return;
              }
              const contentHeight = event.nativeEvent.contentSize.height ?? COMPOSER_MIN_HEIGHT;
              const measured = Math.ceil(contentHeight);

              if (Platform.OS === 'ios') {
                setComposerScrollable((prev) => {
                  const nextScrollable = measured >= COMPOSER_MAX_HEIGHT - 1;
                  return prev === nextScrollable ? prev : nextScrollable;
                });
                return;
              }

              const nextHeight = Math.min(
                COMPOSER_MAX_HEIGHT,
                Math.max(COMPOSER_MIN_HEIGHT, measured),
              );
              setComposerHeight((prev) => (Math.abs(prev - nextHeight) <= 1 ? prev : nextHeight));
              setComposerScrollable((prev) => {
                const nextScrollable = measured >= COMPOSER_MAX_HEIGHT - 1;
                return prev === nextScrollable ? prev : nextScrollable;
              });
            }}
            scrollEnabled={composerScrollable}
            accessibilityLabel={t('chat.input.accessibility')}
            className="px-1.5"
            style={{
              color: colors.textPrimary,
              fontSize: 15,
              lineHeight: 21,
              height: Platform.OS === 'ios' ? undefined : composerHeight,
              minHeight: COMPOSER_MIN_HEIGHT,
              maxHeight: COMPOSER_MAX_HEIGHT,
              paddingTop: COMPOSER_VERTICAL_PADDING,
              paddingBottom: COMPOSER_VERTICAL_PADDING,
              textAlignVertical: 'top',
              paddingRight: isAuthenticated ? 8 : 46,
            }}
          />

          {isAuthenticated && attachedAssets.length ? (
            <View className="mb-0.5 mt-0.5 flex-row flex-wrap items-center gap-1.5 px-1">
              {attachedAssets.map((asset) => (
                (asset.mimeType ?? '').toLowerCase().startsWith('image/') ? (
                  <View key={asset.id} style={{ width: 60, height: 60 }}>
                    <Pressable
                      onPress={() => setImageLightboxUri(asset.uri)}
                      accessibilityRole="imagebutton"
                      accessibilityLabel={t('chat.attachmentPreviewA11y', { name: asset.label })}
                      accessibilityHint={t('chat.attachmentPreviewHint')}
                      className="overflow-hidden rounded-xl border"
                      style={{ width: 60, height: 60, borderColor: colors.border }}
                    >
                      <ExpoImage
                        source={{ uri: asset.uri }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        transition={120}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => removeAttachment(asset.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('chat.removeAttachment')}: ${asset.label}`}
                      hitSlop={8}
                      className="absolute items-center justify-center rounded-full"
                      style={{ top: -6, right: -6, width: 20, height: 20, backgroundColor: isDark ? '#27272A' : '#3F3F46' }}
                    >
                      <Ionicons name="close" size={12} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ) : (
                <View
                  key={asset.id}
                  className="flex-row items-center rounded-full border px-2 py-0.5"
                  style={{ borderColor: colors.border }}
                >
                    <Text
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel={`Attached file: ${asset.label}`}
                      numberOfLines={1}
                      style={{ maxWidth: 140, color: colors.textSecondary, fontSize: 10 }}
                    >
                      {asset.label}
                    </Text>
                  <Pressable
                    onPress={() => removeAttachment(asset.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('chat.removeAttachment')}: ${asset.label}`}
                    accessibilityHint="Removes this file from your message."
                    className="ml-1 rounded-full p-0.5"
                  >
                    <Ionicons name="close" size={12} color={colors.textSecondary} />
                  </Pressable>
                </View>
                )
              ))}
            </View>
          ) : null}

          {isAuthenticated && composerMediaReference ? (
            <View className="mb-0.5 mt-0.5 flex-row flex-wrap gap-1.5 px-1">
              <View
                className="flex-row items-center rounded-full border px-2 py-0.5"
                style={{ borderColor: colors.primary, backgroundColor: isDark ? '#121A2A' : '#EAF2FF' }}
              >
                <Pressable
                  onPress={() => jumpToReferencedMedia(composerMediaReference)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.reference.composerA11yLabel', { kind: composerMediaReference.kind })}
                  accessibilityHint={t('chat.reference.jumpA11yHint')}
                  accessibilityLiveRegion="polite"
                  className="flex-row items-center"
                >
                  <Ionicons name={composerMediaReference.kind === 'image' ? 'image-outline' : 'videocam-outline'} size={12} color={colors.primary} />
                  <Text numberOfLines={1} style={{ maxWidth: 180, color: colors.primary, fontSize: 10, marginLeft: 6 }}>
                    {t('chat.reference.composerChip', { kind: composerMediaReference.kind })}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setComposerMediaReference(null);
                    announceForA11y(t('chat.reference.removed'));
                    hapticSelection();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.reference.removeA11yLabel', { kind: composerMediaReference.kind })}
                  accessibilityHint={t('chat.reference.removeA11yHint')}
                  className="ml-1 rounded-full p-0.5"
                >
                  <Ionicons name="close" size={12} color={colors.primary} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {uploadProgressPercent !== null ? (
            <View className="mx-1 mb-1 mt-1">
              <View className="flex-row items-center justify-between">
                <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Uploading...</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 10 }}>{uploadProgressPercent}%</Text>
              </View>
              <View className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }}>
                <View
                  className="h-full rounded-full"
                  style={{ width: `${uploadProgressPercent}%`, backgroundColor: colors.primary }}
                />
              </View>
            </View>
          ) : null}

          {dedicatedComposerHelperText ? (
            <View
              className="mx-1 mb-1 mt-1 rounded-xl border px-2 py-1"
              style={{
                borderColor: `${colors.primary}33`,
                backgroundColor: isDark ? 'rgba(95,127,184,0.10)' : 'rgba(95,127,184,0.08)',
              }}
            >
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: colors.textSecondary, fontSize: 9, lineHeight: 12 }}
              >
                {dedicatedComposerHelperText}
              </Text>
            </View>
          ) : null}

          {isAuthenticated ? (
            <View className=" flex-row items-center justify-between px-0.5 pb-0.5">
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={toggleRecording}
                  onLongPress={(event) =>
                    showTooltip(isRecording ? t('chat.tooltip.micStop') : t('chat.tooltip.micStart'), event)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={isRecording ? t('chat.mic.stop') : t('chat.mic.start')}
                  className="h-8 w-8 items-center justify-center rounded-full border"
                  style={{
                    borderColor: isRecording ? '#DC2626' : colors.border,
                    backgroundColor: isRecording ? '#DC2626' : 'transparent',
                  }}
                >
                  <Ionicons
                    name={isRecording ? 'stop' : 'mic-outline'}
                    size={14}
                    color={isRecording ? '#FFFFFF' : colors.textPrimary}
                  />
                </Pressable>

                <View>
                  <Pressable
                    ref={uploadTriggerButtonRef}
                    onPress={() => {
                      hapticSelection();
                      if (screenMode === 'image-to-video' || screenMode === 'edit-image') {
                        handleUploadImagePress();
                      } else {
                        setAttachmentMenuOpen((prev) => !prev);
                      }
                    }}
                    onLongPress={(event) =>
                      showTooltip(
                        screenMode === 'image-to-video' || screenMode === 'edit-image'
                          ? screenConfig.attachImageLabel
                          : t('chat.tooltip.attach'),
                        event
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                      screenMode === 'image-to-video' || screenMode === 'edit-image'
                        ? screenConfig.attachImageLabel
                        : screenConfig.uploadTriggerLabel
                    }
                    accessibilityHint={
                      screenMode === 'image-to-video' || screenMode === 'edit-image'
                        ? screenConfig.attachImageHint
                        : attachmentMenuOpen
                        ? 'Closes upload options.'
                        : screenConfig.uploadTriggerHint
                    }
                    accessibilityState={{
                      expanded: screenMode === 'image-to-video' || screenMode === 'edit-image' ? undefined : attachmentMenuOpen,
                    }}
                    className={
                      screenMode === 'image-to-video' || screenMode === 'edit-image'
                        ? "h-8 px-3 flex-row items-center justify-center rounded-full border"
                        : "h-8 w-8 items-center justify-center rounded-full border"
                    }
                    style={{ borderColor: colors.border }}
                    >
                      <Ionicons
                        name={screenMode === 'image-to-video' || screenMode === 'edit-image' ? 'image-outline' : 'attach-outline'}
                        size={14}
                      color={colors.textPrimary}
                    />
                    {screenMode === 'image-to-video' || screenMode === 'edit-image' ? (
                      <Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: '600', marginLeft: 6 }}>
                        Upload image
                      </Text>
                    ) : null}
                  </Pressable>
                </View>

                {screenMode === 'chat' ? (
                  <>
                    <Pressable
                      onPress={applyRandomImagePrompt}
                      disabled={tier === 'free'}
                      onLongPress={(event) =>
                        showTooltip(tier === 'free' ? 'Upgrade to generate images' : 'Image generation shortcut', event)
                      }
                      accessibilityRole="button"
                      accessibilityLabel="Image generation shortcut"
                      className="h-8 px-2 flex-row items-center justify-center rounded-full border"
                      style={{ borderColor: colors.border, opacity: tier === 'free' ? 0.55 : 1 }}
                    >
                      <Ionicons name="image-outline" size={14} color={colors.textPrimary} />
                    </Pressable>
                    <Pressable
                      onPress={applyRandomVideoPrompt}
                      onLongPress={(event) => showTooltip('Video generation shortcut', event)}
                      accessibilityRole="button"
                      accessibilityLabel="Video generation shortcut"
                      className="h-8 px-2 flex-row items-center justify-center rounded-full border"
                      style={{ borderColor: colors.border }}
                    >
                      <Ionicons name="videocam-outline" size={14} color={colors.textPrimary} />
                    </Pressable>
                  </>
                ) : null}

                {screenMode === 'chat' ? (
                  <CafaLiveToggle
                    isDark={isDark}
                    onLongPress={(event) => showTooltip(t('chat.cafaLive.tooltip'), event)}
                  />
                ) : null}
              </View>

              {renderSendButton('h-10 w-10 items-center justify-center rounded-full')}
            </View>
          ) : (
            renderSendButton('absolute bottom-2 right-2 h-10 w-10 items-center justify-center rounded-full')
          )}

          {isRecording ? (
            <Animated.View
              entering={FadeInDown.duration(MOTION.duration.quick)}
              className="mt-1 flex-row items-center rounded-xl border px-2.5 py-1.5"
              style={{ borderColor: `${colors.primary}99`, backgroundColor: `${colors.primary}17` }}
            >
              <RecordingWaves color={colors.primary} />
            </Animated.View>
          ) : null}
            </Animated.View>

            {!!statusNotice ? (
              <Animated.View
                entering={FadeInUp.duration(MOTION.duration.quick)}
                exiting={FadeOutDown.duration(MOTION.duration.quick)}
                pointerEvents={upgradeNoticeKind ? 'auto' : 'none'}
                className="absolute left-3 right-3 rounded-2xl border px-3 py-2"
                style={{
                  bottom: 102 + composerBottomInset,
                  borderColor: upgradeNoticeKind === 'image'
                    ? '#8B5CF6'
                    : upgradeNoticeKind === 'video'
                      ? '#F97316'
                      : colors.primary,
                  backgroundColor: upgradeNoticeKind === 'image'
                    ? (isDark ? 'rgba(38,24,62,0.98)' : 'rgba(250,245,255,0.98)')
                    : upgradeNoticeKind === 'video'
                      ? (isDark ? 'rgba(55,29,16,0.98)' : 'rgba(255,247,237,0.98)')
                      : (isDark ? 'rgba(23,23,28,0.96)' : 'rgba(255,255,255,0.98)'),
                }}
              >
                <View className="flex-row items-start">
                  <View
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: upgradeNoticeKind === 'image'
                        ? 'rgba(139,92,246,0.16)'
                        : upgradeNoticeKind === 'video'
                          ? 'rgba(249,115,22,0.16)'
                          : `${colors.primary}20`,
                    }}
                  >
                    <Ionicons
                      name={upgradeNoticeKind === 'image'
                        ? 'image-outline'
                        : upgradeNoticeKind === 'video'
                          ? 'videocam-outline'
                          : upgradeNoticeKind === 'chat'
                            ? 'chatbubbles-outline'
                            : 'information-circle-outline'}
                      size={16}
                      color={upgradeNoticeKind === 'image' ? '#8B5CF6' : upgradeNoticeKind === 'video' ? '#F97316' : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 9 }}>
                    {upgradeNoticeKind ? (
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>
                        {upgradeNoticeKind === 'image'
                          ? 'Image limit reached'
                          : upgradeNoticeKind === 'video'
                            ? 'Video limit reached'
                            : 'Chat limit reached'}
                      </Text>
                    ) : null}
                    <Text style={{ color: colors.textPrimary, fontSize: 12, marginTop: upgradeNoticeKind ? 2 : 0, lineHeight: 17 }}>
                      {statusNotice}
                    </Text>
                    {upgradeNoticeKind && upgradeNoticeResetHours !== null ? (
                      <View
                        className="mt-2 self-start rounded-full px-2.5 py-1"
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }}
                      >
                        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                          Resets in {formatLimitResetDuration(upgradeNoticeResetHours)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                {upgradeNoticeKind ? (
                  <View className="mt-2 flex-row flex-wrap items-center gap-2">
                    {canWatchRewardedAds
                      && rewardAdOffer?.kind === upgradeNoticeKind
                      && rewardAdOffer.available === true ? (
                      <Pressable
                        onPress={() => {
                          hapticSelection();
                          void watchAdForLimitReward();
                        }}
                        disabled={isRewardAdProcessing}
                        accessibilityRole="button"
                        accessibilityLabel={`Watch an ad for ${AD_REWARD_GRANTS[upgradeNoticeKind]} extra ${upgradeNoticeKind} credits`}
                        className="h-8 items-center justify-center rounded-full px-3"
                        style={{ backgroundColor: '#16A34A', opacity: isRewardAdProcessing ? 0.7 : 1 }}
                      >
                        {isRewardAdProcessing ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                            Watch ad · +{AD_REWARD_GRANTS[upgradeNoticeKind]} {upgradeNoticeKind === 'chat' ? 'prompts' : 'generation'}
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => {
                        hapticSelection();
                        setStatusNotice('');
                        setUpgradeNoticeKind(null);
                        setUpgradeNoticeResetHours(null);
                        router.push(upgradeNoticeIsCredits ? '/billing/credits' : '/plans');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t(upgradeNoticeIsCredits ? 'chat.limit.buyCreditsCta' : 'chat.limit.upgradeCta')}
                      className="h-8 items-center justify-center rounded-full px-3"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                        {t(upgradeNoticeIsCredits ? 'chat.limit.buyCreditsCta' : 'chat.limit.upgradeCta')}
                      </Text>
                    </Pressable>
                    {Platform.OS === 'ios' && isAuthenticated ? (
                      <Pressable
                        onPress={() => {
                          hapticSelection();
                          void restorePurchasesAndSyncFromLimitNotice();
                        }}
                        disabled={isLimitRestoreSyncing}
                        accessibilityRole="button"
                        accessibilityLabel={t('chat.limit.restoreSync')}
                        className="h-8 items-center justify-center rounded-full px-3"
                        style={{
                          borderWidth: 1,
                          borderColor: colors.primary,
                          opacity: isLimitRestoreSyncing ? 0.7 : 1,
                        }}
                      >
                        {isLimitRestoreSyncing ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                            {t('chat.limit.restoreSync')}
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => {
                        hapticSelection();
                        setStatusNotice('');
                        setUpgradeNoticeKind(null);
                        setUpgradeNoticeResetHours(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('chat.limit.dismiss')}
                      className="h-8 items-center justify-center rounded-full px-3"
                      style={{ borderWidth: 1, borderColor: colors.border }}
                    >
                      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                        {t('chat.limit.dismiss')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            {!!downloadToastNotice ? (
              <Animated.View
                entering={ZoomIn.duration(MOTION.duration.quick)}
                exiting={ZoomOut.duration(MOTION.duration.quick)}
                pointerEvents="none"
                className="absolute left-3 right-3 rounded-2xl border px-3 py-2.5"
                style={{
                  bottom: 154 + composerBottomInset,
                  borderColor: '#22C55E',
                  backgroundColor: isDark ? 'rgba(6,78,59,0.95)' : 'rgba(236,253,245,0.98)',
                }}
              >
                <View className="flex-row items-center">
                  <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(34,197,94,0.2)' }}>
                    <Ionicons name="checkmark-done" size={14} color="#22C55E" />
                  </View>
                  <Text style={{ color: isDark ? '#D1FAE5' : '#065F46', fontSize: 12, fontWeight: '700', marginLeft: 8 }}>
                    {downloadToastNotice}
                  </Text>
                  <Ionicons name="download-outline" size={14} color="#22C55E" style={{ marginLeft: 'auto' }} />
                </View>
              </Animated.View>
            ) : null}

            {tooltipState ? (
              <Animated.View
                entering={FadeIn.duration(MOTION.duration.quick)}
                pointerEvents="none"
                className="absolute rounded-md px-2 py-1"
                style={{
                  zIndex: 9999,
                  elevation: 120,
                  borderWidth: 1,
                  borderColor: isDark ? '#3F3F46' : '#27272A',
                  backgroundColor: isDark ? '#0B0B0F' : '#111111',
                  left: Math.max(8, Math.min(tooltipState.x - 56, screenWidth - 124)),
                  top: Math.max(8, tooltipState.y - 40),
                }}
              >
        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>{tooltipState.text}</Text>
              </Animated.View>
            ) : null}
          </View>
      </KeyboardAvoidingView>
      <AppPromptModal
        visible={documentFormWarningVisible}
        title="Unfinished form"
        message="You still have a document form open in this chat. Keep filling it, ignore it for now, or cancel the form permanently."
        confirmLabel="Ignore for now"
        cancelLabel="Keep filling"
        tertiaryLabel="Discard form"
        iconName="document-text-outline"
        onCancel={continueDocumentWizard}
        onTertiary={cancelAllDocumentWizards}
        onConfirm={() => {
          setDocumentFormWarningVisible(false);
          handleSend({ skipDocumentFormWarning: true });
        }}
      />
    </AppScreen>
  );
}

import { API_BASE_URL } from '@/lib';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearGuestSessionStorage,
  getGuestSessionExpiresAt,
  getGuestSessionToken,
  setGuestSessionExpiresAt,
  setGuestSessionToken,
} from '@/services/storage';

type GuestSessionPayload = {
  guestSessionToken: string;
  sessionId: string;
  expiresAt: string;
  limits: {
    maxMessagesPerDay: number;
    maxConversations: number;
    maxMessageLength: number;
    allowedModels: string[];
  };
  features: {
    streaming: boolean;
    attachments: boolean;
    imageGeneration: boolean;
    videoGeneration: boolean;
    voice: boolean;
  };
};

type GuestConversationSummary = {
  _id: string;
  title: string;
  aiModel: string;
  lastMessagePreview?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

type GuestConversationDetail = GuestConversationSummary & {
  messages: Array<{
    _id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
  }>;
};

type GuestApiResponse<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
};

type GuestStreamEvent =
  | { type: 'meta'; model?: string; messageId?: string; requestId?: string; timestamp?: string }
  | { type: 'delta'; content: string; requestId?: string; timestamp?: string }
  | { type: 'done'; tokens?: number; messageId?: string; requestId?: string; timestamp?: string }
  | { type: 'error'; code?: string; message: string; requestId?: string; timestamp?: string };

type GuestApiError = Error & { code?: string; status?: number };
type GuestCacheOptions = { force?: boolean };

let sessionCache: GuestSessionPayload | null = null;
let sessionPromise: Promise<GuestSessionPayload> | null = null;
let guestApiUnavailableError: GuestApiError | null = null;
const GUEST_LIST_TTL_MS = 20_000;
const GUEST_DETAIL_TTL_MS = 12_000;
let guestListCache: { value: GuestConversationSummary[]; expiresAt: number } | null = null;
let guestListPromise: Promise<GuestConversationSummary[]> | null = null;
const guestDetailCache = new Map<string, { value: GuestConversationDetail; expiresAt: number }>();
const guestDetailPromises = new Map<string, Promise<GuestConversationDetail>>();

const GUEST_MODEL = 'gpt-4o-mini';
const FALLBACK_CHUNK_SIZE = 6;
const FALLBACK_CHUNK_DELAY_MS = 12;
const GUEST_LAST_ERROR_KEY = 'cafa_ai_guest_last_error_v1';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLikelyExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() - Date.now() < 45_000;
}

function toGuestApiError(message: string, code?: string, status?: number): GuestApiError {
  const error = new Error(message) as GuestApiError;
  error.code = code;
  error.status = status;
  return error;
}

async function persistGuestErrorLog(details: {
  phase: string;
  endpoint: string;
  message: string;
  code?: string;
  status?: number;
  requestId?: string | null;
  rawBodySnippet?: string | null;
  responseContentType?: string | null;
  responseServer?: string | null;
  responseCfRay?: string | null;
}) {
  const payload = {
    ...details,
    at: new Date().toISOString(),
  };
  try {
    await AsyncStorage.setItem(GUEST_LAST_ERROR_KEY, JSON.stringify(payload));
  } catch {
    // Best-effort diagnostics only.
  }
  console.log('[guest:error]', payload);
}

export async function getLastGuestErrorLog() {
  const raw = await AsyncStorage.getItem(GUEST_LAST_ERROR_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      at: string;
      phase: string;
      endpoint: string;
      message: string;
      code?: string;
      status?: number;
      requestId?: string | null;
      rawBodySnippet?: string | null;
      responseContentType?: string | null;
      responseServer?: string | null;
      responseCfRay?: string | null;
    };
  } catch {
    return null;
  }
}

function cloneGuestSummaryList(list: GuestConversationSummary[]) {
  return list.map((item) => ({ ...item }));
}

function cloneGuestDetail(detail: GuestConversationDetail): GuestConversationDetail {
  return {
    ...detail,
    messages: detail.messages.map((item) => ({ ...item })),
  };
}

export function invalidateGuestChatCache(conversationId?: string) {
  if (conversationId) {
    guestDetailCache.delete(conversationId);
    guestDetailPromises.delete(conversationId);
    return;
  }
  guestListCache = null;
  guestListPromise = null;
  guestDetailCache.clear();
  guestDetailPromises.clear();
}

async function parseGuestResponseError(response: Response, fallback: string, endpoint?: string) {
  const rawText = await response.text().catch(() => '');
  const requestId = response.headers.get('x-request-id') ?? response.headers.get('x-correlation-id');
  const payload = (() => {
    if (!rawText) return null;
    try {
      return JSON.parse(rawText) as GuestApiResponse<unknown>;
    } catch {
      return null;
    }
  })();
  const backendMessage = (payload?.message ?? rawText.trim())
    || `${fallback} (HTTP ${response.status}${requestId ? `, requestId: ${requestId}` : ''})`;
  const backendCode = payload?.code ?? payload?.error;
  void persistGuestErrorLog({
    phase: 'http_error_response',
    endpoint: endpoint ?? 'unknown',
    message: backendMessage,
    code: backendCode,
    status: response.status,
    requestId,
    rawBodySnippet: rawText ? rawText.slice(0, 500) : null,
    responseContentType: response.headers.get('content-type'),
    responseServer: response.headers.get('server'),
    responseCfRay: response.headers.get('cf-ray'),
  });

  if (response.status === 404 && (backendCode === 'NOT_FOUND' || endpoint?.includes('/guest/'))) {
    const message = 'Guest mode is currently unavailable. Please try again later.';
    return toGuestApiError(message, 'GUEST_ENDPOINT_UNAVAILABLE', response.status);
  }

  return toGuestApiError(backendMessage, backendCode, response.status);
}

async function createGuestSession(): Promise<GuestSessionPayload> {
  const endpoint = `${API_BASE_URL}/guest/session`;
  const response = await fetch(endpoint, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await parseGuestResponseError(response, 'Could not create guest session.', endpoint);
    if (error.code === 'GUEST_ENDPOINT_UNAVAILABLE') {
      guestApiUnavailableError = error;
    }
    throw error;
  }

  const payload = (await response.json()) as GuestApiResponse<GuestSessionPayload>;
  if (!payload?.success || !payload.data?.guestSessionToken || !payload.data.expiresAt) {
    throw toGuestApiError(payload?.message ?? 'Invalid guest session response.');
  }

  sessionCache = payload.data;
  await Promise.all([
    setGuestSessionToken(payload.data.guestSessionToken),
    setGuestSessionExpiresAt(payload.data.expiresAt),
  ]);

  return payload.data;
}

export async function ensureGuestSession() {
  if (guestApiUnavailableError) {
    throw guestApiUnavailableError;
  }

  if (sessionCache?.guestSessionToken && !isLikelyExpired(sessionCache.expiresAt)) {
    return sessionCache;
  }

  if (!sessionPromise) {
    sessionPromise = (async () => {
      const [storedToken, storedExpiresAt] = await Promise.all([getGuestSessionToken(), getGuestSessionExpiresAt()]);
      if (storedToken && storedExpiresAt && !isLikelyExpired(storedExpiresAt)) {
        sessionCache = {
          guestSessionToken: storedToken,
          sessionId: 'stored',
          expiresAt: storedExpiresAt,
          limits: {
            maxMessagesPerDay: 30,
            maxConversations: 20,
            maxMessageLength: 10000,
            allowedModels: [GUEST_MODEL],
          },
          features: {
            streaming: true,
            attachments: false,
            imageGeneration: false,
            videoGeneration: false,
            voice: false,
          },
        };
        return sessionCache;
      }
      return createGuestSession();
    })().finally(() => {
      sessionPromise = null;
    });
  }

  return sessionPromise;
}

async function withGuestAuth(
  path: string,
  init: RequestInit = {},
  retryOnInvalidSession = true,
): Promise<Response> {
  const session = await ensureGuestSession();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.guestSessionToken}`);

  const endpoint = `${API_BASE_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(endpoint, { ...init, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed.';
    void persistGuestErrorLog({
      phase: 'fetch_initial',
      endpoint,
      message,
      code: 'GUEST_NETWORK_ERROR',
    });
    throw toGuestApiError(
      `Guest request failed before reaching server (${message}). Endpoint: ${endpoint}`,
      'GUEST_NETWORK_ERROR',
    );
  }
  if (!retryOnInvalidSession) return response;

  const payload = (await response.clone().json().catch(() => null)) as GuestApiResponse<unknown> | null;
  const code = `${payload?.code ?? payload?.error ?? ''}`.toUpperCase();
  const shouldRefreshGuestToken =
    code === 'GUEST_TOKEN_INVALID'
    || code === 'GUEST_AUTH_REQUIRED'
    || code === 'GUEST_SESSION_EXPIRED';
  if (!shouldRefreshGuestToken) {
    return response;
  }

  sessionCache = null;
  await clearGuestSessionStorage();
  const fresh = await createGuestSession();
  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('Authorization', `Bearer ${fresh.guestSessionToken}`);
  try {
    return await fetch(endpoint, { ...init, headers: retryHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed.';
    void persistGuestErrorLog({
      phase: 'fetch_retry',
      endpoint,
      message,
      code: 'GUEST_NETWORK_ERROR',
    });
    throw toGuestApiError(
      `Guest retry request failed (${message}). Endpoint: ${endpoint}`,
      'GUEST_NETWORK_ERROR',
    );
  }
}

export async function createGuestConversation(title?: string) {
  const response = await withGuestAuth('/guest/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(title ? { title } : {}),
  });

  if (!response.ok) {
    throw await parseGuestResponseError(response, 'Could not create guest conversation.', `${API_BASE_URL}/guest/chat`);
  }

  const payload = (await response.json()) as GuestApiResponse<{
    conversationId: string;
    title: string;
    aiModel: string;
    expiresAt: string;
  }>;

  if (!payload?.success || !payload.data?.conversationId) {
    throw toGuestApiError(payload?.message ?? 'Invalid guest conversation response.');
  }

  invalidateGuestChatCache();
  return payload.data;
}

export async function listGuestConversations(options?: GuestCacheOptions) {
  const force = options?.force ?? false;
  const now = Date.now();
  if (!force && guestListCache && guestListCache.expiresAt > now) {
    return cloneGuestSummaryList(guestListCache.value);
  }
  if (!force && guestListPromise) {
    return guestListPromise;
  }

  guestListPromise = (async () => {
    const response = await withGuestAuth('/guest/chat');
    if (!response.ok) {
      throw await parseGuestResponseError(response, 'Could not load guest conversations.', `${API_BASE_URL}/guest/chat`);
    }

    const payload = (await response.json()) as GuestApiResponse<GuestConversationSummary[]>;
    if (!payload?.success || !Array.isArray(payload.data)) {
      throw toGuestApiError(payload?.message ?? 'Invalid guest conversation list response.');
    }

    guestListCache = { value: payload.data, expiresAt: Date.now() + GUEST_LIST_TTL_MS };
    return cloneGuestSummaryList(payload.data);
  })().finally(() => {
    guestListPromise = null;
  });

  return guestListPromise;
}

export async function getGuestConversation(conversationId: string, options?: GuestCacheOptions) {
  const force = options?.force ?? false;
  const now = Date.now();
  const cached = guestDetailCache.get(conversationId);
  if (!force && cached && cached.expiresAt > now) {
    return cloneGuestDetail(cached.value);
  }
  if (!force && guestDetailPromises.has(conversationId)) {
    return guestDetailPromises.get(conversationId)!;
  }

  const detailPromise = (async () => {
    const response = await withGuestAuth(`/guest/chat/${conversationId}`);
    if (!response.ok) {
      throw await parseGuestResponseError(response, 'Could not load guest conversation.', `${API_BASE_URL}/guest/chat/${conversationId}`);
    }

    const payload = (await response.json()) as GuestApiResponse<GuestConversationDetail>;
    if (!payload?.success || !payload.data?._id) {
      throw toGuestApiError(payload?.message ?? 'Invalid guest conversation detail response.');
    }

    guestDetailCache.set(conversationId, { value: payload.data, expiresAt: Date.now() + GUEST_DETAIL_TTL_MS });
    return cloneGuestDetail(payload.data);
  })().finally(() => {
    guestDetailPromises.delete(conversationId);
  });

  guestDetailPromises.set(conversationId, detailPromise);
  return detailPromise;
}

export async function sendGuestMessageStream(
  conversationId: string,
  message: string,
  onEvent: (event: GuestStreamEvent) => void,
  _idempotencyKey: string,
  _language: 'en' | 'fr' | 'es' | 'pt' = 'en',
) {
  invalidateGuestChatCache(conversationId);
  guestListCache = null;
  const emitReplayPayload = async (
    payload: GuestApiResponse<{
      replayed?: boolean;
      messageId?: string;
      requestId?: string;
      message?: {
        _id?: string;
        content?: string;
      };
    }> | null,
  ) => {
    if (!payload?.success) {
      throw toGuestApiError(payload?.message ?? 'Invalid guest message response.');
    }

    const assistantContent = payload.data?.message?.content ?? '';
    const assistantMessageId = payload.data?.message?._id ?? payload.data?.messageId;

    if (assistantContent) {
      for (let index = 0; index < assistantContent.length; index += FALLBACK_CHUNK_SIZE) {
        const chunk = assistantContent.slice(index, index + FALLBACK_CHUNK_SIZE);
        onEvent({ type: 'delta', content: chunk, requestId: payload.data?.requestId });
        await sleep(FALLBACK_CHUNK_DELAY_MS);
      }
    } else if (assistantMessageId) {
      try {
        const detail = await getGuestConversation(conversationId, { force: true });
        const replayedMessage = detail.messages
          .slice()
          .reverse()
          .find((item) => item._id === assistantMessageId && item.role === 'assistant');
        if (replayedMessage?.content) {
          onEvent({ type: 'delta', content: replayedMessage.content, requestId: payload.data?.requestId });
        }
      } catch {
        // best-effort replay resolution
      }
    }

    onEvent({ type: 'done', messageId: assistantMessageId, requestId: payload.data?.requestId });
  };

  const sendNonStreamFallback = async () => {
    const nonStreamResponse = await withGuestAuth(
      `/guest/chat/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          stream: false,
        }),
      },
      true,
    );

    if (!nonStreamResponse.ok) {
      throw await parseGuestResponseError(nonStreamResponse, 'Could not send guest message.', `${API_BASE_URL}/guest/chat/${conversationId}/messages`);
    }

    const payload = (await nonStreamResponse.json().catch(() => null)) as GuestApiResponse<{
      replayed?: boolean;
      messageId?: string;
      requestId?: string;
      message?: {
        _id?: string;
        content?: string;
      };
    }> | null;
    await emitReplayPayload(payload);
  };

  await sendNonStreamFallback();
}

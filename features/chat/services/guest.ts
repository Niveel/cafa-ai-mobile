import { API_BASE_URL } from '@/lib';
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

let sessionCache: GuestSessionPayload | null = null;
let sessionPromise: Promise<GuestSessionPayload> | null = null;

const GUEST_MODEL = 'gpt-4o-mini';
const FALLBACK_CHUNK_SIZE = 6;
const FALLBACK_CHUNK_DELAY_MS = 12;

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

async function parseGuestResponseError(response: Response, fallback: string) {
  if (response.status === 404) {
    return toGuestApiError(
      'Guest mode API is not available on this backend yet.',
      'GUEST_ENDPOINT_UNAVAILABLE',
      response.status,
    );
  }
  const payload = (await response.json().catch(() => null)) as GuestApiResponse<unknown> | null;
  return toGuestApiError(payload?.message ?? fallback, payload?.code ?? payload?.error, response.status);
}

async function createGuestSession(): Promise<GuestSessionPayload> {
  const response = await fetch(`${API_BASE_URL}/guest/session`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw await parseGuestResponseError(response, 'Could not create guest session.');
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

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (response.status !== 401 || !retryOnInvalidSession) return response;

  const payload = (await response.json().catch(() => null)) as GuestApiResponse<unknown> | null;
  const code = payload?.code ?? payload?.error;
  if (code !== 'GUEST_TOKEN_INVALID' && code !== 'GUEST_AUTH_REQUIRED') {
    return new Response(JSON.stringify(payload), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  sessionCache = null;
  await clearGuestSessionStorage();
  const fresh = await createGuestSession();
  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('Authorization', `Bearer ${fresh.guestSessionToken}`);
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers: retryHeaders });
}

export async function createGuestConversation(title?: string) {
  const response = await withGuestAuth('/guest/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(title ? { title } : {}),
  });

  if (!response.ok) {
    throw await parseGuestResponseError(response, 'Could not create guest conversation.');
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

  return payload.data;
}

export async function listGuestConversations() {
  const response = await withGuestAuth('/guest/chat');
  if (!response.ok) {
    throw await parseGuestResponseError(response, 'Could not load guest conversations.');
  }

  const payload = (await response.json()) as GuestApiResponse<GuestConversationSummary[]>;
  if (!payload?.success || !Array.isArray(payload.data)) {
    throw toGuestApiError(payload?.message ?? 'Invalid guest conversation list response.');
  }

  return payload.data;
}

export async function getGuestConversation(conversationId: string) {
  const response = await withGuestAuth(`/guest/chat/${conversationId}`);
  if (!response.ok) {
    throw await parseGuestResponseError(response, 'Could not load guest conversation.');
  }

  const payload = (await response.json()) as GuestApiResponse<GuestConversationDetail>;
  if (!payload?.success || !payload.data?._id) {
    throw toGuestApiError(payload?.message ?? 'Invalid guest conversation detail response.');
  }

  return payload.data;
}

export async function sendGuestMessageStream(
  conversationId: string,
  message: string,
  onEvent: (event: GuestStreamEvent) => void,
  idempotencyKey: string,
) {
  const sendNonStreamFallback = async () => {
    const nonStreamResponse = await withGuestAuth(
      `/guest/chat/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          message,
          stream: false,
          model: GUEST_MODEL,
        }),
      },
      true,
    );

    if (!nonStreamResponse.ok) {
      throw await parseGuestResponseError(nonStreamResponse, 'Could not send guest message.');
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
        const detail = await getGuestConversation(conversationId);
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

  const response = await withGuestAuth(
    `/guest/chat/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        message,
        stream: true,
        model: GUEST_MODEL,
      }),
    },
    true,
  );

  if (!response.ok) {
    throw await parseGuestResponseError(response, 'Could not send guest message.');
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    await sendNonStreamFallback();
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    await sendNonStreamFallback();
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const segments = buffer.split('\n\n');
    buffer = segments.pop() ?? '';

    for (const segment of segments) {
      const line = segment
        .split('\n')
        .find((entry) => entry.startsWith('data:'))
        ?.replace(/^data:\s*/, '');
      if (!line) continue;

      const event = JSON.parse(line) as GuestStreamEvent;
      onEvent(event);
      if (event.type === 'error') {
        throw toGuestApiError(event.message || 'Guest stream failed.', event.code);
      }
    }
  }
}

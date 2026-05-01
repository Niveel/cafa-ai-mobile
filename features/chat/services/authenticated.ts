import { API_BASE_URL } from '@/lib';
import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import { clearSessionTokens, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from '@/services/storage/session';
import { ApiResponse } from '@/types';
import { Platform } from 'react-native';

type AuthConversationSummaryDto = {
  _id: string;
  title: string;
  aiModel?: string;
  lastMessagePreview?: string;
  totalTokens?: number;
  createdAt: string;
  updatedAt: string;
};

type AuthConversationDetailDto = {
  _id: string;
  title: string;
  aiModel?: string;
  totalTokens?: number;
  lastMessagePreview?: string;
  messages?: {
    _id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
    tokens?: number;
    reactions?: { liked?: boolean; disliked?: boolean };
    attachments?: {
      _id?: string;
      fileType?: string;
      mimeType?: string;
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
  createdAt: string;
  updatedAt: string;
};

export type AuthConversationSummary = {
  id: string;
  title: string;
  model: string;
  preview: string;
  updatedAt: string;
};

export type AuthConversationDetail = {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
  messages: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
    tokens?: number;
    reactions?: { liked: boolean; disliked: boolean };
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
  }[];
};

export type AuthChatStreamEvent =
  | { type: 'meta'; model?: string; messageId?: string; requestId?: string; timestamp?: string }
  | { type: 'delta'; content: string; requestId?: string; timestamp?: string }
  | { type: 'done'; tokens?: number; messageId?: string; requestId?: string; timestamp?: string }
  | { type: 'error'; code?: string; message: string; requestId?: string; timestamp?: string };
type AuthSendDebugEvent =
  | { stage: 'start'; endpoint: string; idempotencyKey: string; platform: string; transport: 'xhr' | 'fetch-web' }
  | { stage: 'response'; endpoint: string; idempotencyKey: string; status: number; contentType: string | null; transport: string }
  | { stage: 'error'; endpoint: string; idempotencyKey: string; message: string; transport: string }
  | { stage: 'done'; endpoint: string; idempotencyKey: string; transport: string };

type AuthReplayResponse = ApiResponse<{
  replayed?: boolean;
  messageId?: string;
  requestId?: string;
  message?: {
    _id?: string;
    content?: string;
    aiModel?: string;
    tokens?: number;
  };
}>;

type AuthRefreshResponse = {
  data?: {
    accessToken?: string;
    refreshToken?: string;
  };
  message?: string;
  code?: string;
  error?: string;
};

type AuthSendError = Error & { status?: number; code?: string };
type ChatCacheOptions = { force?: boolean };
type AuthStreamTransportError = Error & { code?: string };
type AuthNonStreamChatResponse = ApiResponse<{
  id?: string;
  prompt?: string;
  model?: string;
  imageUrl?: string;
  videoUrl?: string;
  durationSeconds?: number;
  resolution?: string;
  width?: number;
  height?: number;
  createdAt?: string;
}>;
const AUTH_NON_STREAM_FOLLOWUP_TIMEOUT_MS = 5 * 60 * 1000;

let authRefreshPromise: Promise<string> | null = null;
const AUTH_STREAM_DEBUG = false;
const AUTH_LIST_TTL_MS = 20_000;
const AUTH_DETAIL_TTL_MS = 12_000;
let authListCache: { value: AuthConversationSummary[]; expiresAt: number } | null = null;
let authListPromise: Promise<AuthConversationSummary[]> | null = null;
const authDetailCache = new Map<string, { value: AuthConversationDetail; expiresAt: number }>();
const authDetailPromises = new Map<string, Promise<AuthConversationDetail>>();

function authStreamLog(stage: string, details?: string) {
  if (!AUTH_STREAM_DEBUG) return;
  if (details) {
    console.log(`[auth-stream] ${stage} ${details}`);
    return;
  }
  console.log(`[auth-stream] ${stage}`);
}

function mapSummary(dto: AuthConversationSummaryDto): AuthConversationSummary {
  return {
    id: dto._id,
    title: dto.title,
    model: dto.aiModel ?? 'gpt-4o-mini',
    preview: dto.lastMessagePreview ?? '',
    updatedAt: dto.updatedAt,
  };
}

function mapDetail(dto: AuthConversationDetailDto): AuthConversationDetail {
  return {
    id: dto._id,
    title: dto.title,
    model: dto.aiModel ?? 'gpt-4o-mini',
    updatedAt: dto.updatedAt,
    messages: (dto.messages ?? []).map((message) => {
      const firstImageAttachment = message.attachments?.find((attachment) =>
        (attachment.mimeType ?? '').startsWith('image/')
        || attachment.fileType === 'image',
      );
      const firstVideoAttachment = message.attachments?.find((attachment) =>
        (attachment.mimeType ?? '').startsWith('video/')
        || attachment.fileType === 'video',
      );
      return {
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
          id: attachment._id,
          fileType: attachment.fileType,
          mimeType: attachment.mimeType,
          originalName: attachment.originalName,
          url: attachment.url,
          thumbnailUrl: attachment.thumbnailUrl,
        })),
        imageUrl: firstImageAttachment?.thumbnailUrl ?? firstImageAttachment?.url,
        imagePrompt: firstImageAttachment ? message.content : undefined,
        imageId: firstImageAttachment?._id ?? undefined,
        videoUrl: firstVideoAttachment?.url,
        videoPrompt: firstVideoAttachment ? message.content : undefined,
        videoId: firstVideoAttachment?._id ?? undefined,
        reference: message.reference?.kind && message.reference?.url
          ? {
              kind: message.reference.kind,
              url: message.reference.url,
              id: message.reference.id,
            }
          : undefined,
      };
    }),
  };
}

function cloneSummaryList(list: AuthConversationSummary[]) {
  return list.map((item) => ({ ...item }));
}

function cloneDetail(detail: AuthConversationDetail): AuthConversationDetail {
  return {
    ...detail,
    messages: detail.messages.map((message) => ({
      ...message,
      attachments: message.attachments?.map((attachment) => ({ ...attachment })),
      reactions: message.reactions ? { ...message.reactions } : undefined,
    })),
  };
}

export function invalidateAuthenticatedChatCache(conversationId?: string) {
  if (conversationId) {
    authDetailCache.delete(conversationId);
    authDetailPromises.delete(conversationId);
    return;
  }

  authListCache = null;
  authListPromise = null;
  authDetailCache.clear();
  authDetailPromises.clear();
}

async function parseHttpError(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => null)) as
    | { code?: string; error?: string; message?: string }
    | null;

  const error = new Error(payload?.message ?? fallbackMessage) as Error & { code?: string; status?: number };
  error.code = payload?.code ?? payload?.error;
  error.status = response.status;
  return error;
}

function createIdempotencyKey() {
  return `auth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function inferMimeType(fileName?: string, fallback = 'application/octet-stream') {
  if (!fileName) return fallback;
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSseChunk(chunk: string) {
  const normalized = chunk.replace(/\r/g, '');
  const lines = normalized.split('\n');
  const dataLines = lines
    .map((line) => line.trimStart())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, ''));

  if (!dataLines.length) return null;
  const raw = dataLines.join('\n');
  return JSON.parse(raw) as AuthChatStreamEvent;
}

function createAuthSendError(message: string, status?: number, code?: string): AuthSendError {
  const error = new Error(message) as AuthSendError;
  error.status = status;
  error.code = code;
  return error;
}

function createAuthStreamTransportError(message: string, code: string): AuthStreamTransportError {
  const error = new Error(message) as AuthStreamTransportError;
  error.code = code;
  return error;
}

async function refreshAccessTokenForStreamSend() {
  if (authRefreshPromise) return authRefreshPromise;

  authRefreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    const response = await fetch(`${API_BASE_URL}${apiEndpoints.auth.refreshToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    });

    if (!response.ok) {
      throw createAuthSendError('Session expired. Please log in again.', response.status);
    }

    const payload = (await response.json().catch(() => null)) as AuthRefreshResponse | null;
    const nextAccessToken = payload?.data?.accessToken;
    const nextRefreshToken = payload?.data?.refreshToken;

    if (!nextAccessToken) {
      throw createAuthSendError(payload?.message ?? 'Session expired. Please log in again.');
    }

    await setAccessToken(nextAccessToken);
    if (nextRefreshToken) {
      await setRefreshToken(nextRefreshToken);
    }

    return nextAccessToken;
  })()
    .catch(async (error) => {
      await clearSessionTokens();
      throw error;
    })
    .finally(() => {
      authRefreshPromise = null;
    });

  return authRefreshPromise;
}

export async function listAuthenticatedConversations(options?: ChatCacheOptions) {
  const force = options?.force ?? false;
  const now = Date.now();
  if (!force && authListCache && authListCache.expiresAt > now) {
    return cloneSummaryList(authListCache.value);
  }
  if (!force && authListPromise) {
    return authListPromise;
  }

  authListPromise = (async () => {
    try {
      const response = await apiClient.get<ApiResponse<AuthConversationSummaryDto[]>>(apiEndpoints.chat.list);
      const mapped = (response.data.data ?? []).map(mapSummary);
      authListCache = { value: mapped, expiresAt: Date.now() + AUTH_LIST_TTL_MS };
      return cloneSummaryList(mapped);
    } catch (error) {
      throw mapApiError(error);
    } finally {
      authListPromise = null;
    }
  })();

  return authListPromise;
}

export async function listAllAuthenticatedConversations(limit = 50) {
  const mergedById = new Map<string, AuthConversationSummary>();
  let page = 1;
  let totalPages = 1;

  try {
    do {
      const response = await apiClient.get<ApiResponse<AuthConversationSummaryDto[]>>(apiEndpoints.chat.list, {
        params: { page, limit },
      });
      const list = (response.data.data ?? []).map(mapSummary);
      for (const item of list) {
        mergedById.set(item.id, item);
      }

      totalPages = response.data.pagination?.pages ?? page;
      if (!response.data.pagination && list.length < limit) {
        break;
      }
      page += 1;
    } while (page <= totalPages);

    return [...mergedById.values()];
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function searchAuthenticatedConversations(query: string) {
  try {
    const response = await apiClient.get<ApiResponse<AuthConversationSummaryDto[]>>(apiEndpoints.chat.search, {
      params: { q: query, page: 1, limit: 50 },
    });
    return (response.data.data ?? []).map(mapSummary);
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function getAuthenticatedConversation(conversationId: string, options?: ChatCacheOptions) {
  const force = options?.force ?? false;
  const now = Date.now();
  const cached = authDetailCache.get(conversationId);
  if (!force && cached && cached.expiresAt > now) {
    return cloneDetail(cached.value);
  }
  if (!force && authDetailPromises.has(conversationId)) {
    return authDetailPromises.get(conversationId)!;
  }

  const detailPromise = (async () => {
    try {
      const response = await apiClient.get<ApiResponse<AuthConversationDetailDto>>(
        apiEndpoints.chat.detail(conversationId),
      );
      const mapped = mapDetail(response.data.data);
      authDetailCache.set(conversationId, { value: mapped, expiresAt: Date.now() + AUTH_DETAIL_TTL_MS });
      return cloneDetail(mapped);
    } catch (error) {
      throw mapApiError(error);
    } finally {
      authDetailPromises.delete(conversationId);
    }
  })();

  authDetailPromises.set(conversationId, detailPromise);
  return detailPromise;
}

export async function createAuthenticatedConversation(title?: string) {
  try {
    const response = await apiClient.post<ApiResponse<{ conversationId: string; title: string }>>(
      apiEndpoints.chat.list,
      title ? { title } : {},
    );
    invalidateAuthenticatedChatCache();
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function toggleAuthenticatedMessageReaction(
  conversationId: string,
  messageId: string,
  action: 'like' | 'dislike',
) {
  try {
    const endpoint = `${apiEndpoints.chat.detail(conversationId)}/messages/${messageId}/react`;
    const response = await apiClient.patch<ApiResponse<{ reactions: { liked: boolean; disliked: boolean } }>>(
      endpoint,
      { action },
    );
    const cached = authDetailCache.get(conversationId);
    if (cached) {
      authDetailCache.set(conversationId, {
        ...cached,
        value: {
          ...cached.value,
          messages: cached.value.messages.map((message) =>
            message.id === messageId
              ? { ...message, reactions: { ...response.data.data.reactions } }
              : message,
          ),
        },
      });
    }
    return response.data.data.reactions;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function archiveAuthenticatedConversation(conversationId: string, isArchived = true) {
  try {
    await apiClient.patch(apiEndpoints.chat.archive(conversationId), { isArchived });
    invalidateAuthenticatedChatCache(conversationId);
    authListCache = null;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function deleteAuthenticatedConversation(conversationId: string) {
  try {
    await apiClient.delete(apiEndpoints.chat.detail(conversationId));
    invalidateAuthenticatedChatCache(conversationId);
    authListCache = null;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function sendAuthenticatedMessageStream(
  conversationId: string,
  message: string,
  attachments: {
    uri: string;
    fileName?: string;
    mimeType?: string;
  }[],
  onEvent: (event: AuthChatStreamEvent) => void,
  language: 'en' | 'fr' | 'es' | 'pt' = 'en',
  selectedModel: 'ultra' | 'smart' | 'swift' = 'smart',
  onDebug?: (event: AuthSendDebugEvent) => void,
) {
  invalidateAuthenticatedChatCache(conversationId);
  authListCache = null;
  const initialToken = await getAccessToken();
  let accessToken = initialToken;
  if (!accessToken) {
    try {
      accessToken = await refreshAccessTokenForStreamSend();
    } catch {
      throw new Error('Missing access token for authenticated chat.');
    }
  }

  const endpoint = `${API_BASE_URL}${apiEndpoints.chat.messages(conversationId)}`;
  const selectedModelId =
    selectedModel === 'ultra' ? 'cafa_ultra' : selectedModel === 'smart' ? 'cafa_smart' : 'cafa_swift';
  const idempotencyKey = createIdempotencyKey();
  const transport = Platform.OS !== 'web' ? 'xhr' : 'fetch-web';
  onDebug?.({
    stage: 'start',
    endpoint,
    idempotencyKey,
    platform: Platform.OS,
    transport,
  });
  authStreamLog(
    'start',
    `endpoint=${endpoint} messageLen=${message.length} language=${language} model=${selectedModel} idempotencyKey=${idempotencyKey}`,
  );

  const buildFormData = () => {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('content', message);
    formData.append('language', language);
    formData.append('selectedModel', selectedModelId);
    formData.append('model', selectedModel === 'ultra' ? 'gpt-4o' : 'gpt-4o-mini');
    for (const file of attachments) {
      if (!file?.uri) continue;
      const normalizedName = file.fileName ?? `attachment-${Date.now()}`;
      formData.append('files', {
        uri: file.uri,
        name: normalizedName,
        type: file.mimeType ?? inferMimeType(normalizedName),
      } as unknown as Blob);
    }
    return formData;
  };

  const emitFromReplay = async (payload: AuthReplayResponse['data']) => {
    const replayedMessageId = payload?.message?._id ?? payload?.messageId;
    const directContent = payload?.message?.content?.trim() ?? '';
    const resolvedModel = payload?.message?.aiModel;
    const requestId = payload?.requestId;
    authStreamLog(
      'emit-replay',
      `messageId=${replayedMessageId ?? 'none'} requestId=${requestId ?? 'none'} contentLen=${directContent.length}`,
    );

    if (resolvedModel) {
      onEvent({ type: 'meta', model: resolvedModel, messageId: replayedMessageId, requestId });
    }

    if (directContent) {
      onEvent({ type: 'delta', content: directContent, requestId });
      onEvent({ type: 'done', messageId: replayedMessageId, requestId, tokens: payload?.message?.tokens });
      return;
    }

    // Poll conversation briefly for idempotent replay payloads that only return IDs.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const detail = await getAuthenticatedConversation(conversationId, { force: true });
      const target = replayedMessageId
        ? detail.messages.find((item) => item.id === replayedMessageId && item.role === 'assistant')
        : [...detail.messages].reverse().find((item) => item.role === 'assistant');

      if (target?.content?.trim()) {
        onEvent({ type: 'delta', content: target.content, requestId });
        onEvent({ type: 'done', messageId: target.id, requestId, tokens: target.tokens });
        return;
      }

      await sleep(140);
    }

    throw new Error('No stream body returned and replay content was unavailable.');
  };

  const runJsonReplayFallback = async (allowRefresh = true): Promise<void> => {
    authStreamLog('fallback-json:start', `allowRefresh=${allowRefresh}`);
    let replayResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: buildFormData(),
    });

    if (replayResponse.status === 401 && allowRefresh) {
      authStreamLog('fallback-json:401-refresh', 'refreshing token');
      accessToken = await refreshAccessTokenForStreamSend();
      replayResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: buildFormData(),
      });
    }

    authStreamLog(
      'fallback-json:response',
      `status=${replayResponse.status} contentType=${replayResponse.headers.get('content-type') ?? 'unknown'}`,
    );
    onDebug?.({
      stage: 'response',
      endpoint,
      idempotencyKey,
      status: replayResponse.status,
      contentType: replayResponse.headers.get('content-type'),
      transport: 'fallback-json',
    });
    if (!replayResponse.ok) {
      throw await parseHttpError(replayResponse, 'Could not send your message right now.');
    }

    const payload = (await replayResponse.json().catch(() => null)) as AuthReplayResponse | null;
    if (!payload?.success) {
      throw new Error(payload?.message ?? 'Could not process fallback chat response.');
    }

    await emitFromReplay(payload.data);
  };

  const streamViaXhr = async (allowRefresh = true): Promise<void> => {
    authStreamLog('xhr:start', `allowRefresh=${allowRefresh}`);
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let lastOffset = 0;
      let buffer = '';
      let settled = false;
      let streamAccepted = false;
      let streamStarted = false;
      let pendingErrorTimer: ReturnType<typeof setTimeout> | null = null;

      const rejectOnce = (error: unknown) => {
        if (settled) return;
        if (pendingErrorTimer) {
          clearTimeout(pendingErrorTimer);
          pendingErrorTimer = null;
        }
        settled = true;
        reject(error);
      };

      const resolveOnce = () => {
        if (settled) return;
        if (pendingErrorTimer) {
          clearTimeout(pendingErrorTimer);
          pendingErrorTimer = null;
        }
        settled = true;
        resolve();
      };

      xhr.open('POST', endpoint);
      xhr.setRequestHeader('Accept', 'text/event-stream');
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.setRequestHeader('Idempotency-Key', idempotencyKey);

      xhr.onprogress = () => {
        const next = xhr.responseText.slice(lastOffset);
        if (!next) return;
        streamStarted = true;
        lastOffset = xhr.responseText.length;
        buffer += next;
        authStreamLog('xhr:progress', `chunkLen=${next.length} totalLen=${xhr.responseText.length}`);

        const chunks = buffer.split(/\r?\n\r?\n/);
        buffer = chunks.pop() ?? '';
        for (const chunk of chunks) {
          if (!chunk.trim()) continue;
          try {
            const event = parseSseChunk(chunk);
            if (!event) continue;
            authStreamLog(
              'xhr:event',
              `type=${event.type} deltaLen=${event.type === 'delta' ? event.content.length : 0} messageId=${'messageId' in event ? (event.messageId ?? '') : ''}`,
            );
            onEvent(event);
            if (event.type === 'error') {
              rejectOnce(
                createAuthStreamTransportError(
                  event.message || 'Authenticated stream failed.',
                  'AUTH_STREAM_ACTIVE_SERVER_ERROR',
                ),
              );
              return;
            }
          } catch {
            authStreamLog('xhr:event-parse-skip');
          }
        }
      };

      xhr.onerror = () => {
        authStreamLog('xhr:error');
        if (settled) return;
        // Android can emit onerror just before onload for valid SSE responses.
        // Briefly delay rejection so onload can win if status/content-type are valid.
        if (pendingErrorTimer) {
          clearTimeout(pendingErrorTimer);
        }
        pendingErrorTimer = setTimeout(() => {
          if (settled) return;
          pendingErrorTimer = null;
          if (streamAccepted || streamStarted) {
            rejectOnce(
              createAuthStreamTransportError(
                'Authenticated stream transport dropped after stream start.',
                'AUTH_STREAM_DROPPED_AFTER_START',
              ),
            );
            return;
          }
          rejectOnce(new Error('Network request failed.'));
        }, 220);
      };

      xhr.onload = async () => {
        authStreamLog(
          'xhr:load',
          `status=${xhr.status} contentType=${xhr.getResponseHeader('content-type') ?? 'unknown'} bufferedLen=${buffer.length}`,
        );
        onDebug?.({
          stage: 'response',
          endpoint,
          idempotencyKey,
          status: xhr.status,
          contentType: xhr.getResponseHeader('content-type'),
          transport: 'xhr',
        });
        if (xhr.status === 401 && allowRefresh) {
          authStreamLog('xhr:401-refresh', 'refreshing token');
          void refreshAccessTokenForStreamSend()
            .then((nextAccessToken) => {
              accessToken = nextAccessToken;
              return streamViaXhr(false);
            })
            .then(resolveOnce)
            .catch(rejectOnce);
          return;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          try {
            const payload = JSON.parse(xhr.responseText) as { message?: string; error?: string; code?: string };
            rejectOnce(new Error(payload.message ?? payload.error ?? 'Could not send your message right now.'));
          } catch {
            rejectOnce(new Error('Could not send your message right now.'));
          }
          return;
        }

        streamAccepted = true;
        const contentType = xhr.getResponseHeader('content-type') ?? '';
        if (!contentType.includes('text/event-stream')) {
          authStreamLog('xhr:non-sse-response');
          try {
            const payload = JSON.parse(xhr.responseText) as AuthReplayResponse;
            if (!payload?.success) {
              rejectOnce(new Error(payload?.message ?? 'Missing response stream from authenticated chat.'));
              return;
            }
            void emitFromReplay(payload.data).then(resolveOnce).catch(rejectOnce);
            return;
          } catch {
            rejectOnce(new Error('Missing response stream from authenticated chat.'));
            return;
          }
        }

        if (buffer.trim()) {
          try {
            const trailingChunks = buffer.split(/\r?\n\r?\n/).filter((chunk) => chunk.trim());
            authStreamLog('xhr:trailing', `count=${trailingChunks.length}`);
            for (const trailingChunk of trailingChunks) {
              const event = parseSseChunk(trailingChunk.trim());
              if (!event) continue;
              authStreamLog(
                'xhr:trailing-event',
                `type=${event.type} deltaLen=${event.type === 'delta' ? event.content.length : 0}`,
              );
              onEvent(event);
              if (event.type === 'error') {
                rejectOnce(
                  createAuthStreamTransportError(
                    event.message || 'Authenticated stream failed.',
                    'AUTH_STREAM_ACTIVE_SERVER_ERROR',
                  ),
                );
                return;
              }
            }
          } catch {
            // ignore trailing parse noise
          }
        }
        resolveOnce();
      };

      xhr.send(buildFormData());
    });
  };

  const streamViaFetch = async (transportLabel: 'fetch-web', allowRefresh = true): Promise<void> => {
    let response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${accessToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: buildFormData(),
    });

    if (response.status === 401 && allowRefresh) {
      authStreamLog(`${transportLabel}:401-refresh`, 'refreshing token');
      accessToken = await refreshAccessTokenForStreamSend();
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${accessToken}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: buildFormData(),
      });
    }

    authStreamLog(
      `${transportLabel}:response`,
      `status=${response.status} contentType=${response.headers.get('content-type') ?? 'unknown'}`,
    );
    onDebug?.({
      stage: 'response',
      endpoint,
      idempotencyKey,
      status: response.status,
      contentType: response.headers.get('content-type'),
      transport: transportLabel,
    });
    if (!response.ok) {
      throw await parseHttpError(response, 'Could not send your message right now.');
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/event-stream')) {
      const payload = (await response.json().catch(() => null)) as AuthReplayResponse | null;
      if (!payload?.success) {
        throw new Error(payload?.message ?? 'Missing response stream from authenticated chat.');
      }
      await emitFromReplay(payload.data);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      authStreamLog(`${transportLabel}:no-reader`);
      authStreamLog(`${transportLabel}:no-reader-fallback-json`);
      await runJsonReplayFallback();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() ?? '';

      for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        const event = parseSseChunk(chunk);
        if (!event) continue;
        authStreamLog(
          `${transportLabel}:event`,
          `type=${event.type} deltaLen=${event.type === 'delta' ? event.content.length : 0} messageId=${'messageId' in event ? (event.messageId ?? '') : ''}`,
        );
        onEvent(event);
        if (event.type === 'error') {
          throw createAuthStreamTransportError(event.message || 'Authenticated stream failed.', 'AUTH_STREAM_ACTIVE_SERVER_ERROR');
        }
      }
    }

    if (buffer.trim()) {
      try {
        const trailingChunks = buffer.split(/\r?\n\r?\n/).filter((chunk) => chunk.trim());
        for (const trailingChunk of trailingChunks) {
          const event = parseSseChunk(trailingChunk);
          if (!event) continue;
          onEvent(event);
          if (event.type === 'error') {
            throw createAuthStreamTransportError(event.message || 'Authenticated stream failed.', 'AUTH_STREAM_ACTIVE_SERVER_ERROR');
          }
        }
      } catch {
        // ignore trailing parse noise
      }
    }
  };

  if (Platform.OS !== 'web') {
    try {
      await streamViaXhr();
      onDebug?.({ stage: 'done', endpoint, idempotencyKey, transport: 'xhr' });
      return;
    } catch (error) {
      const code = ((error as { code?: string } | undefined)?.code ?? '').toUpperCase();
      const shouldAvoidReplayPost =
        code === 'AUTH_STREAM_DROPPED_AFTER_START'
        || code === 'AUTH_STREAM_ACTIVE_SERVER_ERROR';
      if (shouldAvoidReplayPost) {
        authStreamLog('native:xhr-failed-no-replay-post');
        onDebug?.({
          stage: 'error',
          endpoint,
          idempotencyKey,
          message: error instanceof Error ? error.message : 'Authenticated stream dropped after start.',
          transport: 'xhr',
        });
        throw error;
      }
      authStreamLog('native:xhr-failed-fallback-json');
      try {
        await runJsonReplayFallback();
        onDebug?.({ stage: 'done', endpoint, idempotencyKey, transport: 'fallback-json' });
      } catch (error) {
        onDebug?.({
          stage: 'error',
          endpoint,
          idempotencyKey,
          message: error instanceof Error ? error.message : 'Unknown authenticated send error.',
          transport: 'fallback-json',
        });
        throw error;
      }
      return;
    }
  }

  await streamViaFetch('fetch-web');
  onDebug?.({ stage: 'done', endpoint, idempotencyKey, transport: 'fetch-web' });
}

export async function sendAuthenticatedMessageNonStream(
  conversationId: string,
  message: string,
  selectedModel: 'ultra' | 'smart' | 'swift' = 'smart',
  reference?: {
    kind: 'image' | 'video';
    url: string;
    id?: string;
  },
  attachments: {
    uri: string;
    fileName?: string;
    mimeType?: string;
  }[] = [],
) {
  invalidateAuthenticatedChatCache(conversationId);
  authListCache = null;

  const selectedModelId =
    selectedModel === 'ultra' ? 'cafa_ultra' : selectedModel === 'smart' ? 'cafa_smart' : 'cafa_swift';

  const formData = new FormData();
  formData.append('message', message);
  formData.append('content', message);
  formData.append('stream', 'false');
  formData.append('selectedModel', selectedModelId);
  formData.append('model', selectedModel === 'ultra' ? 'gpt-4o' : 'gpt-4o-mini');
  if (reference?.url) {
    const normalizedReference = {
      kind: reference.kind,
      url: reference.url,
      id: reference.id,
    };
    // Send multiple shapes for backend compatibility across parsers/middleware.
    formData.append('reference', JSON.stringify(normalizedReference));
    formData.append('reference[kind]', reference.kind);
    formData.append('reference[url]', reference.url);
    if (reference.id) {
      formData.append('reference[id]', reference.id);
    }
  }
  for (const file of attachments) {
    if (!file?.uri) continue;
    const normalizedName = file.fileName ?? `attachment-${Date.now()}`;
    formData.append('files', {
      uri: file.uri,
      name: normalizedName,
      type: file.mimeType ?? inferMimeType(normalizedName),
    } as unknown as Blob);
  }

  try {
    const response = await apiClient.post<AuthNonStreamChatResponse>(
      apiEndpoints.chat.messages(conversationId),
      formData,
      {
        timeout: AUTH_NON_STREAM_FOLLOWUP_TIMEOUT_MS,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

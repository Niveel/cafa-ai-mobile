export type CafaLifeSessionState = 'idle' | 'requesting_permission' | 'connecting' | 'listening' | 'speaking' | 'muted' | 'disconnecting' | 'error';

// Real fix (2026-09-14): matches the actual deployed backend response shape
// from POST /cafa-life/livekit-token (generateLivekitTokenHandler in
// new-cafa-ai-api's cafa-life.controller.ts returns { token, url, room }).
// The old `livekitUrl`/`roomName` fields were the pre-2026-09-07 contract
// (see docs/cafa-life-frontend-docs.md) from before the LiveKit voice
// pipeline was refactored to the native-agent transport -- the mobile
// client was never updated to match, so every session request 404'd.
export type CafaLifeTokenPayload = {
  token: string;
  url: string;
  room: string;
};

export type CafaLifeVoiceOption = {
  id: string;
  name: string;
  gender: string;
  description?: string;
  default?: boolean;
};

export type CafaLifeVoicesPayload = {
  voices: CafaLifeVoiceOption[];
  defaultVoice?: string;
};

export type CafaLifeHistoryTurn = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

export type CafaLifeHistoryPayload = {
  turns: CafaLifeHistoryTurn[];
};

export type CafaLifeSessionErrorCode =
  | 'UNSUPPORTED_RUNTIME'
  | 'MIC_PERMISSION_DENIED'
  | 'AUTH_REQUIRED'
  | 'NETWORK_ERROR'
  | 'TOKEN_REQUEST_FAILED'
  | 'LIVEKIT_CONNECT_FAILED'
  | 'AUDIO_SESSION_FAILED'
  | 'UNKNOWN_ERROR';

export type CafaLifeSessionError = Error & {
  code?: CafaLifeSessionErrorCode | string;
  status?: number;
};

export type CafaLifeSessionSnapshot = {
  state: CafaLifeSessionState;
  error: CafaLifeSessionError | null;
  isMuted: boolean;
  roomName: string | null;
  assistantName: string | null;
  isRuntimeSupported: boolean;
  runtimeMessage: string | null;
  startedAt: number | null;
};

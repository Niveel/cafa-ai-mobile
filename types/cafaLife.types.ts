export type CafaLifeSessionState = 'idle' | 'requesting_permission' | 'connecting' | 'listening' | 'speaking' | 'muted' | 'disconnecting' | 'error';

export type CafaLifeTokenPayload = {
  token: string;
  livekitUrl: string;
  roomName: string;
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

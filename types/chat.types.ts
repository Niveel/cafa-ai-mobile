export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  tokens?: number;
};

export type ChatConversation = {
  id: string;
  title: string;
  updatedAt: string;
  preview?: string;
  messages?: ChatMessage[];
};

export type ChatStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'done'; tokens?: number; messageId?: string }
  | { type: 'error'; message: string };

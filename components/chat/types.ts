export type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  tokens?: number;
};

export type AttachedAsset = {
  id: string;
  label: string;
};

export type ChatModelKey = 'ultra' | 'smart' | 'swift';

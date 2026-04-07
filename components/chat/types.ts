export type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  tokens?: number;
  imageUrl?: string;
  imagePrompt?: string;
  imageId?: string;
  isImageGenerating?: boolean;
  videoUrl?: string;
  videoPrompt?: string;
  videoId?: string;
  isVideoGenerating?: boolean;
};

export type AttachedAsset = {
  id: string;
  label: string;
};

export type ChatModelKey = 'ultra' | 'smart' | 'swift';

export type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  referencedMedia?: {
    kind: 'image' | 'video';
    id?: string;
    url: string;
  };
  tokens?: number;
  attachments?: UiMessageAttachment[];
  imageUrl?: string;
  imagePrompt?: string;
  imageId?: string;
  isImageGenerating?: boolean;
  videoUrl?: string;
  videoPrompt?: string;
  videoId?: string;
  isVideoGenerating?: boolean;
  isArtifactGenerating?: boolean;
};

export type UiMessageAttachment = {
  id?: string;
  fileType?: string;
  mimeType?: string;
  originalName?: string;
  url?: string;
  thumbnailUrl?: string;
};

export type AttachedAsset = {
  id: string;
  label: string;
  uri: string;
  mimeType?: string;
  fileName?: string;
};

export type ChatModelKey = 'ultra' | 'smart' | 'swift';

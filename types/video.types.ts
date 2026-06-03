export type GenerateVideoRequest = {
  conversationId?: string;
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
};

export type GenerateVideoFromImageDirectRequest = {
  prompt: string;
  durationSeconds?: 5 | 10;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  image: {
    uri: string;
    fileName?: string;
    mimeType?: string;
  };
};

export type GenerateVideoFromImageDirectResult = {
  videoUrl?: string;
  generationTime?: number;
  duration?: number;
  conversationId?: string;
  screen?: 'image-to-video';
  jobId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  status?: 'queued' | 'processing' | 'completed' | 'failed';
};

export type VideoGenerationJob = {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  message?: string;
  error?: string;
  conversationId?: string;
  assistantMessageId?: string;
  videoUrl?: string;
  result?: {
    id?: string;
    prompt?: string;
    videoUrl?: string;
    createdAt?: string;
    durationSeconds?: number;
  };
};

export type VideoHistoryItem = {
  id: string;
  prompt: string;
  videoUrl?: string | null;
  downloadUrl?: string | null;
  durationSeconds?: number | null;
  status?: 'queued' | 'processing' | 'completed' | 'failed' | string;
  createdAt: string;
};

export type VideoHistoryPagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNextPage?: boolean;
  nextCursor?: string | null;
};

export type VideoHistoryQuery = {
  page?: number;
  limit?: number;
  cursor?: string;
  sort?: 'newest' | 'oldest';
  search?: string;
  from?: string;
  to?: string;
};

export type VideoHistoryPage = {
  videos: VideoHistoryItem[];
  pagination: VideoHistoryPagination;
};

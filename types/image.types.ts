export type GenerateImageRequest = {
  conversationId?: string;
  prompt: string;
  width?: number;
  height?: number;
  style?: string;
};

export type ImageHistoryItem = {
  id: string;
  prompt: string;
  imageUrl?: string | null;
  downloadUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  model?: string | null;
  size?: string | null;
  byteSize?: number | null;
  createdAt: string;
};

export type ImageHistoryPagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNextPage?: boolean;
  nextCursor?: string | null;
};

export type ImageHistoryQuery = {
  page?: number;
  limit?: number;
  cursor?: string;
  sort?: 'newest' | 'oldest';
  search?: string;
  from?: string;
  to?: string;
};

export type ImageHistoryPage = {
  images: ImageHistoryItem[];
  pagination: ImageHistoryPagination;
};

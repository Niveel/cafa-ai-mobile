export type GenerateImageRequest = {
  prompt: string;
  width?: number;
  height?: number;
  style?: string;
};

export type ImageHistoryItem = {
  id: string;
  prompt: string;
  imageUrl?: string | null;
  createdAt: string;
};

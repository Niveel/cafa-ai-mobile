export type GenerateVideoRequest = {
  prompt: string;
  durationSeconds?: number;
};

export type VideoGenerationJob = {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
};

export type VideoHistoryItem = {
  id: string;
  prompt: string;
  videoUrl?: string | null;
  createdAt: string;
};

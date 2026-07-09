export type TtsFormat = 'mp3' | 'wav';

export type TtsConvertRequest = {
  text: string;
  voiceId?: string;
  fishAudioId?: string;
  format?: TtsFormat;
};

export type TtsConversionResult = {
  id: string;
  audioUrl: string;
  text: string;
  voiceId?: string | null;
  voiceName?: string | null;
  fishAudioId?: string | null;
  format: TtsFormat;
  duration?: number | null;
  characterCount?: number | null;
  createdAt: string;
};

export type TtsHistoryPagination = {
  page: number;
  limit: number;
  total: number;
};

export type TtsHistoryPage = {
  conversions: TtsConversionResult[];
  pagination: TtsHistoryPagination;
};

export type AvatarGalleryGender = 'male' | 'female' | 'neutral';
export type AvatarGalleryStyle = 'professional' | 'casual' | 'creative';
export type AvatarVoiceGender = 'male' | 'female';
export type AvatarVoiceCategory = 'professional' | 'african' | 'creative' | 'entertainment';
export type AvatarScriptTone = 'friendly' | 'professional' | 'motivational' | 'educational';
export type AvatarUseCaseTemplate = 'product ad' | 'intro' | 'explainer' | 'testimonial' | 'pitch' | 'general';
export type AvatarDurationSeconds = 15 | 30 | 45 | 60;
export type AvatarType = 'gallery' | 'upload';
export type AvatarJobStatus = 'script_ready' | 'audio_generated' | 'video_generating' | 'completed' | 'failed' | 'processing' | string;

export type AvatarGalleryItem = {
  id: string;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  gender?: AvatarGalleryGender | string | null;
  ethnicity?: string | null;
  setting?: string | null;
  style?: AvatarGalleryStyle | string | null;
};

export type AvatarGalleryQuery = {
  gender?: AvatarGalleryGender | '';
  style?: AvatarGalleryStyle | '';
  limit?: number;
};

export type AvatarVoiceOption = {
  id: string;
  name: string;
  gender?: AvatarVoiceGender | string | null;
  style?: string | null;
  description?: string | null;
  category?: AvatarVoiceCategory | string | null;
  popular?: boolean;
  default?: boolean;
};

export type AvatarVoiceCatalog = {
  voices: AvatarVoiceOption[];
  total?: number | null;
  categories?: string[];
  defaultVoice?: string | null;
};

export type AvatarVoiceQuery = {
  gender?: AvatarVoiceGender | '';
  category?: AvatarVoiceCategory | '';
  popular?: boolean;
};

export type AvatarClonedVoice = {
  id: string;
  name: string;
  fishAudioId: string;
  status: 'ready' | 'processing' | 'failed' | string;
  createdAt?: string | null;
};

export type AvatarScriptGenerationRequest = {
  userGoal: string;
  targetAudience?: string;
  tone?: AvatarScriptTone;
  durationSeconds?: AvatarDurationSeconds;
  useCaseTemplate?: AvatarUseCaseTemplate;
};

export type AvatarScriptGenerationResult = {
  script: string;
  estimatedDurationSeconds?: number | null;
  title?: string | null;
  keyPoints?: string[];
};

export type AvatarVideoGenerationRequest = {
  avatarImageUrl: string;
  avatarType: AvatarType;
  galleryAvatarId?: string;
  scriptText: string;
  userGoal: string;
  voiceName?: string;
  fishAudioId?: string;
  useCaseTemplate?: AvatarUseCaseTemplate;
};

export type AvatarVideoGenerationJob = {
  id: string;
  status: AvatarJobStatus;
  message?: string | null;
};

export type AvatarVideoStatus = {
  id: string;
  status: AvatarJobStatus;
  videoUrl?: string | null;
  audioUrl?: string | null;
  scriptText?: string | null;
  generationTime?: number | null;
  createdAt?: string | null;
};

export type AvatarHistoryItem = {
  id: string;
  avatarImageUrl?: string | null;
  scriptText?: string | null;
  voiceName?: string | null;
  videoUrl?: string | null;
  status?: AvatarJobStatus;
  generationTime?: number | null;
  createdAt: string;
};

export type AvatarHistoryPagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type AvatarHistoryPage = {
  videos: AvatarHistoryItem[];
  pagination: AvatarHistoryPagination;
};

export type PendingAvatarVideoJob = {
  jobId: string;
  avatarImageUrl: string;
  avatarType: AvatarType;
  galleryAvatarId?: string | null;
  scriptText: string;
  userGoal: string;
  voiceName?: string;
  fishAudioId?: string;
  voiceLabel: string;
  useCaseTemplate?: AvatarUseCaseTemplate;
  createdAt: string;
};

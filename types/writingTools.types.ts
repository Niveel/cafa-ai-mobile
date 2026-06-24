export type WritingToolTier = 'free' | 'cafa_smart' | 'cafa_pro' | 'cafa_max';

export type WritingToolQuota = {
  used: number;
  limit: number;
  tier: WritingToolTier;
  remaining?: number;
};

export type DetectionConfidence = 'high' | 'medium' | 'low';

export type DetectAiRequest = {
  text: string;
};

export type DetectAiResult = {
  aiProbability: number;
  humanProbability: number;
  isAiGenerated: boolean;
  confidence: DetectionConfidence;
  details?: {
    averageGeneratedProb?: number;
    completelyGeneratedProb?: number;
  };
  usage: WritingToolQuota;
};

export type HumanizeStyle = 'casual' | 'academic' | 'professional';
export type HumanizeIntensity = 'light' | 'medium' | 'heavy';

export type HumanizeRequest = {
  text: string;
  style?: HumanizeStyle;
  intensity?: HumanizeIntensity;
};

export type HumanizeResult = {
  result: string;
  modelTier: 'standard' | 'enhanced';
  factCheckPassed: boolean;
  style: HumanizeStyle;
  intensity: HumanizeIntensity;
  usage: WritingToolQuota;
};

export type WritingToolError = Error & {
  code?: string;
  status?: number;
  data?: Partial<WritingToolQuota> & Record<string, unknown>;
};

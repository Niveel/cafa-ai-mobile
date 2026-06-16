export type PromptSuggestionContext = 'chat' | 'image' | 'video' | 'edit-image';

export type PromptSuggestionRequest = {
  partialText: string;
  context?: PromptSuggestionContext;
  authToken?: string;
  signal?: AbortSignal;
};

export type PromptSuggestionResult = {
  suggestions: string[];
};

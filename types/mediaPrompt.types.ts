export type MediaPromptRewriteScreen = 'edit-image' | 'image-to-video';

export type MediaPromptRewriteIntent = 'edit-image' | 'image-to-video' | 'unsupported';

export type MediaPromptRewriteRequest = {
  screen: MediaPromptRewriteScreen;
  prompt: string;
  language?: string;
};

export type MediaPromptRewriteResult = {
  intent: MediaPromptRewriteIntent;
  belongsToCurrentScreen: boolean;
  requiresImage: boolean;
  rewrittenPrompt: string;
  reason: string;
};

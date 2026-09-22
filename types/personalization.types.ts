export type PersonalizationLanguage = 'en' | 'fr' | 'es' | 'pt';

export type PersonalizationTone = 'balanced' | 'professional' | 'friendly' | 'concise' | 'detailed';

export type PersonalizationResponseLength = 'short' | 'medium' | 'long';

export type AboutYouPersonalization = {
  nickname: string;
  occupation: string;
  about: string;
};

export type UserPersonalization = {
  language: PersonalizationLanguage;
  tone: PersonalizationTone;
  responseLength: PersonalizationResponseLength;
  creativity: number;
  voiceEnabled: boolean;
  memoryEnabled: boolean;
  aboutYou: AboutYouPersonalization;
  // Real, matches web's real, persisted Cafa Life voice choice (features/cafa-life/hooks/
  // useCafaLifeSession.ts / CafaLifeScreen.tsx on web) -- the voice picked in a
  // real-time voice call, remembered across sessions/devices via the same
  // personalization document, not a local-only preference.
  cafaLifeVoiceId?: string | null;
};

export type UpdatePersonalizationRequest = Partial<UserPersonalization> & {
  aboutYou?: AboutYouPersonalization;
};


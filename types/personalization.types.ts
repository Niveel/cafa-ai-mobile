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
};

export type UpdatePersonalizationRequest = Partial<UserPersonalization> & {
  aboutYou?: AboutYouPersonalization;
};


export type VoiceDescriptor = {
  id: string;
  name: string;
  gender?: string;
  accent?: string;
  description?: string;
};

export type TranscriptionResult = {
  text: string;
};

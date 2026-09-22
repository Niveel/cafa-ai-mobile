export type UiMessageScreenHandoff = {
  target: 'index' | 'image-to-video' | 'edit-image';
  title: string;
  description: string;
  ctaLabel: string;
  iconName?: string;
};

export type UiMessageImageRequirement = {
  title: string;
  description: string;
  ctaLabel: string;
  iconName?: string;
};

export type UiMessageDocumentWizard = {
  html: string;
  documentType: string;
  format: string;
  collapsed?: boolean;
  userMessageId?: string;
  assistantMessageId?: string;
  formData?: Record<string, string>;
};

export type UiMessageToolCall = {
  tool: string;
  label?: string;
  ok?: boolean;
  ms?: number;
  running: boolean;
};

// Real, matches web's ProductResult (types/chat.types.ts) -- backed by the
// same search_products tool / Serper.dev Shopping endpoint. `link` is a
// Google Shopping interstitial, not a direct merchant page -- resolving one
// costs ~1.5s per product, so it's done on demand (resolveProductLink) only
// for the product someone actually opens, never for the whole list upfront.
export type UiMessageProduct = {
  title: string;
  price: string;
  source: string;
  link: string;
  imageUrl?: string;
  rating?: number;
  ratingCount?: number;
};

export type UiMessageProducts = {
  query: string;
  items: UiMessageProduct[];
};

// Real, matches web's ChatArtifactItem (chat-shell/types.ts) -- one gallery
// entry per media-producing tool call. `toolCallIndex` matches the real
// backend delete route exactly (DELETE .../tool-calls/:toolCallIndex),
// since it's derived from the same real, persisted toolCalls array the
// backend indexes into. `sourceUrl` is only set for edit_image (the
// pre-edit image, for the before/after comparison) -- "original never
// modified" holds because edit_image always writes a NEW result url,
// never overwrites the source.
export type UiArtifactItem = {
  id: string;
  kind: 'image' | 'video' | 'document';
  url?: string;
  sourceUrl?: string;
  name?: string;
  messageId: string;
  toolCallIndex?: number;
  createdAt: number;
  generating?: boolean;
  failed?: boolean;
};

// Real, matches web's ChatWidgetField/ChatWidgetSpec (types/chat.types.ts) --
// backed by the render_widget tool. Field types mirror the backend schema
// exactly: 'display' is read-only, 'file' uploads eagerly (see
// features/chat/services/widgets.ts) and stores the resulting URL as the
// field's value, everything else is a plain form control.
export type UiWidgetField = {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'radio' | 'display' | 'file';
  required?: boolean;
  default?: string;
  options?: string[];
  min?: number;
  max?: number;
};

export type UiWidgetSpec = {
  title: string;
  description?: string;
  submit_label?: string;
  fields: UiWidgetField[];
};

export type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  referencedMedia?: {
    kind: 'image' | 'video';
    id?: string;
    url: string;
  };
  tokens?: number;
  attachments?: UiMessageAttachment[];
  imageUrl?: string;
  imagePrompt?: string;
  imageId?: string;
  isImageGenerating?: boolean;
  videoUrl?: string;
  videoPrompt?: string;
  videoId?: string;
  isVideoGenerating?: boolean;
  isArtifactGenerating?: boolean;
  isAnalyzing?: boolean;
  screenHandoff?: UiMessageScreenHandoff;
  imageRequirement?: UiMessageImageRequirement;
  documentWizard?: UiMessageDocumentWizard;
  tools?: UiMessageToolCall[];
  /** Real, live tool-calling turn state (native tool-calling backend) --
   * populated while streaming; the backend never persists these, so a
   * later conversation-detail refresh naturally clears them once the turn
   * settles (matching web's ThinkingPanel: it renders nothing once
   * `reasoning` is undefined again). */
  reasoning?: string;
  reasoningSummary?: string;
  reasoningStartedAt?: number;
  currentStep?: string;
  products?: UiMessageProducts;
  artifacts?: UiArtifactItem[];
  widget?: UiWidgetSpec;
  /** Real submission-lock signal (mirrors web's applyWidgetSubmissionState):
   * a widget is "done" only once the very next user message is the real
   * "[Form response] ..." line handleWidgetSubmit sends -- not merely
   * because the render_widget tool call itself completed. */
  widgetDone?: boolean;
};

export type UiMessageAttachment = {
  id?: string;
  fileType?: string;
  mimeType?: string;
  originalName?: string;
  url?: string;
  thumbnailUrl?: string;
};

export type AttachedAsset = {
  id: string;
  label: string;
  uri: string;
  mimeType?: string;
  fileName?: string;
};

export type ChatModelKey = 'ultra' | 'smart' | 'swift';

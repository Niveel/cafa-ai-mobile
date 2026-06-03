export type DedicatedMediaScreen = 'edit-image' | 'image-to-video';

export type DedicatedMediaConversationAttachment = {
  _id?: string;
  id?: string;
  type?: 'image' | 'video' | 'document' | string;
  fileType?: string;
  mimeType?: string;
  fileName?: string;
  originalName?: string;
  url?: string;
  thumbnailUrl?: string;
  size?: number;
};

export type DedicatedMediaConversationMessage = {
  _id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  tokens?: number;
  reactions?: { liked?: boolean; disliked?: boolean };
  attachments?: DedicatedMediaConversationAttachment[];
  reference?: {
    kind?: 'image' | 'video';
    url?: string;
    id?: string;
  } | null;
  mediaMeta?: {
    screen?: DedicatedMediaScreen;
    generationKind?: 'image-edit' | 'image-to-video' | string;
    sourceAttachmentId?: string;
  } | null;
};

export type DedicatedMediaConversationDto = {
  _id: string;
  kind?: string;
  screen: DedicatedMediaScreen;
  userId?: string;
  title: string;
  aiModel?: string;
  visibleInChatList?: boolean;
  isArchived?: boolean;
  messages?: DedicatedMediaConversationMessage[];
  createdAt: string;
  updatedAt: string;
};

export type DedicatedMediaConversation = {
  id: string;
  title: string;
  screen: DedicatedMediaScreen;
  model: string;
  updatedAt: string;
  messages: DedicatedMediaConversationMessage[];
};

export type DedicatedMediaConversationPagination = {
  limit: number;
  returned: number;
  nextCursor: string | null;
  hasMore: boolean;
  totalMessages: number;
};

export type DedicatedMediaConversationQuery = {
  cursor?: string;
  limit?: number;
  direction?: 'before';
};

export type DedicatedMediaConversationPage = {
  conversation: DedicatedMediaConversation;
  pagination: DedicatedMediaConversationPagination;
};

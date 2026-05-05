export type ArtifactKind = 'attachment' | 'generated';

export type ArtifactRole = 'user' | 'assistant' | 'system' | string;

export type ArtifactItem = {
  artifactId: string;
  kind: ArtifactKind | string;
  conversationId: string;
  messageId: string;
  role: ArtifactRole;
  createdAt: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  url?: string;
  downloadUrl?: string;
};

export type ArtifactPagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type ArtifactQuery = {
  page?: number;
  limit?: number;
  mimeType?: string;
  kind?: ArtifactKind;
};

export type ArtifactListPage = {
  artifacts: ArtifactItem[];
  pagination: ArtifactPagination;
};

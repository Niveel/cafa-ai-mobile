export type DocumentWizardFormat = 'pdf' | 'docx' | 'pptx' | 'xlsx';
export type ExpectedResponseType = 'text' | 'image' | 'video' | 'artifact';

export type DetectDocumentRequestResult = {
  isDocumentRequest: boolean;
  documentType: string | null;
  format: DocumentWizardFormat | null;
  confidence: number;
  expectedResponseType: ExpectedResponseType;
};

export type DocumentWizardArtifact = {
  type: string;
  title: string;
  mimeType: string;
  url: string;
  fileName: string;
  size_bytes: number;
};

export type DocumentWizardHistoryItem = {
  _id: string;
  documentType: string;
  format: string;
  title: string;
  source: 'wizard' | 'chat';
  artifacts: DocumentWizardArtifact[];
  createdAt: string;
};

export type DocumentWizardHistoryPage = {
  documents: DocumentWizardHistoryItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
  };
};

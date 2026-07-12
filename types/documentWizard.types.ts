export type DocumentWizardFormat = 'pdf' | 'docx' | 'pptx' | 'xlsx';
export type ExpectedResponseType =
  | 'text'
  | 'search'
  | 'image'
  | 'video'
  | 'artifact'
  | 'image_analysis'
  | 'document_analysis';

export type ChatClassificationResult = {
  responseType: ExpectedResponseType;
  confidence: number;
  subIntent: string | null;
  label: string;
  description: string;
};

export type DetectDocumentRequestResult = {
  isDocumentRequest: boolean;
  documentType: string | null;
  format: DocumentWizardFormat | null;
  confidence: number;
  expectedResponseType: ExpectedResponseType;
  needsForm: boolean;
  formReason: string | null;
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

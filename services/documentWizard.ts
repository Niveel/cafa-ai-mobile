import { AxiosResponse } from 'axios';

import { apiClient } from '@/services/api';
import { mapApiError } from '@/services/api/error.mapper';
import {
  ApiResponse,
  ChatClassificationResult,
  DetectDocumentRequestResult,
  DocumentWizardArtifact,
  DocumentWizardHistoryPage,
  GenerateDocumentDirectResult,
  StartDocumentWizardResult,
} from '@/types';

type DetectResponsePayload = Omit<DetectDocumentRequestResult, 'expectedResponseType'> & {
  expectedResponseType?: DetectDocumentRequestResult['expectedResponseType'];
  responseType?: DetectDocumentRequestResult['expectedResponseType'];
};

type DetectResponse = ApiResponse<DetectResponsePayload>;
type StartWizardResponse = ApiResponse<StartDocumentWizardResult>;
type GenerateWizardResponse = ApiResponse<{ artifacts: DocumentWizardArtifact[] }>;
type GenerateDirectResponse = ApiResponse<GenerateDocumentDirectResult>;
type HistoryWizardResponse = ApiResponse<DocumentWizardHistoryPage>;

const DOCUMENT_WIZARD_BASE = '/documents/wizard';
const DOCUMENT_WIZARD_START_TIMEOUT_MS = 90_000;
const DOCUMENT_WIZARD_GENERATE_TIMEOUT_MS = 180_000;

type DocumentWizardPersistenceOptions = {
  conversationId?: string;
  assistantMessageId?: string;
  documentType?: string;
  format?: string;
};

const DETECT_FALLBACK: DetectDocumentRequestResult = {
  isDocumentRequest: false,
  documentType: null,
  format: null,
  confidence: 0,
  expectedResponseType: 'text',
  needsForm: false,
  formReason: null,
};

const CLASSIFY_FALLBACK: ChatClassificationResult = {
  responseType: 'text',
  confidence: 0,
  subIntent: null,
  label: 'Thinking',
  description: 'Getting your answer ready',
};

export async function classifyChatResponse(
  message: string,
  attachments: { fileName?: string; mimeType?: string }[] = [],
): Promise<ChatClassificationResult> {
  try {
    const response: AxiosResponse<ApiResponse<ChatClassificationResult>> = await apiClient.post('/chat/classify', {
      message,
      attachments,
      hasImageAttachment: attachments.some((item) => item.mimeType?.toLowerCase().startsWith('image/')),
      hasDocumentAttachment: attachments.some((item) => !item.mimeType?.toLowerCase().startsWith('image/')),
    });
    return response.data?.data ? { ...CLASSIFY_FALLBACK, ...response.data.data } : CLASSIFY_FALLBACK;
  } catch {
    return CLASSIFY_FALLBACK;
  }
}

export async function detectDocumentRequest(message: string): Promise<DetectDocumentRequestResult> {
  try {
    const response: AxiosResponse<DetectResponse> = await apiClient.post(`${DOCUMENT_WIZARD_BASE}/detect`, { message });
    const payload = response.data?.data;
    if (!payload) {
      return DETECT_FALLBACK;
    }
    return {
      ...DETECT_FALLBACK,
      ...payload,
      expectedResponseType: payload.expectedResponseType ?? payload.responseType ?? 'text',
    };
  } catch {
    return DETECT_FALLBACK;
  }
}

export async function startDocumentWizard(userRequest: string, options?: DocumentWizardPersistenceOptions) {
  try {
    const response: AxiosResponse<StartWizardResponse> = await apiClient.post(`${DOCUMENT_WIZARD_BASE}/start`, {
      userRequest,
      documentType: options?.documentType,
      format: options?.format,
      conversationId: options?.conversationId,
    }, {
      timeout: DOCUMENT_WIZARD_START_TIMEOUT_MS,
    });
    if (!response.data?.success || !response.data.data?.html) {
      throw new Error(response.data?.message || 'Failed to prepare document form.');
    }
    const result = response.data.data;
    if (!result.userMessageId || !result.assistantMessageId) {
      throw new Error('Document form started, but message IDs were not returned.');
    }
    return result;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function generateDocumentFromWizard(
  formData: Record<string, string>,
  documentType: string,
  format: string,
  options?: DocumentWizardPersistenceOptions,
) {
  try {
    const requestPayload = {
      formData,
      documentType,
      format,
      conversationId: options?.conversationId,
      assistantMessageId: options?.assistantMessageId,
    };
    if (__DEV__) {
      console.log('[document-wizard:generate:request]', JSON.stringify({
        endpoint: `${DOCUMENT_WIZARD_BASE}/generate`,
        payload: requestPayload,
      }));
    }
    const response: AxiosResponse<GenerateWizardResponse> = await apiClient.post(`${DOCUMENT_WIZARD_BASE}/generate`, requestPayload, {
      timeout: DOCUMENT_WIZARD_GENERATE_TIMEOUT_MS,
    });
    if (__DEV__) {
      console.log('[document-wizard:generate:response]', JSON.stringify({
        endpoint: `${DOCUMENT_WIZARD_BASE}/generate`,
        status: response.status,
        body: response.data,
      }));
    }
    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Failed to generate document.');
    }
    return response.data.data?.artifacts ?? [];
  } catch (error) {
    if (__DEV__) {
      console.warn('[document-wizard:generate:error]', error);
    }
    throw mapApiError(error);
  }
}

export async function generateDocumentDirect(
  message: string,
  documentType: string | null,
  format: string | null,
  conversationId?: string,
) {
  try {
    const response: AxiosResponse<GenerateDirectResponse> = await apiClient.post(
      `${DOCUMENT_WIZARD_BASE}/generate-direct`,
      {
        message,
        documentType: documentType || undefined,
        format: format || undefined,
        conversationId,
      },
      { timeout: DOCUMENT_WIZARD_GENERATE_TIMEOUT_MS },
    );
    if (!response.data?.success || !response.data.data?.artifacts) {
      throw new Error(response.data?.message || 'Failed to generate document.');
    }
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

export async function getDocumentWizardHistory(page = 1, limit = 20) {
  try {
    const response: AxiosResponse<HistoryWizardResponse> = await apiClient.get(`${DOCUMENT_WIZARD_BASE}/history`, {
      params: { page, limit },
    });
    if (!response.data?.success || !response.data.data) {
      throw new Error(response.data?.message || 'Failed to load document history.');
    }
    return response.data.data;
  } catch (error) {
    throw mapApiError(error);
  }
}

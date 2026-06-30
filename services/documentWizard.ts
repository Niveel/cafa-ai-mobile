import { AxiosResponse } from 'axios';

import { apiClient } from '@/services/api';
import { mapApiError } from '@/services/api/error.mapper';
import {
  ApiResponse,
  DetectDocumentRequestResult,
  DocumentWizardArtifact,
  DocumentWizardHistoryPage,
} from '@/types';

type DetectResponsePayload = Omit<DetectDocumentRequestResult, 'expectedResponseType'> & {
  expectedResponseType?: DetectDocumentRequestResult['expectedResponseType'];
  responseType?: DetectDocumentRequestResult['expectedResponseType'];
};

type DetectResponse = ApiResponse<DetectResponsePayload>;
type StartWizardResponse = ApiResponse<{ html: string }>;
type GenerateWizardResponse = ApiResponse<{ artifacts: DocumentWizardArtifact[] }>;
type HistoryWizardResponse = ApiResponse<DocumentWizardHistoryPage>;

const DOCUMENT_WIZARD_BASE = '/documents/wizard';

type DocumentWizardPersistenceOptions = {
  conversationId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
};

const DETECT_FALLBACK: DetectDocumentRequestResult = {
  isDocumentRequest: false,
  documentType: null,
  format: null,
  confidence: 0,
  expectedResponseType: 'text',
};

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
      conversationId: options?.conversationId,
      userMessageId: options?.userMessageId,
      assistantMessageId: options?.assistantMessageId,
    });
    if (!response.data?.success || !response.data.data?.html) {
      throw new Error(response.data?.message || 'Failed to prepare document form.');
    }
    return response.data.data.html;
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
    const response: AxiosResponse<GenerateWizardResponse> = await apiClient.post(`${DOCUMENT_WIZARD_BASE}/generate`, {
      formData,
      documentType,
      format,
      conversationId: options?.conversationId,
      userMessageId: options?.userMessageId,
      assistantMessageId: options?.assistantMessageId,
    });
    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Failed to generate document.');
    }
    return response.data.data?.artifacts ?? [];
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

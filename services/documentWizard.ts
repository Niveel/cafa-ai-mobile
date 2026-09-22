import { AxiosResponse } from 'axios';

import { apiClient } from '@/services/api';
import { mapApiError } from '@/services/api/error.mapper';
import {
  ApiResponse,
  DocumentWizardArtifact,
  DocumentWizardHistoryPage,
  GenerateDocumentDirectResult,
  StartDocumentWizardResult,
} from '@/types';

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

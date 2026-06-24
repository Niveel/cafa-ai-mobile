import { AxiosError, AxiosResponse } from 'axios';

import { AnalyticsEvents } from '@/lib/analytics/events';
import { captureEvent } from '@/lib/analytics/posthog';
import { apiClient, apiEndpoints, mapApiError } from '@/services/api';
import type {
  ApiResponse,
  DetectAiRequest,
  DetectAiResult,
  HumanizeRequest,
  HumanizeResult,
  WritingToolError,
  WritingToolQuota,
} from '@/types';

type ToolErrorPayload = {
  success?: false;
  error?: string;
  code?: string;
  message?: string;
  data?: Partial<WritingToolQuota> & Record<string, unknown>;
};

function toWritingToolError(error: unknown): WritingToolError {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as ToolErrorPayload | undefined;
    const mapped = new Error(
      payload?.message ?? payload?.error ?? error.message ?? 'Request failed.',
    ) as WritingToolError;
    mapped.code = payload?.code ?? payload?.error ?? (error.response ? undefined : (error.code ?? 'NETWORK_ERROR'));
    mapped.status = error.response?.status;
    mapped.data = payload?.data;
    return mapped;
  }

  const mapped = mapApiError(error) as WritingToolError;
  return mapped;
}

export async function getDetectAiQuota() {
  try {
    const response: AxiosResponse<ApiResponse<WritingToolQuota>> = await apiClient.get(
      apiEndpoints.tools.detectAiQuota,
    );
    return response.data.data;
  } catch (error) {
    throw toWritingToolError(error);
  }
}

export async function detectAi(request: DetectAiRequest) {
  captureEvent(AnalyticsEvents.aiDetectionStarted, {
    characters: request.text.trim().length,
  });

  try {
    const response: AxiosResponse<ApiResponse<DetectAiResult>> = await apiClient.post(
      apiEndpoints.tools.detectAi,
      request,
    );
    captureEvent(AnalyticsEvents.aiDetectionCompleted, {
      isAiGenerated: response.data.data.isAiGenerated,
      confidence: response.data.data.confidence,
    });
    return response.data.data;
  } catch (error) {
    const mapped = toWritingToolError(error);
    captureEvent(AnalyticsEvents.aiDetectionFailed, {
      code: mapped.code ?? null,
      status: mapped.status ?? null,
    });
    throw mapped;
  }
}

export async function getHumanizeQuota() {
  try {
    const response: AxiosResponse<ApiResponse<WritingToolQuota>> = await apiClient.get(
      apiEndpoints.tools.humanizeQuota,
    );
    return response.data.data;
  } catch (error) {
    throw toWritingToolError(error);
  }
}

export async function humanizeText(request: HumanizeRequest) {
  captureEvent(AnalyticsEvents.humanizeStarted, {
    characters: request.text.trim().length,
    style: request.style ?? 'professional',
    intensity: request.intensity ?? 'medium',
  });

  try {
    const response: AxiosResponse<ApiResponse<HumanizeResult>> = await apiClient.post(
      apiEndpoints.tools.humanize,
      request,
    );
    captureEvent(AnalyticsEvents.humanizeCompleted, {
      modelTier: response.data.data.modelTier,
      factCheckPassed: response.data.data.factCheckPassed,
    });
    return response.data.data;
  } catch (error) {
    const mapped = toWritingToolError(error);
    captureEvent(AnalyticsEvents.humanizeFailed, {
      code: mapped.code ?? null,
      status: mapped.status ?? null,
    });
    throw mapped;
  }
}

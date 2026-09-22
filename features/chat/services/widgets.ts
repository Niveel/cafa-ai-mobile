import { apiClient, apiEndpoints } from '@/services/api';
import { ApiResponse } from '@/types';
import { resolveUploadMimeType } from './authenticated';

export type WidgetUploadResult = { url: string; name: string };

/**
 * Real, eager file upload for a render_widget "file" field -- ports web's
 * uploadWidgetFile (chat-shell/AssistantWidget.tsx). Uploads up front and
 * references the returned URL in the form response, unlike the composer's
 * attach-and-send-with-the-message flow. Hits the backend's standalone
 * POST /chat/upload directly (mobile talks to cafatest.niveel.com without
 * a BFF, unlike web's /api/chat/upload proxy).
 */
export async function uploadWidgetFile(
  uri: string,
  fileName: string,
  mimeType?: string,
): Promise<WidgetUploadResult> {
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: fileName,
    type: resolveUploadMimeType(fileName, mimeType),
  } as unknown as Blob);

  const response = await apiClient.post<ApiResponse<WidgetUploadResult>>(
    apiEndpoints.chat.upload,
    formData,
    { headers: { Accept: 'application/json', 'Content-Type': 'multipart/form-data' } },
  );
  if (!response.data?.success || !response.data.data?.url) {
    throw new Error(response.data?.message ?? 'Upload failed. Please try again.');
  }
  return response.data.data;
}

/**
 * Real, fire-and-forget orphan cleanup -- ports web's deleteUploadedFile.
 * A failed cleanup just leaves one small orphaned file in storage, never
 * worth blocking or erroring the user's actual action over.
 */
export function deleteUploadedWidgetFile(url: string) {
  void apiClient
    .delete(apiEndpoints.chat.upload, { data: { url } })
    .catch(() => {});
}

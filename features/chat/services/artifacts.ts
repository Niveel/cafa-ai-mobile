import { apiClient, apiEndpoints } from '@/services/api';
import { ApiResponse } from '@/types';

/**
 * Real deletion of one generated artifact -- ports web's deleteArtifact
 * (features/chat/services/chat.ts). Deletes the actual underlying file
 * (Cloudinary asset) server-side, not just a client-side hide.
 */
export async function deleteArtifact(
  conversationId: string,
  messageId: string,
  toolCallIndex: number,
): Promise<void> {
  const response = await apiClient.delete<ApiResponse<unknown>>(
    apiEndpoints.chat.deleteArtifact(conversationId, messageId, toolCallIndex),
  );
  if (!response.data?.success) {
    throw new Error(response.data?.message ?? 'Could not delete this file. Please try again.');
  }
}

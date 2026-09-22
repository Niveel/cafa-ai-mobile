import { AxiosResponse } from 'axios';
import { apiClient, apiEndpoints } from '@/services/api';
import { ApiResponse } from '@/types';

export type ProductLinkResolution = { url: string; confidence: 'exact' | 'fallback' };

/**
 * Resolves a real, specific merchant link for one product, on demand --
 * ports web's resolveProductLink (features/chat/services/products.ts).
 * Same real trade-off: ~1.5s, best-effort, so only called for the one
 * product someone actually opens, never for the whole list upfront. Falls
 * back to the original Google Shopping link on any failure -- never blocks
 * "view details" over a resolution error.
 */
export async function resolveProductLink(
  title: string,
  source: string,
  fallbackUrl: string,
): Promise<ProductLinkResolution> {
  try {
    const response: AxiosResponse<ApiResponse<ProductLinkResolution>> = await apiClient.post(
      apiEndpoints.chat.resolveProductLink,
      { title, source, fallbackUrl },
    );
    if (response.data?.success && response.data.data?.url) {
      return response.data.data;
    }
    return { url: fallbackUrl, confidence: 'fallback' };
  } catch {
    return { url: fallbackUrl, confidence: 'fallback' };
  }
}

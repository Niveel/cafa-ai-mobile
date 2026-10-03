import { API_BASE_URL } from '@/lib/client/base-url';

const registrableDomain = (host: string) => host.split('.').slice(-2).join('.').toLowerCase();

/**
 * The login token is only sent to our own servers. A reply can contain a file URL
 * on another site, and the token must never go there, so for any other host the
 * auth header is dropped.
 */
export function headersForAssetUrl(
  url: string,
  headers?: Record<string, string>,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  try {
    const target = new URL(url).hostname;
    const own = new URL(API_BASE_URL).hostname;
    return registrableDomain(target) === registrableDomain(own) ? headers : undefined;
  } catch {
    return undefined;
  }
}

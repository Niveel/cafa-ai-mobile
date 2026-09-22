import { API_BASE_URL } from '@/lib';

export function resolveAvatarUri(input?: string | null) {
  if (!input) return undefined;
  const value = input.trim();
  if (!value) return undefined;
  if (/^(https?:|file:|content:|data:)/i.test(value)) return value;

  const apiOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/i, '');
  if (value.startsWith('/')) return `${apiOrigin}${value}`;
  return `${apiOrigin}/${value}`;
}

export function resolveAvatarUriCandidates(input?: string | null) {
  if (!input) return [];
  const value = input.trim();
  if (!value) return [];
  if (/^(https?:|file:|content:|data:)/i.test(value)) return [value];

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  const apiOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/i, '');
  const prodOrigin = 'https://cafaapi.niveel.com';

  return Array.from(new Set([
    `${apiOrigin}${withLeadingSlash}`,
    `${apiOrigin}/api/v1${withLeadingSlash}`,
    `${prodOrigin}${withLeadingSlash}`,
  ]));
}

// Real fix: AppDrawerContent and AccountSection (rendered together -- the
// settings modal opens on top of the still-mounted drawer) each used to run
// their own identical sequential-GET probe over the same avatar candidate
// URLs, doubling avatar-related network traffic on every Settings open.
// This in-flight cache, keyed by the exact candidates + token, lets whichever
// caller starts first do the real work while any concurrent caller for the
// same avatar just awaits that same promise instead of firing its own GETs.
const inFlightAvatarProbes = new Map<string, Promise<string>>();

export function probeAvatarCandidates(candidates: string[], accessToken: string | null): Promise<string> {
  const key = `${accessToken ?? ''}::${candidates.join('|')}`;
  const existing = inFlightAvatarProbes.get(key);
  if (existing) return existing;

  const probe = (async () => {
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate, {
          method: 'GET',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        if (response.ok) return candidate;
      } catch {
        // try next candidate
      }
    }
    return candidates[0];
  })();

  inFlightAvatarProbes.set(key, probe);
  void probe.finally(() => {
    inFlightAvatarProbes.delete(key);
  });

  return probe;
}

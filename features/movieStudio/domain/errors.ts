export const UPGRADE_REQUIRED = 'MOVIE_STUDIO_UPGRADE_REQUIRED';
export const INSUFFICIENT_CREDITS = 'MOVIE_STUDIO_INSUFFICIENT_CREDITS';

export class StudioError extends Error {
  code?: string;
  httpStatus?: number;
  constructor(message: string, code?: string, httpStatus?: number) {
    super(message);
    this.name = 'StudioError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Flattens string | [{loc,msg}] | object payload fields into one readable line (spec 7.1). */
export function flattenMessage(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim();
        if (!isRecord(entry)) return '';
        const msg = flattenMessage(entry.msg ?? entry.message);
        const loc = Array.isArray(entry.loc) ? entry.loc.filter((p) => p !== 'body').map(String).join(' → ') : '';
        return loc && msg ? `${loc}: ${msg}` : msg;
      })
      .filter(Boolean)
      .join('; ');
  }
  if (isRecord(value)) {
    for (const key of ['message', 'msg', 'detail', 'details', 'code']) {
      const nested = flattenMessage(value[key]);
      if (nested) return nested;
    }
  }
  return '';
}

export function parseStudioError(
  payload: unknown,
  httpStatus?: number,
  fallback = 'Something went wrong. Please try again.',
): StudioError {
  const body = isRecord(payload) ? payload : {};
  const message = flattenMessage(body.message) || flattenMessage(body.error) || flattenMessage(body.detail) || fallback;
  const code = typeof body.error === 'string' ? body.error : typeof body.code === 'string' ? body.code : undefined;
  return new StudioError(message, code, httpStatus);
}

import { File } from 'expo-file-system';

/**
 * File type helpers for downloads. The backend often gives a generated file no
 * name, or a generic one, so the type is detected from the file's own first
 * bytes (like the OS and ChatGPT/Gemini do) instead of trusting a name or a
 * generic "application/octet-stream".
 */
export type FileKind =
  | 'pdf'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'markdown'
  | 'text'
  | 'csv'
  | 'json'
  | 'html'
  | 'zip'
  | 'image'
  | 'video'
  | 'audio'
  | 'other';

export type FileIdentity = {
  extension: string;
  mimeType: string;
  kind: FileKind;
};

const BY_EXTENSION: Record<string, { mime: string; kind: FileKind }> = {
  pdf: { mime: 'application/pdf', kind: 'pdf' },
  doc: { mime: 'application/msword', kind: 'word' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'word' },
  xls: { mime: 'application/vnd.ms-excel', kind: 'excel' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'excel' },
  ppt: { mime: 'application/vnd.ms-powerpoint', kind: 'powerpoint' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'powerpoint' },
  md: { mime: 'text/markdown', kind: 'markdown' },
  txt: { mime: 'text/plain', kind: 'text' },
  csv: { mime: 'text/csv', kind: 'csv' },
  json: { mime: 'application/json', kind: 'json' },
  html: { mime: 'text/html', kind: 'html' },
  zip: { mime: 'application/zip', kind: 'zip' },
  png: { mime: 'image/png', kind: 'image' },
  jpg: { mime: 'image/jpeg', kind: 'image' },
  jpeg: { mime: 'image/jpeg', kind: 'image' },
  webp: { mime: 'image/webp', kind: 'image' },
  gif: { mime: 'image/gif', kind: 'image' },
  heic: { mime: 'image/heic', kind: 'image' },
  mp4: { mime: 'video/mp4', kind: 'video' },
  mov: { mime: 'video/quicktime', kind: 'video' },
  m4v: { mime: 'video/x-m4v', kind: 'video' },
  webm: { mime: 'video/webm', kind: 'video' },
  mp3: { mime: 'audio/mpeg', kind: 'audio' },
  m4a: { mime: 'audio/mp4', kind: 'audio' },
  wav: { mime: 'audio/wav', kind: 'audio' },
  ogg: { mime: 'audio/ogg', kind: 'audio' },
  flac: { mime: 'audio/flac', kind: 'audio' },
};

const GENERIC_MIME = new Set(['', 'application/octet-stream', 'binary/octet-stream', 'application/x-binary']);
const GENERIC_EXTENSIONS = new Set(['', 'bin', 'tmp', 'dat', 'file', 'download']);

export const FILE_KIND_LABEL: Record<FileKind, string> = {
  pdf: 'PDF',
  word: 'Word document',
  excel: 'Excel spreadsheet',
  powerpoint: 'PowerPoint',
  markdown: 'Markdown',
  text: 'Text file',
  csv: 'CSV',
  json: 'JSON',
  html: 'HTML',
  zip: 'ZIP archive',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  other: 'File',
};

export function extensionOf(name: string | null | undefined): string {
  const match = (name ?? '').trim().match(/\.([a-z0-9]{1,8})$/i);
  return match ? match[1].toLowerCase() : '';
}

export function identityFromExtension(extension: string): FileIdentity | null {
  const info = BY_EXTENSION[extension.toLowerCase()];
  return info ? { extension: extension.toLowerCase(), mimeType: info.mime, kind: info.kind } : null;
}

export function identityFromMime(mimeType: string | null | undefined): FileIdentity | null {
  const mime = (mimeType ?? '').toLowerCase().split(';')[0].trim();
  if (GENERIC_MIME.has(mime)) return null;
  const exact = Object.entries(BY_EXTENSION).find(([, info]) => info.mime === mime);
  if (exact) return { extension: exact[0], mimeType: exact[1].mime, kind: exact[1].kind };
  if (mime.includes('pdf')) return identityFromExtension('pdf');
  if (mime.includes('wordprocessingml') || mime.includes('msword')) return identityFromExtension('docx');
  if (mime.includes('spreadsheetml') || mime.includes('ms-excel')) return identityFromExtension('xlsx');
  if (mime.includes('presentationml') || mime.includes('ms-powerpoint')) return identityFromExtension('pptx');
  if (mime.includes('markdown')) return identityFromExtension('md');
  if (mime.startsWith('text/')) return identityFromExtension('txt');
  return null;
}

export function kindFromFileName(name: string | null | undefined, mimeType?: string | null): FileKind {
  return (
    identityFromExtension(extensionOf(name))?.kind ?? identityFromMime(mimeType)?.kind ?? 'other'
  );
}

function readHead(localUri: string, length: number): Uint8Array | null {
  let handle: ReturnType<File['open']> | null = null;
  try {
    handle = new File(localUri).open();
    return handle.readBytes(length);
  } catch {
    return null;
  } finally {
    try {
      handle?.close();
    } catch {
      // ignore
    }
  }
}

const ascii = (bytes: Uint8Array, start: number, end: number) => {
  let text = '';
  for (let i = start; i < Math.min(end, bytes.length); i += 1) text += String.fromCharCode(bytes[i]);
  return text;
};

function looksLikeText(bytes: Uint8Array): boolean {
  const sample = Math.min(bytes.length, 512);
  if (sample === 0) return false;
  let printable = 0;
  for (let i = 0; i < sample; i += 1) {
    const byte = bytes[i];
    if (byte === 0) return false;
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte < 127) || byte >= 128) printable += 1;
  }
  return printable / sample > 0.95;
}

/** Detects a file's real type from its first bytes. Returns null if unsure. */
export function sniffFileType(localUri: string): FileIdentity | null {
  return identityFromBytes(readHead(localUri, 4096));
}

/** Detects a file's type from its first bytes (already read). Returns null if unsure. */
export function identityFromBytes(bytes: Uint8Array | null): FileIdentity | null {
  if (!bytes || bytes.length < 4) return null;
  const head4 = ascii(bytes, 0, 4);

  if (head4 === '%PDF') return identityFromExtension('pdf');
  if (bytes[0] === 0x89 && head4.slice(1) === 'PNG') return identityFromExtension('png');
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return identityFromExtension('jpg');
  if (head4 === 'GIF8') return identityFromExtension('gif');
  if (head4 === 'RIFF') {
    const form = ascii(bytes, 8, 12);
    if (form === 'WEBP') return identityFromExtension('webp');
    if (form === 'WAVE') return identityFromExtension('wav');
  }
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    if (brand === 'qt  ') return identityFromExtension('mov');
    if (brand === 'M4A ') return identityFromExtension('m4a');
    if (brand.startsWith('hei') || brand.startsWith('mif')) return identityFromExtension('heic');
    return identityFromExtension('mp4');
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return identityFromExtension('webm');
  if (head4.startsWith('ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return identityFromExtension('mp3');
  if (head4 === 'OggS') return identityFromExtension('ogg');
  if (head4 === 'fLaC') return identityFromExtension('flac');

  if (head4 === 'PK\u0003\u0004') {
    // Office files are ZIPs; the entry names inside tell them apart.
    const inner = ascii(bytes, 0, bytes.length);
    if (inner.includes('word/')) return identityFromExtension('docx');
    if (inner.includes('xl/')) return identityFromExtension('xlsx');
    if (inner.includes('ppt/')) return identityFromExtension('pptx');
    return identityFromExtension('zip');
  }

  if (looksLikeText(bytes)) {
    const start = ascii(bytes, 0, 64).trimStart().toLowerCase();
    if (start.startsWith('<!doctype html') || start.startsWith('<html')) return identityFromExtension('html');
    if (start.startsWith('{') || start.startsWith('[')) return identityFromExtension('json');
    return identityFromExtension('txt');
  }
  return null;
}

const GENERATED_NAME = /^cafa[-_ ]?(?:ai)?[-_ ]?(?:file|download)?[-_ ]?\d{6,}$/i;

function cleanBaseName(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 80)
    .trim();
}

/**
 * Decides the final file name, MIME type and kind for a downloaded file.
 * Detected content wins over a missing or generic name/MIME; text-like content
 * keeps a more specific name hint (.md, .csv, .json).
 */
export function resolveFileIdentity(options: {
  localUri: string;
  fileName?: string | null;
  mimeType?: string | null;
  titleHint?: string | null;
}): { fileName: string; mimeType: string; kind: FileKind; extension: string } {
  const nameExtension = extensionOf(options.fileName);
  const fromName = GENERIC_EXTENSIONS.has(nameExtension) ? null : identityFromExtension(nameExtension);
  const fromMime = identityFromMime(options.mimeType);
  const sniffed = sniffFileType(options.localUri);

  let chosen: FileIdentity | null = sniffed;
  if (sniffed && (sniffed.kind === 'text' || sniffed.kind === 'json' || sniffed.kind === 'html')) {
    // Plain text can legitimately be markdown/csv/json/etc.; trust a specific hint.
    const specificHint = [fromName, fromMime].find((hint) => hint && ['markdown', 'csv', 'json', 'html', 'text'].includes(hint.kind));
    if (specificHint) chosen = specificHint;
  }
  chosen = chosen ?? fromName ?? fromMime ?? { extension: 'bin', mimeType: 'application/octet-stream', kind: 'other' };

  const providedBase = cleanBaseName((options.fileName ?? '').replace(/\.[a-z0-9]{1,8}$/i, ''));
  const titleBase = cleanBaseName(options.titleHint ?? '');
  const useTitle = titleBase && (!providedBase || GENERATED_NAME.test(providedBase) || /^(file|download|document)$/i.test(providedBase));
  // Last resort only: a plain dated name rather than a branded placeholder.
  const base = (useTitle ? titleBase : providedBase) || titleBase || `Document ${new Date().toISOString().slice(0, 10)}`;

  return {
    fileName: `${base}.${chosen.extension}`,
    mimeType: chosen.mimeType,
    kind: chosen.kind,
    extension: chosen.extension,
  };
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

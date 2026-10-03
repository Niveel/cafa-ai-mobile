/**
 * When a reply comes with a file card (the generated PDF/Word/PowerPoint), the
 * card IS the download. The model often also writes its own "Download: [x.pdf](url)"
 * line or pastes the raw file URL, which then shows up as a stray link under the
 * card. This removes those links, and the short "download it here:" line that
 * introduces them, from the displayed text only. Other links (sources, websites)
 * are left alone.
 */
const FILE_EXTENSIONS = 'pdf|docx?|pptx?|xlsx?|csv|md|markdown|txt|zip|rtf|odt|json';
const FILE_EXTENSION_AT_END = new RegExp(`\\.(?:${FILE_EXTENSIONS})$`, 'i');
const FILE_PATH_SEGMENT = /\/(?:download|downloads|artifacts?|files?)\//i;

// [label](https://...) with an optional "title"
const MARKDOWN_LINK = /\[([^\]]*)\]\(\s*<?(https?:\/\/[^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/gi;
const BARE_URL = /https?:\/\/[^\s<>()[\]"']+/gi;
const DOWNLOAD_WORDS = /download|link|here|click|tap|access|available|get (?:it|your)|file|document|pdf|docx|pptx|xlsx|presentation/i;
// Emoji and symbols, so a line like "📥" counts as empty.
const SYMBOLS = /[←-⯿\uD83C-􏰀-\uDFFF️‍]/g;

function pathKey(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname).toLowerCase();
  } catch {
    return (url.split(/[?#]/)[0] ?? '').toLowerCase();
  }
}

export function stripFileDownloadLinks(text: string, fileUrls: string[], streaming = false): string {
  if (!text || !/https?:\/\/|\]\(/.test(text)) return text;

  const known = new Set(fileUrls.filter(Boolean).map(pathKey));
  const isFileUrl = (url: string) => {
    const key = pathKey(url);
    return known.has(key) || FILE_EXTENSION_AT_END.test(key) || FILE_PATH_SEGMENT.test(key);
  };

  let source = text;
  if (streaming) {
    // A link that is still being written, e.g. "[report.pdf](https://med", would flash on screen.
    source = source.replace(/\[[^\]\n]*\]\([^)\n]*$/, '').replace(/https?:\/\/[^\s]*$/, '');
  }

  const out: string[] = [];
  for (const line of source.split('\n')) {
    let removed = false;
    let next = line.replace(MARKDOWN_LINK, (match, _label: string, url: string) => {
      if (!isFileUrl(url)) return match;
      removed = true;
      return '';
    });
    next = next.replace(BARE_URL, (url) => {
      if (!isFileUrl(url)) return url;
      removed = true;
      return '';
    });

    if (!removed) {
      out.push(line);
      continue;
    }

    next = next
      .replace(/\(\s*(?:see|at|from|via|link|here|download)?\s*:?\s*\)/gi, '')
      .replace(/\(\s*\)|\[\s*\]|<\s*>/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .trim();

    // "Done! You can grab it here:" -> keep "Done!", drop the lead-in clause.
    const boundary = Math.max(next.lastIndexOf('. '), next.lastIndexOf('! '), next.lastIndexOf('? '));
    if (boundary >= 0) {
      const tail = next.slice(boundary + 2);
      if (/:\s*$/.test(tail) || DOWNLOAD_WORDS.test(tail)) next = next.slice(0, boundary + 1).trim();
    }

    const onlyDecoration = next.replace(SYMBOLS, '').replace(/[\s*_`>#~|\-–—•:.,;!?()[\]]/g, '') === '';
    if (onlyDecoration || (next.length <= 70 && DOWNLOAD_WORDS.test(next))) {
      // The line only existed to carry the link. Also drop a lead-in such as
      // "Download your PDF:" that was sitting on the line above it.
      const previous = out[out.length - 1];
      if (previous !== undefined && previous.trim().length <= 90 && /:\s*(?:\*\*)?$/.test(previous.trim()) && DOWNLOAD_WORDS.test(previous)) {
        out.pop();
      }
      continue;
    }
    out.push(next);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
}

/**
 * Removes raw chat-template markers that the model sometimes leaks into its
 * reply, e.g. "<|im_start|><|im_start|>assistant" at the top of a message.
 * They are never meant for the user, so they are cleaned wherever reply text is
 * shown or copied.
 *
 * Only `<|name|>` markers are touched (a name of 2-32 letters, digits or
 * underscores), so ordinary text and operators such as `<|>` are left alone.
 */
const ROLE_HEADER = /(?:<\|im_start\|>\s*)+(?:assistant|user|system)?[ \t]*\n*/gi;
const ANY_MARKER = /<\|[a-z0-9_]{2,32}\|>/gi;
// A marker that is still arriving: "<|", "<|im_st", "<|im_start|" at the very end.
const PARTIAL_MARKER_AT_END = /<\|[a-z0-9_]{0,32}\|?$/i;

export function sanitizeModelText(text: string, streaming = false): string {
  if (!text || !text.includes('<|')) return text;
  if (streaming) {
    // Header still arriving, e.g. "<|im_start|>assis": nothing to show yet.
    const partialRole = /^(?:<\|im_start\|>\s*)+([a-z]{0,9})$/i.exec(text)?.[1];
    if (partialRole !== undefined && ['assistant', 'user', 'system'].some((role) => role.startsWith(partialRole.toLowerCase()))) {
      return '';
    }
  }
  let cleaned = text.replace(ROLE_HEADER, '').replace(ANY_MARKER, '');
  if (streaming) cleaned = cleaned.replace(PARTIAL_MARKER_AT_END, '');
  return cleaned;
}

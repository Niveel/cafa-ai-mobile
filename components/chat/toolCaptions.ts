/**
 * User-facing captions for native tool calls. The backend's tool_start
 * `label` is a debug-style string (e.g. `Generating an image: "<full
 * prompt>..."`) and reasoning text mentions raw tool identifiers such as
 * `generate_image`, so the chat maps both to short, localized copy instead.
 */
type Translate = (key: string, params?: Record<string, string>) => string;

export type ToolCaptionState = 'running' | 'done' | 'failed';

const TOOL_KEYS: Record<string, string> = {
  generate_image: 'image',
  edit_image: 'editImage',
  generate_video: 'video',
  image_to_video: 'imageToVideo',
  generate_document: 'document',
  generate_website: 'website',
  remember: 'memory',
  render_widget: 'widget',
};

const resolveToolKey = (tool: string): string | null => {
  if (TOOL_KEYS[tool]) return TOOL_KEYS[tool];
  if (tool.includes('search')) return 'search';
  return null;
};

export function getToolCaption(
  t: Translate,
  tool: string,
  label: string | undefined,
  state: ToolCaptionState,
): string {
  const key = resolveToolKey(tool);
  if (key) return t(`chat.tool.${key}.${state}`);
  if (state === 'failed') return t('chat.tool.generic.failed');
  // Unknown tool: keep the backend's verb phrase but drop the quoted payload.
  const verbPhrase = label?.split(':')[0]?.replace(/[.…]+$/, '').trim();
  if (verbPhrase && !/^[a-z]+(_[a-z]+)+$/.test(verbPhrase)) return verbPhrase;
  return t(`chat.tool.generic.${state}`);
}

/**
 * Replaces raw tool identifiers in reasoning text with plain words and turns
 * `A -> B` step chains into arrows.
 */
export function humanizeReasoningText(t: Translate, text: string): string {
  let result = text;
  for (const tool of Object.keys(TOOL_KEYS)) {
    if (!result.includes(tool)) continue;
    const name = t(`chat.tool.${TOOL_KEYS[tool]}.name`);
    // "the `generate_image` tool" -> "the image generator": the article and the
    // trailing "tool"/"function" come from the translated name instead.
    result = result.replace(
      new RegExp(`(?:\\bthe\\s+)?\`?${tool}\`?(?:\\s+(?:tool|function))?`, 'gi'),
      name,
    );
  }
  return result
    // Upload URLs / storage paths leak into reasoning when the model reads an
    // attachment; they mean nothing to the user.
    .replace(/\bhttps?:\/\/\S+/gi, '')
    .replace(/\S*\/\S*\/\S+/g, '')
    .replace(/\s*->\s*/g, ' → ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** A live reasoning step worth showing, or null when nothing readable is left. */
export function readableReasoningStep(t: Translate, step: string | undefined): string | null {
  if (!step) return null;
  const cleaned = humanizeReasoningText(t, step).replace(/^[\s.,:;-]+|[\s,:;-]+$/g, '');
  return /[A-Za-zÀ-ɏ]{3,}/.test(cleaned) && cleaned.split(/\s+/).length >= 2 ? cleaned : null;
}

/** Splits a `Step one -> Step two -> Step three` summary into its steps. */
export function splitReasoningSteps(summary: string): string[] {
  return summary
    .split(/\s*(?:->|→)\s*/)
    .map((step) => step.trim())
    .filter(Boolean);
}

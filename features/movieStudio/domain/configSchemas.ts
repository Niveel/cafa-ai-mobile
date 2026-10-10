export type ConfigField = {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'select' | 'duration';
  options?: readonly string[];
};

const text = (key: string, label: string): ConfigField => ({ key, label, kind: 'text' });
const area = (key: string, label: string): ConfigField => ({ key, label, kind: 'textarea' });
const select = (key: string, label: string, options: readonly string[]): ConfigField => ({ key, label, kind: 'select', options });
const duration = (key: string, label: string, seconds: readonly number[]): ConfigField => ({
  key,
  label,
  kind: 'duration',
  options: seconds.map(String),
});

const TONE_ADS = ['AI Recommended', 'Professional', 'Cinematic', 'Emotional', 'Funny', 'Energetic', 'Luxury'];

/** Per-video-type configuration (Auto flow). Every field is required and saved as a string. */
export const CONFIG_SCHEMAS: Record<string, ConfigField[]> = {
  product_advertisement: [
    area('productDescription', 'Product description'),
    select('advertisingObjective', 'Advertising objective', [
      'Increase Sales',
      'Generate Leads',
      'Brand Awareness',
      'Product Launch',
      'App Promotion',
      'Drive Website Traffic',
      'Promote an Offer',
      'Other',
    ]),
    area('targetAudience', 'Target audience'),
    duration('durationSeconds', 'Duration', [15, 30, 45, 60, 90, 120]),
    select('tone', 'Tone', TONE_ADS),
  ],
  short_film: [
    area('premise', 'Premise'),
    area('logline', 'Logline'),
    text('genre', 'Genre'),
    duration('durationSeconds', 'Duration', [60, 180, 300, 600, 900, 1200]),
    text('setting', 'Setting'),
    text('timePeriod', 'Time period'),
    select('storyStructure', 'Story structure', ['AI Recommended', 'Three Act', 'Beginning / Middle / End', 'Non-linear']),
    select('tone', 'Tone', ['AI Recommended', 'Emotional', 'Dark', 'Funny', 'Suspenseful', 'Inspirational', 'Romantic', 'Other']),
  ],
  movie: [
    area('premise', 'Premise'),
    area('logline', 'Logline'),
    text('genre', 'Genre'),
    duration('targetDurationSeconds', 'Target duration', [1800, 3600, 5400, 7200, 9000, 10800]),
    text('setting', 'Setting'),
    text('timePeriod', 'Time period'),
    area('worldBuilding', 'World building'),
  ],
  youtube_video: [
    area('topic', 'Topic'),
    area('targetAudience', 'Target audience'),
    duration('durationSeconds', 'Duration', [60, 180, 300, 480, 600, 900, 1200]),
    text('niche', 'Niche'),
    select('contentStyle', 'Content style', [
      'Educational',
      'Tutorial',
      'Review',
      'Commentary',
      'Documentary',
      'Storytelling',
      'Listicle',
      'Explainer',
      'News / Current Affairs',
      'Entertainment',
      'Other',
    ]),
    select('publishingFormat', 'Publishing format', ['YouTube Long-form', 'YouTube Shorts']),
  ],
  social_media_video: [
    select('platform', 'Platform', ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Facebook Reels', 'Other']),
    area('topic', 'Topic'),
    area('targetAudience', 'Target audience'),
    duration('durationSeconds', 'Duration', [15, 30, 45, 60, 75, 90]),
    area('hook', 'Hook'),
    area('mainMessage', 'Main message'),
    text('callToAction', 'Call to action'),
    select('aspectRatio', 'Aspect ratio', ['9:16', '1:1', '16:9']),
  ],
  documentary: [
    text('topic', 'Topic'),
    area('subject', 'Subject'),
    area('purpose', 'Purpose'),
    text('targetAudience', 'Target audience'),
    duration('durationSeconds', 'Duration', [180, 300, 480, 600, 900, 1200, 1800]),
  ],
  movie_trailer: [
    text('sourceProjectName', 'Source project name'),
    area('description', 'Description'),
    text('genre', 'Genre'),
    duration('targetDurationSeconds', 'Target duration', [30, 45, 60, 90, 120, 150]),
    text('audience', 'Audience'),
    select('style', 'Style', ['Cinematic', 'Action', 'Emotional', 'Suspense', 'Horror', 'Comedy', 'Epic', 'Mystery']),
  ],
  music_video: [
    text('songTitle', 'Song title'),
    text('artist', 'Artist'),
    area('lyrics', 'Lyrics'),
    text('genre', 'Genre'),
    text('mood', 'Mood'),
    duration('durationSeconds', 'Duration', [60, 120, 180, 240, 300, 480]),
    select('visualApproach', 'Visual approach', [
      'Performance-based',
      'Story-based',
      'Dance',
      'Cinematic',
      'Abstract',
      'Generated',
      'Combination',
    ]),
  ],
  explainer_video: [
    text('topic', 'Topic'),
    text('productOrService', 'Product or service'),
    area('problem', 'Problem'),
    area('solution', 'Solution'),
    area('keyPoints', 'Key points'),
    text('targetAudience', 'Target audience'),
  ],
  commercial: [
    text('brandName', 'Brand name'),
    text('campaignName', 'Campaign name'),
    text('productOrService', 'Product or service'),
    area('objective', 'Objective'),
    text('targetAudience', 'Target audience'),
    area('keyMessage', 'Key message'),
  ],
  custom_video: [area('description', 'What do you want to create?')],
};

export const schemaFor = (videoType: string | null): ConfigField[] => CONFIG_SCHEMAS[videoType ?? 'custom_video'] ?? [];

/** Existing config values as form strings (numbers become strings, non-scalars are dropped). */
export function configToForm(videoType: string | null, config: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of schemaFor(videoType)) {
    const v = config[f.key];
    out[f.key] = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
  }
  return out;
}

export const isConfigComplete = (videoType: string | null, form: Record<string, string>) =>
  schemaFor(videoType).every((f) => (form[f.key] ?? '').trim().length > 0);

/** Merge onto the stored config so keys like workflowMode survive. */
export const mergeConfig = (existing: Record<string, unknown>, form: Record<string, string>) => ({
  ...existing,
  ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])),
});

/**
 * Notification `link` values are web routes (confirmed live: `/images`,
 * `/avatar-video`, `/plans`). Most match a mobile screen as-is; the web's
 * `/repo/*` and `/tools/*` prefixes and the chat route do not, so map them.
 * Anything unrecognised opens the home chat instead of a missing screen.
 */
const KNOWN_ROUTES = new Set([
  '/images',
  '/videos',
  '/artifacts',
  '/avatar-video',
  '/avatar-history',
  '/image-to-video',
  '/edit-image',
  '/voice',
  '/plans',
  '/cafa-life',
  '/repo',
  '/tools',
  '/help',
  '/studio',
  '/studio-project',
  '/billing/credits',
  '/billing/payment-method',
]);

const WEB_ALIASES: Record<string, string> = {
  '/repo/images': '/images',
  '/repo/videos': '/videos',
  '/repo/artifacts': '/artifacts',
  '/tools/avatar-video': '/avatar-video',
  '/tools/image-to-video': '/image-to-video',
  '/tools/edit-image': '/edit-image',
  '/tools/voice': '/voice',
  '/billing': '/plans',
};

const readId = (metadata: Record<string, unknown> | null | undefined, ...keys: string[]) => {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

/**
 * Open the exact item a notification is about, not just its list screen.
 * Uses the notification `type` + `metadata` ids (confirmed live:
 * `metadata.imageId`, `metadata.avatarVideoId`); falls back to the link.
 */
export function resolveNotificationTarget(notification: {
  type?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  const { type, metadata } = notification;
  if (type === 'image_ready') {
    const id = readId(metadata, 'imageId', 'id');
    if (id) return `/images?focusId=${encodeURIComponent(id)}`;
  }
  if (type === 'video_ready') {
    const id = readId(metadata, 'videoId', 'id');
    if (id) return `/videos?focusId=${encodeURIComponent(id)}`;
  }
  if (type === 'avatar_video_ready') {
    const id = readId(metadata, 'avatarVideoId', 'videoId', 'id');
    if (id) return `/avatar-history?focusId=${encodeURIComponent(id)}`;
  }
  if (typeof type === 'string' && type.startsWith('movie_studio')) {
    // The exact type names and metadata keys are not documented: accept any movie_studio_* type, take the project id
    // from the metadata or, failing that, from the link. Clip/shot notifications land on Scenes, the rest on Export.
    const id = readId(metadata, 'projectId', 'project_id', 'movieStudioProjectId', 'id') ?? /[a-f0-9]{24}/i.exec(notification.link ?? '')?.[0] ?? null;
    const stage = /clip|shot|scene/i.test(type) ? 'scenes' : 'export';
    return id ? `/studio-project?id=${encodeURIComponent(id)}&stage=${stage}` : '/studio';
  }
  return resolveNotificationRoute(notification.link);
}

export function resolveNotificationRoute(link?: string | null): string {
  const [rawPath, query] = (link ?? '').trim().split('?');
  const path = rawPath.split('#')[0].replace(/\/+$/, '') || '/';
  const mapped = WEB_ALIASES[path] ?? path;
  if (KNOWN_ROUTES.has(mapped)) return query ? `${mapped}?${query}` : mapped;
  // Web Movie Studio links: /movie-studio/... or /studio/... with a project id.
  const studioMatch = /^\/(?:movie-studio|studio)(?:\/projects)?\/([a-f0-9]{24})/i.exec(path);
  if (studioMatch) return `/studio-project?id=${studioMatch[1]}&stage=export`;
  if (path === '/movie-studio') return '/studio';
  const chatMatch = /^\/c\/([a-f0-9]{24})$/i.exec(path);
  if (chatMatch) return `/?conversationId=${chatMatch[1]}`;
  return '/';
}

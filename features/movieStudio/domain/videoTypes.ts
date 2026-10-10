import type { StudioIconName } from '../studioIconNames';

export const VIDEO_TYPES: readonly { id: string; label: string; icon: StudioIconName }[] = [
  { id: 'product_advertisement', label: 'Product Advertisement', icon: 'briefcase-business' },
  { id: 'short_film', label: 'Short Film', icon: 'clapperboard' },
  { id: 'movie', label: 'Movie', icon: 'film' },
  { id: 'tv_series', label: 'TV Series', icon: 'tv' },
  { id: 'music_video', label: 'Music Video', icon: 'music' },
  { id: 'documentary', label: 'Documentary', icon: 'monitor-play' },
  { id: 'youtube_video', label: 'YouTube Video', icon: 'circle-play' },
  { id: 'social_media_video', label: 'Social Media Video', icon: 'rectangle-vertical' },
  { id: 'movie_trailer', label: 'Movie Trailer', icon: 'square-play' },
  { id: 'explainer_video', label: 'Explainer Video', icon: 'panels-top-left' },
  { id: 'commercial', label: 'Commercial', icon: 'megaphone' },
  { id: 'custom_video', label: 'Custom Video', icon: 'chevron-right' },
];

/** movie needs Acts/Sequences and tv_series is a stub on web: both hidden in v1 (decision pending with owner). */
export const HIDDEN_VIDEO_TYPES: readonly string[] = ['movie', 'tv_series'];

export const AUTO_VIDEO_TYPES = VIDEO_TYPES.filter((v) => !HIDDEN_VIDEO_TYPES.includes(v.id));

export const humanizeVideoType = (videoType: string | null) =>
  videoType ? videoType.replace(/_/g, ' ') : 'Custom video';

export const humanizeStep = (step: string) => (step ? step.replace(/_/g, ' ') : 'video type');

export const MAX_TITLE_LENGTH = 200;

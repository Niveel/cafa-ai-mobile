import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PendingAvatarVideoJob } from '@/types';

const PENDING_AVATAR_VIDEO_JOB_KEY = 'cafa_ai_pending_avatar_video_job_v1';

export async function getPendingAvatarVideoJob(): Promise<PendingAvatarVideoJob | null> {
  const raw = await AsyncStorage.getItem(PENDING_AVATAR_VIDEO_JOB_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PendingAvatarVideoJob;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.jobId !== 'string' || !parsed.jobId.trim()) return null;
    if (typeof parsed.avatarImageUrl !== 'string' || !parsed.avatarImageUrl.trim()) return null;
    if (typeof parsed.scriptText !== 'string') return null;
    if (typeof parsed.userGoal !== 'string') return null;
    if (typeof parsed.voiceLabel !== 'string' || !parsed.voiceLabel.trim()) return null;
    if (parsed.voiceName != null && typeof parsed.voiceName !== 'string') return null;
    if (parsed.fishAudioId != null && typeof parsed.fishAudioId !== 'string') return null;
    if (typeof parsed.createdAt !== 'string' || !parsed.createdAt.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setPendingAvatarVideoJob(job: PendingAvatarVideoJob) {
  await AsyncStorage.setItem(PENDING_AVATAR_VIDEO_JOB_KEY, JSON.stringify(job));
}

export async function clearPendingAvatarVideoJob() {
  await AsyncStorage.removeItem(PENDING_AVATAR_VIDEO_JOB_KEY);
}

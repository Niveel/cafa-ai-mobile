import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';

import { AppButton, AppScreen, ChatVideoCard, RequireAuthRoute } from '@/components';
import { deleteAvatarVideo, getAvatarHistory } from '@/features';
import { useAppTheme } from '@/hooks';
import { getAccessToken } from '@/services/storage/session';
import type { AvatarHistoryItem } from '@/types';
import { hapticError, hapticSuccess, saveMediaToCafaAlbum } from '@/utils';

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AvatarHistoryScreen() {
  const { colors, isDark } = useAppTheme();
  const [videos, setVideos] = useState<AvatarHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const page = await getAvatarHistory(1, 50, { forceRefresh: refresh });
      setVideos(page.videos.filter((video) => video.status === 'completed'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load avatar history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const downloadVideo = useCallback(async (video: AvatarHistoryItem) => {
    if (!video.videoUrl || downloadingId) return;
    setDownloadingId(video.id);
    setError('');
    try {
      const fileName = `cafa-avatar-${video.id.replace(/[^a-zA-Z0-9_-]+/g, '-')}.mp4`;
      if (Platform.OS === 'web') {
        const response = await fetch(video.videoUrl);
        if (!response.ok) throw new Error(`Video download failed (${response.status}).`);
        const objectUrl = URL.createObjectURL(await response.blob());
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      } else {
        const target = new File(Paths.cache, fileName);
        target.create({ intermediates: true, overwrite: true });
        const downloaded = await File.downloadFileAsync(video.videoUrl, target, { idempotent: true });
        await saveMediaToCafaAlbum(downloaded.uri);
      }
      hapticSuccess();
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not download this avatar video.');
      hapticError();
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId]);

  const shareVideo = useCallback(async (video: AvatarHistoryItem) => {
    if (!video.videoUrl || sharingId) return;
    setSharingId(video.id);
    setError('');
    try {
      const safeId = video.id.replace(/[^a-zA-Z0-9_-]+/g, '-');
      const target = new File(Paths.cache, `cafa-avatar-${safeId}.mp4`);
      target.create({ intermediates: true, overwrite: true });
      const accessToken = await getAccessToken();
      const downloaded = await File.downloadFileAsync(video.videoUrl, target, {
        idempotent: true,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloaded.uri, {
          mimeType: 'video/mp4',
          dialogTitle: 'Share avatar video',
        });
      } else {
        await Share.share({ url: downloaded.uri });
      }
      hapticSuccess();
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Could not share this avatar video.');
      hapticError();
    } finally {
      setSharingId(null);
    }
  }, [sharingId]);

  const confirmDelete = useCallback((video: AvatarHistoryItem) => {
    Alert.alert('Delete avatar video?', 'This video will be permanently removed from your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setDeletingId(video.id);
            try {
              await deleteAvatarVideo(video.id);
              setVideos((current) => current.filter((item) => item.id !== video.id));
              hapticSuccess();
            } catch (deleteError) {
              setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this avatar video.');
              hapticError();
            } finally {
              setDeletingId(null);
            }
          })();
        },
      },
    ]);
  }, []);

  return (
    <RequireAuthRoute>
      <AppScreen title="Avatar History">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.primary} />}
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Back to avatar video" onPress={() => router.back()} className="mb-4 flex-row items-center self-start py-2">
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 8 }}>Back to creator</Text>
          </Pressable>

          {error ? <Text accessibilityRole="alert" style={{ color: '#DC2626', marginBottom: 16 }}>{error}</Text> : null}
          {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}
          {!loading && videos.length === 0 ? (
            <Text style={{ color: colors.textSecondary, lineHeight: 21 }}>No completed avatar videos yet.</Text>
          ) : null}

          {videos.map((video) => (
            <View key={video.id} className="mb-4 rounded-[22px] border p-4" style={{ borderColor: colors.border, backgroundColor: isDark ? '#11151D' : '#FFFFFF' }}>
              {video.videoUrl ? (
                <ChatVideoCard uri={video.videoUrl} width={300} height={169} borderColor={colors.border} backgroundColor={isDark ? '#101010' : '#FFFFFF'} accessibilityLabel={`Avatar video from ${dateLabel(video.createdAt)}`} />
              ) : null}
              <View className="mt-3 flex-row items-start">
                {video.avatarImageUrl ? <ExpoImage source={{ uri: video.avatarImageUrl }} style={{ width: 52, height: 68, borderRadius: 12 }} contentFit="cover" /> : null}
                <View style={{ flex: 1, marginLeft: video.avatarImageUrl ? 12 : 0 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>{video.voiceName || 'Avatar video'}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>{dateLabel(video.createdAt)}</Text>
                  {video.scriptText ? <Text numberOfLines={3} style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8 }}>{video.scriptText}</Text> : null}
                </View>
              </View>
              <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                {video.videoUrl ? (
                  <>
                    <AppButton label={downloadingId === video.id ? 'Saving...' : 'Download'} iconName="download-outline" compact variant="outline" loading={downloadingId === video.id} onPress={() => { void downloadVideo(video); }} />
                    <AppButton label={sharingId === video.id ? 'Preparing...' : 'Share'} iconName="share-social-outline" compact variant="outline" loading={sharingId === video.id} onPress={() => { void shareVideo(video); }} />
                  </>
                ) : null}
                <AppButton label={deletingId === video.id ? 'Deleting...' : 'Delete'} iconName="trash-outline" compact variant="outline" loading={deletingId === video.id} onPress={() => confirmDelete(video)} />
              </View>
            </View>
          ))}
        </ScrollView>
      </AppScreen>
    </RequireAuthRoute>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, RequireAuthRoute, SecondaryNav } from '@/components';
import { VideoGalleryCard } from '@/components/videos/VideoGalleryCard';
import { useAppTheme, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib/client/base-url';
import { getVideoHistoryPage } from '@/features/videos';
import { getAccessToken } from '@/services/storage/session';
import { apiEndpoints } from '@/services/api';
import { VideoHistoryItem } from '@/types';
import {
  hapticError,
  hapticSelection,
  hapticSuccess,
  openDownloadsCafaFolder,
  saveFileToDownloadsCafaFolder,
  saveMediaToCafaAlbum,
} from '@/utils';

const PAGE_SIZE = 20;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractFilenameFromContentDisposition(value?: string | null) {
  if (!value) return null;
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
  const plainMatch = /filename="?([^";]+)"?/i.exec(value);
  if (plainMatch?.[1]) return plainMatch[1];
  return null;
}

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatProgress(downloadedBytes: number, totalBytes: number) {
  if (totalBytes > 0) {
    return `${formatSize(downloadedBytes)} / ${formatSize(totalBytes)}`;
  }
  return `${formatSize(downloadedBytes)} / --`;
}

function toReadableAndroidPath(fileUri: string) {
  const decoded = decodeURIComponent(fileUri.replace(/^file:\/\//i, ''));
  return decoded.startsWith('/') ? decoded : `/${decoded}`;
}

async function readErrorMessage(response: Response) {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await response.json() as { message?: string; error?: string; code?: string };
      return json.message || json.error || json.code || `Request failed with status ${response.status}`;
    }
    const text = await response.text();
    return text || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export default function VideosScreen() {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zipCompleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingPageRef = useRef(false);
  const isZipDownloadingRef = useRef(false);
  const hasBootstrappedRef = useRef(false);
  const hasNextPageRef = useRef(true);
  const [videos, setVideos] = useState<VideoHistoryItem[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isZipBusy, setIsZipBusy] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');
  const [hasNextPage, setHasNextPage] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const [zipProgress, setZipProgress] = useState<{
    visible: boolean;
    phase: 'idle' | 'preparing' | 'downloading' | 'complete';
    downloadedBytes: number;
    totalBytes: number;
    fileUri: string | null;
    readablePath: string | null;
  }>({
    visible: false,
    phase: 'idle',
    downloadedBytes: 0,
    totalBytes: 0,
    fileUri: null,
    readablePath: null,
  });

  const backendOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/i, '');

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
      if (zipCompleteTimeoutRef.current) clearTimeout(zipCompleteTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (zipProgress.phase !== 'complete' || !zipProgress.visible) return;
    if (zipCompleteTimeoutRef.current) clearTimeout(zipCompleteTimeoutRef.current);
    zipCompleteTimeoutRef.current = setTimeout(() => {
      setZipProgress((prev) => ({ ...prev, visible: false, phase: 'idle' }));
      zipCompleteTimeoutRef.current = null;
    }, 6200);
  }, [zipProgress.phase, zipProgress.visible]);

  useEffect(() => {
    hasNextPageRef.current = hasNextPage;
  }, [hasNextPage]);

  useEffect(() => {
    if (!zipProgress.visible || zipProgress.phase === 'complete') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 780,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 780,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, zipProgress.phase, zipProgress.visible]);

  const showNotice = useCallback((message: string, durationMs = 3200) => {
    setStatusNotice(message);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => {
      setStatusNotice('');
      noticeTimeoutRef.current = null;
    }, durationMs);
  }, []);

  const resolveBackendAssetUrl = useCallback((rawUrl?: string | null) => {
    if (!rawUrl) return null;
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    if (rawUrl.startsWith('/')) return `${backendOrigin}${rawUrl}`;
    return `${backendOrigin}/${rawUrl}`;
  }, [backendOrigin]);

  const loadPage = useCallback(async (page: number, mode: 'replace' | 'append') => {
    if (isLoadingPageRef.current) return;
    if (mode === 'append' && !hasNextPageRef.current) return;
    isLoadingPageRef.current = true;

    if (mode === 'append') {
      setIsLoadingMore(true);
    } else if (page === 1) {
      setIsInitialLoading(true);
    }

    try {
      const payload = await getVideoHistoryPage({
        page,
        limit: PAGE_SIZE,
        sort: 'newest',
      });

      setVideos((prev) => {
        const source = mode === 'replace' ? payload.videos : [...prev, ...payload.videos];
        const deduped = new Map<string, VideoHistoryItem>();
        source.forEach((item) => deduped.set(item.id, item));
        return Array.from(deduped.values());
      });

      setCurrentPage(payload.pagination.page);
      setHasNextPage(Boolean(payload.pagination.hasNextPage ?? (payload.pagination.page < payload.pagination.pages)));
    } catch (error) {
      const typed = error as { status?: number; code?: string; message?: string } | undefined;
      const message = error instanceof Error ? error.message : typed?.message ?? t('videos.loadFailed');
      console.log(`[videos-history:error] endpoint=${API_BASE_URL}/videos/history message="${message}"`);
      if (typed?.status === 429 || (typed?.code ?? '').toUpperCase().includes('RATE_LIMIT')) {
        showNotice(t('videos.rateLimitedRetry'), 5000);
      } else {
        showNotice(message, 5000);
      }
      hapticError();
    } finally {
      isLoadingPageRef.current = false;
      setIsInitialLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
    }
  }, [showNotice, t]);

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;
    void loadPage(1, 'replace');
  }, [loadPage]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    setHasNextPage(true);
    void loadPage(1, 'replace');
  }, [loadPage]);

  const onLoadMore = useCallback(() => {
    if (isInitialLoading || isRefreshing || isLoadingMore || !hasNextPage) return;
    void loadPage(currentPage + 1, 'append');
  }, [currentPage, hasNextPage, isInitialLoading, isLoadingMore, isRefreshing, loadPage]);

  const downloadVideo = useCallback(async (item: VideoHistoryItem) => {
    const fallbackUrl = apiEndpoints.videos.download(item.id);
    const resolvedUrl = resolveBackendAssetUrl(item.downloadUrl ?? item.videoUrl ?? fallbackUrl);
    if (!resolvedUrl) {
      showNotice(t('videos.downloadOneFailed'));
      return;
    }

    hapticSelection();
    showNotice(t('videos.downloadOneStarting'));

    try {
      const extensionMatch = resolvedUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      const extension = extensionMatch?.[1]?.toLowerCase() || 'mp4';
      const fileName = `cafa-ai-video-${item.id}.${extension}`;
      const target = new File(Paths.cache, fileName);
      target.create({ intermediates: true, overwrite: true });

      const accessToken = await getAccessToken();
      const downloaded = await File.downloadFileAsync(resolvedUrl, target, {
        idempotent: true,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      await saveMediaToCafaAlbum(downloaded.uri);
      showNotice(t('videos.downloadOneSuccess'));
      hapticSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('videos.downloadOneFailed');
      console.log(`[videos-download:error] endpoint=${resolvedUrl} message="${message}"`);
      showNotice(t('videos.downloadOneFailed'), 5000);
      hapticError();
    }
  }, [resolveBackendAssetUrl, showNotice, t]);

  const downloadAllAsZip = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    if (isZipDownloadingRef.current) return;
    isZipDownloadingRef.current = true;
    setIsZipBusy(true);
    hapticSelection();
    showNotice(t('videos.zipPreparing'));
    setZipProgress({
      visible: true,
      phase: 'preparing',
      downloadedBytes: 0,
      totalBytes: 0,
      fileUri: null,
      readablePath: null,
    });

    const startEndpoint = `${API_BASE_URL}${apiEndpoints.videos.downloadZip.replace(/^\/api\/v1/i, '')}`;
    let pollEndpoint = startEndpoint;
    let downloadEndpoint = pollEndpoint;
    let suggestedName = `cafa-ai-videos-${Date.now()}.zip`;
    try {
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = {
        Accept: 'application/json, application/zip, application/octet-stream',
        'Content-Type': 'application/json',
      };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const startResponse = await fetch(startEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ all: true, sort: 'newest' }),
      });
      const startContentType = startResponse.headers.get('content-type') || '';

      if (!startResponse.ok) {
        throw new Error(await readErrorMessage(startResponse));
      }

      if (!startContentType.includes('application/json')) {
        const bytes = new Uint8Array(await startResponse.arrayBuffer());
        suggestedName = extractFilenameFromContentDisposition(startResponse.headers.get('content-disposition'))
          || suggestedName;
        const file = new File(Paths.cache, suggestedName);
        file.create({ intermediates: true, overwrite: true });
        file.write(bytes);
        const persisted = await saveFileToDownloadsCafaFolder({
          localFileUri: file.uri,
          fileName: suggestedName,
          mimeType: 'application/zip',
        });
        setZipProgress({
          visible: true,
          phase: 'complete',
          downloadedBytes: bytes.byteLength,
          totalBytes: bytes.byteLength,
          fileUri: persisted.safFileUri,
          readablePath: persisted.readableFilePath,
        });
        showNotice(t('videos.zipReady'));
        hapticSuccess();
        return;
      }

      const startJson = await startResponse.json() as {
        data?: { jobId?: string; pollUrl?: string; downloadUrl?: string; url?: string };
      };
      const startPollUrl = startJson?.data?.pollUrl || startJson?.data?.downloadUrl || startJson?.data?.url;
      if (startPollUrl) {
        pollEndpoint = startPollUrl.startsWith('/api/v1')
          ? `${backendOrigin}${startPollUrl}`
          : startPollUrl.startsWith('/')
            ? `${backendOrigin}${startPollUrl}`
            : `${API_BASE_URL}/${startPollUrl}`;
      } else if (startJson?.data?.jobId) {
        pollEndpoint = `${API_BASE_URL}${apiEndpoints.videos.downloadZipJob(startJson.data.jobId).replace(/^\/api\/v1/i, '')}`;
      }
      downloadEndpoint = pollEndpoint;

      const maxAttempts = 55;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const response = await fetch(pollEndpoint, { method: 'GET', headers });
        const contentType = response.headers.get('content-type') || '';

        if (response.status === 202 || contentType.includes('application/json')) {
          let message = '';
          try {
            const json = await response.json() as {
              message?: string;
              data?: {
                status?: string;
                error?: string;
                message?: string;
                downloadUrl?: string;
                url?: string;
              };
            };
            message = json.data?.error || json.data?.message || json.message || '';
            if (json.data?.status === 'failed') {
              throw new Error(message || t('videos.zipFailed'));
            }
            const nextUrl = json.data?.downloadUrl || json.data?.url;
            if (nextUrl) {
              pollEndpoint = resolveBackendAssetUrl(nextUrl) || pollEndpoint;
              downloadEndpoint = pollEndpoint;
            }
          } catch (parseError) {
            if (parseError instanceof Error) {
              throw parseError;
            }
          }
          if (attempt % 5 === 0) {
            showNotice(message || t('videos.zipPreparing'));
          }
          await sleep(1700);
          continue;
        }

        if (!response.ok) {
          throw new Error(`ZIP request failed with status ${response.status}`);
        }

        suggestedName = extractFilenameFromContentDisposition(response.headers.get('content-disposition'))
          || suggestedName;
        break;
      }

      const zipDir = new Directory(Paths.cache, 'Cafa AI');
      zipDir.create({ idempotent: true, intermediates: true });
      const targetUri = `${zipDir.uri}${suggestedName}`;
      setZipProgress((prev) => ({
        ...prev,
        phase: 'downloading',
        downloadedBytes: 0,
        totalBytes: 0,
        fileUri: null,
        readablePath: null,
      }));

      const downloadAccessToken = await getAccessToken();
      const downloadHeaders: Record<string, string> = downloadAccessToken
        ? { Authorization: `Bearer ${downloadAccessToken}` }
        : {};
      const downloader = FileSystem.createDownloadResumable(
        downloadEndpoint,
        targetUri,
        { headers: downloadHeaders },
        (progress) => {
          setZipProgress((prev) => ({
            ...prev,
            phase: 'downloading',
            downloadedBytes: progress.totalBytesWritten,
            totalBytes: progress.totalBytesExpectedToWrite,
          }));
        },
      );
      const result = await downloader.downloadAsync();
      if (!result?.uri) {
        throw new Error(t('videos.zipFailed'));
      }

      const persisted = await saveFileToDownloadsCafaFolder({
        localFileUri: result.uri,
        fileName: suggestedName,
        mimeType: 'application/zip',
      });
      setZipProgress((prev) => ({
        ...prev,
        phase: 'complete',
        fileUri: persisted.safFileUri,
        readablePath: persisted.readableFilePath,
        downloadedBytes: prev.totalBytes > 0 ? prev.totalBytes : prev.downloadedBytes,
      }));
      showNotice(t('videos.zipReady'));
      hapticSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('videos.zipFailed');
      console.log(`[videos-download-zip:error] endpoint=${downloadEndpoint || pollEndpoint || startEndpoint} message="${message}"`);
      showNotice(message, 5000);
      setZipProgress((prev) => ({ ...prev, visible: false, phase: 'idle' }));
      hapticError();
    } finally {
      isZipDownloadingRef.current = false;
      setIsZipBusy(false);
    }
  }, [backendOrigin, resolveBackendAssetUrl, showNotice, t]);

  const openDownloadedZipPath = useCallback(async () => {
    if (Platform.OS !== 'android' || !zipProgress.fileUri) return;
    try {
      const folderUri = await openDownloadsCafaFolder();
      await Linking.openURL(folderUri);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open ZIP path.';
      console.log(`[videos-open-zip:error] path=${zipProgress.fileUri} message="${message}"`);
      showNotice(t('videos.zipOpenPathFailed'));
    }
  }, [showNotice, t, zipProgress.fileUri]);

  return (
    <RequireAuthRoute>
      <View className="flex-1" style={{ backgroundColor: colors.background, paddingHorizontal: 10 }}>
        <SecondaryNav title={t('drawer.videos')} topOffset={Math.max(insets.top, 0)} />
        <View className="mb-2 mt-1">
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {t('screen.videosSubtitle')}
          </Text>
          {Platform.OS === 'android' ? (
            <View className="mt-2 self-start">
              <AppButton
                label={isZipBusy ? t('videos.zipBusy') : t('videos.downloadAllZip')}
                onPress={() => void downloadAllAsZip()}
                iconName="download-outline"
                compact
              />
            </View>
          ) : null}
        </View>

        <FlatList
          data={videos}
          renderItem={({ item }) => (
            <VideoGalleryCard
              item={item}
              videoUrl={resolveBackendAssetUrl(item.videoUrl ?? item.downloadUrl ?? apiEndpoints.videos.download(item.id)) || ''}
              width={Dimensions.get('window').width - 20}
              onDownload={(target) => {
                void downloadVideo(target);
              }}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 36, paddingTop: 2 }}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.6}
          refreshControl={(
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={isDark ? '#0A0A0A' : '#FFFFFF'}
            />
          )}
          ListEmptyComponent={(
            <View className="items-center px-6 py-10">
              {isInitialLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                  {t('videos.empty')}
                </Text>
              )}
            </View>
          )}
          ListFooterComponent={(
            isLoadingMore ? (
              <View className="py-4">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : <View style={{ height: 8 }} />
          )}
        />

        {statusNotice ? (
          <View
            accessibilityRole="alert"
            className="absolute left-3 right-3 rounded-2xl px-4 py-3"
            style={{
              bottom: 14,
              backgroundColor: isDark ? 'rgba(12,12,12,0.95)' : 'rgba(255,255,255,0.97)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(167,139,250,0.3)' : 'rgba(124,58,237,0.22)',
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
              {statusNotice}
            </Text>
          </View>
        ) : null}

        {Platform.OS === 'android' && zipProgress.visible ? (
          <Animated.View
            className="absolute left-3 right-3 rounded-3xl px-4 py-4"
            style={{
              bottom: statusNotice ? 88 : 14,
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.92, 1],
              }),
              transform: [{
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.995, 1.005],
                }),
              }],
              backgroundColor: isDark ? 'rgba(18,18,18,0.97)' : 'rgba(255,255,255,0.98)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(167,139,250,0.32)' : 'rgba(124,58,237,0.26)',
            }}
          >
            <View className="flex-row items-center">
              {zipProgress.phase === 'complete' ? (
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              ) : (
                <ActivityIndicator color={colors.primary} />
              )}
              <Text style={{ color: colors.textPrimary, marginLeft: 10, fontWeight: '700', fontSize: 13 }}>
                {zipProgress.phase === 'preparing'
                  ? t('videos.zipPreparing')
                  : zipProgress.phase === 'complete'
                    ? t('videos.zipCompleted')
                    : t('videos.zipDownloading')}
              </Text>
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
              {formatProgress(zipProgress.downloadedBytes, zipProgress.totalBytes)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }}>
              {t('videos.zipDoNotCloseWarning')}
            </Text>

            {zipProgress.phase === 'complete' && zipProgress.fileUri ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('videos.zipOpenPath')}
                accessibilityHint={t('videos.zipOpenPathHint')}
                onPress={() => void openDownloadedZipPath()}
                activeOpacity={0.82}
                style={{
                  marginTop: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(167,139,250,0.3)' : 'rgba(124,58,237,0.28)',
                  backgroundColor: isDark ? 'rgba(167,139,250,0.13)' : 'rgba(124,58,237,0.1)',
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                  {t('videos.zipOpenPath')}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}
                >
                  {zipProgress.readablePath || toReadableAndroidPath(zipProgress.fileUri)}
                </Text>
              </TouchableOpacity>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    </RequireAuthRoute>
  );
}

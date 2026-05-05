import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { AppPromptModal, RequireAuthRoute, SecondaryNav } from '@/components';
import { getArtifactsPage } from '@/features';
import { useAppTheme, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib/client/base-url';
import { apiEndpoints } from '@/services/api';
import { getAccessToken } from '@/services/storage/session';
import { ArtifactItem } from '@/types';
import { hapticError, hapticSelection, hapticSuccess, saveFileToDownloadsCafaFolder } from '@/utils';

const PAGE_SIZE = 20;

function formatDate(value?: string) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtensionFromNameOrMime(fileName?: string, mimeType?: string) {
  const lowerName = (fileName ?? '').toLowerCase();
  const nameMatch = lowerName.match(/\.([a-z0-9]+)$/i);
  if (nameMatch?.[1]) return nameMatch[1];
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('markdown')) return 'md';
  if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'docx';
  if (mime.includes('json')) return 'json';
  if (mime.includes('csv')) return 'csv';
  if (mime.includes('plain')) return 'txt';
  return 'bin';
}

function fileIconForMime(mimeType?: string) {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.includes('pdf')) return 'document-attach-outline';
  if (mime.includes('word') || mime.includes('officedocument')) return 'document-text-outline';
  if (mime.includes('markdown') || mime.includes('text/')) return 'document-outline';
  if (mime.includes('json') || mime.includes('xml') || mime.includes('csv')) return 'code-slash-outline';
  return 'document-outline';
}

async function getSharingModule() {
  try {
    const loaded = await import('expo-sharing');
    const candidate = (loaded as { default?: unknown })?.default ?? loaded;
    const moduleLike = candidate as {
      isAvailableAsync?: () => Promise<boolean>;
      shareAsync?: (url: string, options?: { mimeType?: string; dialogTitle?: string }) => Promise<void>;
    } | null | undefined;
    if (moduleLike && moduleLike.isAvailableAsync && moduleLike.shareAsync) {
      return moduleLike;
    }
    return null;
  } catch {
    return null;
  }
}

export default function ArtifactsScreen() {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [statusNotice, setStatusNotice] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'attachment' | 'generated'>('all');
  const [mimeTypeFilter, setMimeTypeFilter] = useState('');
  const [downloadingArtifactId, setDownloadingArtifactId] = useState<string | null>(null);
  const [activeDownloadArtifact, setActiveDownloadArtifact] = useState<ArtifactItem | null>(null);
  const hasBootstrappedRef = useRef(false);
  const isLoadingPageRef = useRef(false);
  const hasNextPageRef = useRef(true);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstFilterRunRef = useRef(true);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    hasNextPageRef.current = hasNextPage;
  }, [hasNextPage]);

  const showNotice = useCallback((message: string, durationMs = 3200) => {
    setStatusNotice(message);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => {
      setStatusNotice('');
      noticeTimeoutRef.current = null;
    }, durationMs);
  }, []);

  const loadPage = useCallback(async (page: number, mode: 'replace' | 'append') => {
    if (isLoadingPageRef.current) return;
    if (mode === 'append' && !hasNextPageRef.current) return;
    isLoadingPageRef.current = true;

    if (mode === 'append') setIsLoadingMore(true);
    if (mode === 'replace' && page === 1) setIsInitialLoading(true);

    try {
      const payload = await getArtifactsPage({
        page,
        limit: PAGE_SIZE,
        kind: kindFilter === 'all' ? undefined : kindFilter,
        mimeType: mimeTypeFilter.trim() || undefined,
      });
      setArtifacts((prev) => {
        const source = mode === 'replace' ? payload.artifacts : [...prev, ...payload.artifacts];
        const deduped = new Map<string, ArtifactItem>();
        source.forEach((item) => deduped.set(item.artifactId, item));
        return Array.from(deduped.values());
      });
      setCurrentPage(payload.pagination.page);
      setHasNextPage(payload.pagination.page < payload.pagination.pages);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('artifacts.loadFailed');
      showNotice(message, 5000);
      hapticError();
    } finally {
      isLoadingPageRef.current = false;
      setIsInitialLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
    }
  }, [kindFilter, mimeTypeFilter, showNotice, t]);

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;
    void loadPage(1, 'replace');
  }, [loadPage]);

  useEffect(() => {
    if (skipFirstFilterRunRef.current) {
      skipFirstFilterRunRef.current = false;
      return;
    }
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      setHasNextPage(true);
      setCurrentPage(0);
      void loadPage(1, 'replace');
      filterDebounceRef.current = null;
    }, 320);
  }, [kindFilter, mimeTypeFilter, loadPage]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    setHasNextPage(true);
    void loadPage(1, 'replace');
  }, [loadPage]);

  const applyFilters = useCallback(() => {
    hapticSelection();
    setHasNextPage(true);
    setCurrentPage(0);
    void loadPage(1, 'replace');
  }, [loadPage]);

  const hasActiveFilters = kindFilter !== 'all' || mimeTypeFilter.trim().length > 0;

  const clearFilters = useCallback(() => {
    hapticSelection();
    setKindFilter('all');
    setMimeTypeFilter('');
    setHasNextPage(true);
    setCurrentPage(0);
    void loadPage(1, 'replace');
  }, [loadPage]);

  const onLoadMore = useCallback(() => {
    if (isInitialLoading || isRefreshing || isLoadingMore || !hasNextPage) return;
    void loadPage(currentPage + 1, 'append');
  }, [currentPage, hasNextPage, isInitialLoading, isLoadingMore, isRefreshing, loadPage]);

  const downloadArtifact = useCallback(async (artifact: ArtifactItem) => {
    hapticSelection();
    setDownloadingArtifactId(artifact.artifactId);
    showNotice(t('artifacts.downloadStarting'));
    const downloadEndpoint = `${API_BASE_URL}${apiEndpoints.artifacts.download(artifact.artifactId).replace(/^\/api\/v1/i, '')}`;

    try {
      const extension = fileExtensionFromNameOrMime(artifact.fileName, artifact.mimeType);
      const suggestedName = (artifact.fileName?.trim() || `cafa-ai-artifact-${Date.now()}.${extension}`)
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
      const finalName = /\.[a-z0-9]+$/i.test(suggestedName) ? suggestedName : `${suggestedName}.${extension}`;
      const target = new File(Paths.cache, finalName);
      if (target.exists) target.delete();

      const accessToken = await getAccessToken();
      const downloaded = await File.downloadFileAsync(downloadEndpoint, target, {
        idempotent: true,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (Platform.OS === 'android') {
        const persisted = await saveFileToDownloadsCafaFolder({
          localFileUri: downloaded.uri,
          fileName: finalName,
          mimeType: artifact.mimeType || 'application/octet-stream',
        });
        showNotice(`${t('artifacts.downloadSuccess')}: ${persisted.readableFilePath}`, 5000);
      } else {
        const Sharing = await getSharingModule();
        if (Sharing && Sharing.isAvailableAsync && Sharing.shareAsync && await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloaded.uri, {
            mimeType: artifact.mimeType || 'application/octet-stream',
            dialogTitle: t('artifacts.iosShareTitle'),
          });
          showNotice(t('artifacts.downloadReady'));
        } else {
          await Share.share({ message: finalName, url: downloaded.uri });
          showNotice(t('artifacts.downloadReady'));
        }
      }
      hapticSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('artifacts.downloadFailed');
      console.log(`[artifacts-download:error] endpoint=${downloadEndpoint} message="${message}"`);
      showNotice(t('artifacts.downloadFailed'), 5000);
      hapticError();
    } finally {
      setDownloadingArtifactId((current) => (current === artifact.artifactId ? null : current));
      setActiveDownloadArtifact(null);
    }
  }, [showNotice, t]);

  return (
    <RequireAuthRoute>
      <View className="flex-1" style={{ backgroundColor: colors.background, paddingHorizontal: 10 }}>
        <AppPromptModal
          visible={Boolean(activeDownloadArtifact)}
          title={t('artifacts.downloadPromptTitle')}
          message={t('artifacts.downloadPromptMessage')}
          confirmLabel={t('artifacts.downloadCta')}
          cancelLabel={t('drawer.cancel')}
          iconName="download-outline"
          onCancel={() => setActiveDownloadArtifact(null)}
          onConfirm={() => {
            if (activeDownloadArtifact) {
              void downloadArtifact(activeDownloadArtifact);
            }
          }}
        />

        <SecondaryNav title={t('drawer.artifacts')} topOffset={Math.max(insets.top, 0)} />
        <View className="mb-2 mt-1">
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {t('screen.artifactsSubtitle')}
          </Text>
          <View accessibilityRole="tablist" className="mt-2 flex-row items-center">
            {(['all', 'attachment', 'generated'] as const).map((kind) => (
              <Pressable
                key={kind}
                onPress={() => setKindFilter(kind)}
                accessibilityRole="tab"
                accessibilityLabel={`Filter artifacts by ${kind}`}
                accessibilityHint="Updates the artifacts list"
                accessibilityState={{ selected: kindFilter === kind }}
                className="mr-2 rounded-full px-3 py-1.5"
                style={{
                  borderWidth: 1,
                  borderColor: kindFilter === kind ? colors.primary : colors.border,
                  backgroundColor: kindFilter === kind ? (isDark ? 'rgba(95,127,184,0.18)' : 'rgba(32,64,121,0.1)') : 'transparent',
                }}
              >
                <Text style={{ color: kindFilter === kind ? colors.primary : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                  {kind === 'all' ? 'All' : kind === 'attachment' ? 'Attachment' : 'Generated'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View className="mt-2 flex-row items-center">
            <View
              className="mr-2 flex-1 rounded-full border px-3"
              style={{ borderColor: colors.border, height: 38, justifyContent: 'center' }}
            >
              <TextInput
                value={mimeTypeFilter}
                onChangeText={setMimeTypeFilter}
                placeholder="mimeType (optional)"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={applyFilters}
                accessibilityLabel="Filter by MIME type"
                accessibilityHint="Type a MIME type like application/pdf to filter artifacts"
                clearButtonMode="while-editing"
                style={{ color: colors.textPrimary, fontSize: 12 }}
              />
            </View>
            <Pressable
              onPress={applyFilters}
              accessibilityRole="button"
              accessibilityLabel="Apply artifact filters"
              accessibilityHint="Reloads artifacts using selected filters"
              className="rounded-full px-3 py-2"
              style={{ backgroundColor: colors.primary }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Apply</Text>
            </Pressable>
          </View>
        </View>

        <FlatList
          data={artifacts}
          keyExtractor={(item) => item.artifactId}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.6}
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          accessibilityLabel="Artifacts list"
          contentContainerStyle={{ paddingBottom: 36, paddingTop: 2 }}
          renderItem={({ item }) => {
            const isDownloading = downloadingArtifactId === item.artifactId;
            const iconName = fileIconForMime(item.mimeType);
            const title = item.fileName || item.artifactId;
            return (
              <View
                accessible
                accessibilityRole="summary"
                accessibilityLabel={`Artifact ${title}`}
                className="mb-2 rounded-2xl border px-3 py-3"
                style={{
                  borderColor: isDark ? 'rgba(95,127,184,0.28)' : 'rgba(32,64,121,0.22)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(32,64,121,0.05)',
                }}
              >
                <View className="flex-row items-center">
                  <Ionicons name={iconName as any} size={18} color={colors.primary} />
                  <Text
                    numberOfLines={1}
                    style={{ marginLeft: 8, flex: 1, color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}
                  >
                    {title}
                  </Text>
                </View>
                <Text style={{ marginTop: 6, color: colors.textSecondary, fontSize: 11 }}>
                  {(item.kind || 'artifact').toUpperCase()} {item.mimeType ? `• ${item.mimeType}` : ''}
                </Text>
                <Text style={{ marginTop: 4, color: colors.textSecondary, fontSize: 11 }}>
                  {formatDate(item.createdAt)} {item.size ? `• ${formatSize(item.size)}` : ''}
                </Text>

                <View className="mt-3 flex-row items-center">
                  <Pressable
                    onPress={() => setActiveDownloadArtifact(item)}
                    disabled={isDownloading}
                    accessibilityRole="button"
                    accessibilityLabel={`Download ${title}`}
                    accessibilityHint="Downloads this artifact to your device"
                    className="self-start rounded-full px-3 py-2"
                    style={{
                      backgroundColor: isDark ? 'rgba(95,127,184,0.2)' : 'rgba(32,64,121,0.12)',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(95,127,184,0.3)' : 'rgba(32,64,121,0.24)',
                      opacity: isDownloading ? 0.65 : 1,
                    }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                      {isDownloading ? t('artifacts.downloading') : t('artifacts.downloadCta')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      hapticSelection();
                      router.push({
                        pathname: '/(drawer)',
                        params: { conversationId: item.conversationId },
                      } as never);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Open source chat for ${title}`}
                    accessibilityHint="Navigates to the chat where this artifact was created"
                    className="ml-2 self-start rounded-full px-3 py-2"
                    style={{
                      backgroundColor: isDark ? 'rgba(95,127,184,0.12)' : 'rgba(32,64,121,0.08)',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(95,127,184,0.24)' : 'rgba(32,64,121,0.2)',
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                      Open source chat
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={(
            <View className="items-center px-6 py-10">
              {isInitialLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <View className="items-center">
                  <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                    {t('artifacts.empty')}
                  </Text>
                  {hasActiveFilters ? (
                    <Pressable
                      onPress={clearFilters}
                      accessibilityRole="button"
                      accessibilityLabel="Clear artifact filters"
                      accessibilityHint="Resets kind and MIME type filters, then reloads artifacts"
                      className="mt-3 rounded-full px-3 py-2"
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: isDark ? 'rgba(95,127,184,0.14)' : 'rgba(32,64,121,0.08)',
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                        Clear filters
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => {
                      hapticSelection();
                      router.push('/(drawer)');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Open chat"
                    accessibilityHint="Navigates to chat so you can request new generated artifacts"
                    className="mt-3 rounded-full px-3 py-2"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                      Open chat
                    </Text>
                  </Pressable>
                </View>
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
              borderColor: isDark ? 'rgba(95,127,184,0.3)' : 'rgba(32,64,121,0.22)',
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
              {statusNotice}
            </Text>
          </View>
        ) : null}
      </View>
    </RequireAuthRoute>
  );
}

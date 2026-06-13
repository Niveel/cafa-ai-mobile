import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { AppPromptModal, RequireAuthRoute, SecondaryNav } from '@/components';
import { getArtifactsPage } from '@/features';
import { useAppTheme, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib/client/base-url';
import { apiEndpoints } from '@/services/api';
import { getAccessToken } from '@/services/storage/session';
import { getDocumentWizardHistory } from '@/services';
import { ArtifactItem, DocumentWizardArtifact, DocumentWizardHistoryItem } from '@/types';
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
  const [activeCollection, setActiveCollection] = useState<'artifacts' | 'documents'>('artifacts');
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [documents, setDocuments] = useState<DocumentWizardHistoryItem[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isDocumentInitialLoading, setIsDocumentInitialLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingDocumentsMore, setIsLoadingDocumentsMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [documentsHasNextPage, setDocumentsHasNextPage] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [documentsPage, setDocumentsPage] = useState(0);
  const [statusNotice, setStatusNotice] = useState('');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [downloadingArtifactId, setDownloadingArtifactId] = useState<string | null>(null);
  const [downloadingDocumentKey, setDownloadingDocumentKey] = useState<string | null>(null);
  const [activeDownloadArtifact, setActiveDownloadArtifact] = useState<ArtifactItem | null>(null);
  const hasBootstrappedRef = useRef(false);
  const hasDocumentsBootstrappedRef = useRef(false);
  const isLoadingPageRef = useRef(false);
  const isLoadingDocumentsPageRef = useRef(false);
  const hasNextPageRef = useRef(true);
  const documentsHasNextPageRef = useRef(true);
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

  useEffect(() => {
    documentsHasNextPageRef.current = documentsHasNextPage;
  }, [documentsHasNextPage]);

  const showNotice = useCallback((message: string, durationMs = 3200) => {
    setStatusNotice(message);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => {
      setStatusNotice('');
      noticeTimeoutRef.current = null;
    }, durationMs);
  }, []);

  const loadArtifactsPage = useCallback(async (page: number, mode: 'replace' | 'append') => {
    if (isLoadingPageRef.current) return;
    if (mode === 'append' && !hasNextPageRef.current) return;
    isLoadingPageRef.current = true;

    if (mode === 'append') setIsLoadingMore(true);
    if (mode === 'replace' && page === 1) setIsInitialLoading(true);

    try {
      const payload = await getArtifactsPage({
        page,
        limit: PAGE_SIZE,
        q: debouncedSearchText || undefined,
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
  }, [debouncedSearchText, showNotice, t]);

  const loadDocumentsPage = useCallback(async (page: number, mode: 'replace' | 'append') => {
    if (isLoadingDocumentsPageRef.current) return;
    if (mode === 'append' && !documentsHasNextPageRef.current) return;
    isLoadingDocumentsPageRef.current = true;

    if (mode === 'append') setIsLoadingDocumentsMore(true);
    if (mode === 'replace' && page === 1) setIsDocumentInitialLoading(true);

    try {
      const payload = await getDocumentWizardHistory(page, PAGE_SIZE);
      setDocuments((prev) => {
        const source = mode === 'replace' ? payload.documents : [...prev, ...payload.documents];
        const deduped = new Map<string, DocumentWizardHistoryItem>();
        source.forEach((item) => deduped.set(item._id, item));
        return Array.from(deduped.values());
      });
      setDocumentsPage(payload.pagination.page);
      setDocumentsHasNextPage(payload.pagination.hasNextPage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load documents.';
      showNotice(message, 5000);
      hapticError();
    } finally {
      isLoadingDocumentsPageRef.current = false;
      setIsDocumentInitialLoading(false);
      setIsLoadingDocumentsMore(false);
      setIsRefreshing(false);
    }
  }, [showNotice]);

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;
    void loadArtifactsPage(1, 'replace');
  }, [loadArtifactsPage]);

  useEffect(() => {
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      setDebouncedSearchText(searchText.trim().toLowerCase());
      filterDebounceRef.current = null;
    }, 260);
  }, [searchText]);

  useEffect(() => {
    if (skipFirstFilterRunRef.current) {
      skipFirstFilterRunRef.current = false;
      return;
    }
    if (activeCollection === 'artifacts') {
      setHasNextPage(true);
      setCurrentPage(0);
      void loadArtifactsPage(1, 'replace');
    }
  }, [activeCollection, debouncedSearchText, loadArtifactsPage]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    if (activeCollection === 'documents') {
      setDocumentsHasNextPage(true);
      void loadDocumentsPage(1, 'replace');
      return;
    }
    setHasNextPage(true);
    void loadArtifactsPage(1, 'replace');
  }, [activeCollection, loadArtifactsPage, loadDocumentsPage]);

  const hasActiveFilters = searchText.trim().length > 0;

  const filteredDocuments = useMemo(() => {
    const query = debouncedSearchText.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((item) => {
      const haystack = [
        item.documentType,
        item.format,
        item.title,
        item.source,
        ...item.artifacts.map((artifact) => `${artifact.fileName} ${artifact.mimeType}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [debouncedSearchText, documents]);

  useEffect(() => {
    if (activeCollection !== 'documents' || hasDocumentsBootstrappedRef.current) return;
    hasDocumentsBootstrappedRef.current = true;
    void loadDocumentsPage(1, 'replace');
  }, [activeCollection, loadDocumentsPage]);

  const clearFilters = useCallback(() => {
    hapticSelection();
    setSearchText('');
    setDebouncedSearchText('');
    if (activeCollection === 'artifacts') {
      setHasNextPage(true);
      setCurrentPage(0);
      void loadArtifactsPage(1, 'replace');
    }
  }, [activeCollection, loadArtifactsPage]);

  const onLoadMore = useCallback(() => {
    if (activeCollection === 'documents') {
      if (isDocumentInitialLoading || isRefreshing || isLoadingDocumentsMore || !documentsHasNextPage) return;
      void loadDocumentsPage(documentsPage + 1, 'append');
      return;
    }
    if (isInitialLoading || isRefreshing || isLoadingMore || !hasNextPage) return;
    void loadArtifactsPage(currentPage + 1, 'append');
  }, [
    activeCollection,
    currentPage,
    documentsHasNextPage,
    documentsPage,
    hasNextPage,
    isDocumentInitialLoading,
    isInitialLoading,
    isLoadingDocumentsMore,
    isLoadingMore,
    isRefreshing,
    loadArtifactsPage,
    loadDocumentsPage,
  ]);

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

  const downloadDocumentArtifact = useCallback(async (documentId: string, artifact: DocumentWizardArtifact) => {
    if (!artifact.url) {
      showNotice('This document is missing a download link.', 5000);
      hapticError();
      return;
    }

    const downloadKey = `${documentId}:${artifact.fileName}`;
    setDownloadingDocumentKey(downloadKey);
    showNotice('Preparing your document download...');
    hapticSelection();

    try {
      const extension = fileExtensionFromNameOrMime(artifact.fileName, artifact.mimeType);
      const suggestedName = (artifact.fileName?.trim() || `cafa-ai-document-${Date.now()}.${extension}`)
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
      const finalName = /\.[a-z0-9]+$/i.test(suggestedName) ? suggestedName : `${suggestedName}.${extension}`;
      const target = new File(Paths.cache, finalName);
      if (target.exists) target.delete();

      const accessToken = await getAccessToken();
      const downloaded = await File.downloadFileAsync(artifact.url, target, {
        idempotent: true,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (Platform.OS === 'android') {
        const persisted = await saveFileToDownloadsCafaFolder({
          localFileUri: downloaded.uri,
          fileName: finalName,
          mimeType: artifact.mimeType || 'application/octet-stream',
        });
        showNotice(`Document saved: ${persisted.readableFilePath}`, 5000);
      } else {
        const Sharing = await getSharingModule();
        if (Sharing && Sharing.isAvailableAsync && Sharing.shareAsync && await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloaded.uri, {
            mimeType: artifact.mimeType || 'application/octet-stream',
            dialogTitle: 'Save or share document',
          });
          showNotice('Document ready to share.');
        } else {
          await Share.share({ message: finalName, url: downloaded.uri });
          showNotice('Document ready to share.');
        }
      }
      hapticSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not download this document.';
      console.log(`[documents-download:error] url=${artifact.url} message="${message}"`);
      showNotice('Could not download this document.', 5000);
      hapticError();
    } finally {
      setDownloadingDocumentKey((current) => (current === downloadKey ? null : current));
    }
  }, [showNotice]);

  const isShowingDocuments = activeCollection === 'documents';
  const listData = isShowingDocuments ? filteredDocuments : artifacts;
  const isListInitialLoading = isShowingDocuments ? isDocumentInitialLoading : isInitialLoading;
  const isListLoadingMore = isShowingDocuments ? isLoadingDocumentsMore : isLoadingMore;

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
          <View className="mt-3 flex-row rounded-full border p-1" style={{ borderColor: colors.border }}>
            {(['artifacts', 'documents'] as const).map((collection) => {
              const active = activeCollection === collection;
              return (
                <Pressable
                  key={collection}
                  onPress={() => {
                    hapticSelection();
                    setActiveCollection(collection);
                  }}
                  className="flex-1 rounded-full px-3 py-2"
                  style={{
                    backgroundColor: active ? colors.primary : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      textAlign: 'center',
                      color: active ? '#FFFFFF' : colors.textPrimary,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {collection === 'artifacts' ? 'Artifacts' : 'Documents'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View className="mt-2 flex-row items-center">
            <View
              className="flex-1 rounded-full border px-3"
              style={{ borderColor: colors.border, height: 38, justifyContent: 'center' }}
            >
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder={activeCollection === 'documents' ? 'Search documents' : 'Search artifacts'}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel={activeCollection === 'documents' ? 'Search documents' : 'Search artifacts'}
                accessibilityHint={
                  activeCollection === 'documents'
                    ? 'Searches loaded documents by title, type, format, and filename'
                    : 'Searches artifacts from backend by filename, MIME type, or URL'
                }
                clearButtonMode="while-editing"
                style={{ color: colors.textPrimary, fontSize: 12 }}
              />
            </View>
          </View>
        </View>

        <FlatList
          data={listData}
          keyExtractor={(item) => ('artifactId' in item ? item.artifactId : item._id)}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.6}
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          accessibilityLabel={isShowingDocuments ? 'Documents list' : 'Artifacts list'}
          contentContainerStyle={{ paddingBottom: 36, paddingTop: 2 }}
          renderItem={({ item }) => {
            if ('_id' in item) {
              const primaryArtifact = item.artifacts[0];
              const documentKey = primaryArtifact ? `${item._id}:${primaryArtifact.fileName}` : null;
              const isDownloading = documentKey ? downloadingDocumentKey === documentKey : false;
              return (
                <View
                  accessible
                  accessibilityRole="summary"
                  accessibilityLabel={`Document ${item.title || item.documentType}`}
                  className="mb-2 rounded-2xl border px-3 py-3"
                  style={{
                    borderColor: isDark ? 'rgba(95,127,184,0.28)' : 'rgba(32,64,121,0.22)',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(32,64,121,0.05)',
                  }}
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name={fileIconForMime(primaryArtifact?.mimeType || item.format) as any}
                      size={18}
                      color={colors.primary}
                    />
                    <Text
                      numberOfLines={1}
                      style={{ marginLeft: 8, flex: 1, color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}
                    >
                      {item.title || item.documentType}
                    </Text>
                  </View>
                  <Text style={{ marginTop: 6, color: colors.textSecondary, fontSize: 11 }}>
                    {item.documentType.toUpperCase()} - {item.format.toUpperCase()} - {item.source.toUpperCase()}
                  </Text>
                  <Text style={{ marginTop: 4, color: colors.textSecondary, fontSize: 11 }}>
                    {formatDate(item.createdAt)}
                    {primaryArtifact?.size_bytes ? ` - ${formatSize(primaryArtifact.size_bytes)}` : ''}
                  </Text>
                  <Text style={{ marginTop: 6, color: colors.textSecondary, fontSize: 11 }}>
                    {primaryArtifact?.fileName || 'Generated document'}
                  </Text>
                  <View className="mt-3 flex-row items-center">
                    <Pressable
                      onPress={() => {
                        if (primaryArtifact) {
                          void downloadDocumentArtifact(item._id, primaryArtifact);
                        }
                      }}
                      disabled={!primaryArtifact || isDownloading}
                      accessibilityRole="button"
                      accessibilityLabel={`Download ${item.title || item.documentType}`}
                      className="self-start rounded-full px-3 py-2"
                      style={{
                        backgroundColor: isDark ? 'rgba(95,127,184,0.2)' : 'rgba(32,64,121,0.12)',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(95,127,184,0.3)' : 'rgba(32,64,121,0.24)',
                        opacity: !primaryArtifact || isDownloading ? 0.65 : 1,
                      }}
                    >
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                        {isDownloading ? 'Downloading' : 'Download'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            }

            const isDownloading = downloadingArtifactId === item.artifactId;
            const iconName = fileIconForMime(item.mimeType);
            const title = item.fileName || item.artifactId;
            const isImageArtifact = (item.mimeType ?? '').toLowerCase().startsWith('image/');
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
                {isImageArtifact && item.url ? (
                  <View
                    className="mt-2 overflow-hidden rounded-xl border"
                    style={{
                      width: '100%',
                      height: 188,
                      borderColor: isDark ? 'rgba(95,127,184,0.28)' : 'rgba(32,64,121,0.22)',
                      backgroundColor: isDark ? '#101010' : '#FFFFFF',
                    }}
                  >
                    <ExpoImage
                      source={{ uri: item.url }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      contentPosition="center"
                      transition={120}
                      accessible
                      accessibilityLabel={title}
                    />
                  </View>
                ) : null}
                <Text style={{ marginTop: 6, color: colors.textSecondary, fontSize: 11 }}>
                  {(item.kind || 'artifact').toUpperCase()} {item.mimeType ? `- ${item.mimeType}` : ''}
                </Text>
                <Text style={{ marginTop: 4, color: colors.textSecondary, fontSize: 11 }}>
                  {formatDate(item.createdAt)} {item.size ? `- ${formatSize(item.size)}` : ''}
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
                        params: { conversationId: item.conversationId, messageId: item.messageId },
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
              {isListInitialLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <View className="items-center">
                  <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                    {isShowingDocuments ? 'No documents found yet.' : t('artifacts.empty')}
                  </Text>
                  {hasActiveFilters ? (
                    <Pressable
                      onPress={clearFilters}
                      accessibilityRole="button"
                      accessibilityLabel="Clear artifact filters"
                      accessibilityHint="Clears search and reloads artifacts"
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
            isListLoadingMore ? (
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  archiveAuthenticatedConversation,
  deleteAuthenticatedConversation,
  listAllAuthenticatedConversations,
} from '@/features';
import {
  ArchivedChatSnapshot,
  getArchivedChatSnapshots,
  removeArchivedChatSnapshot,
  removeArchivedChatSnapshots,
  upsertArchivedChatSnapshots,
} from '@/services/storage';
import { AppPromptModal } from '../AppPromptModal';
import { ArchivedChatsManageModal } from './ArchivedChatsManageModal';

type DataControlsSectionProps = {
  visible: boolean;
  isAuthenticated: boolean;
  isDark: boolean;
  onChatsMutated?: () => void;
  colors: {
    primary: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
  };
  t: (key: string, params?: Record<string, string>) => string;
};

async function runInBatches<T>(items: T[], size: number, handler: (item: T) => Promise<void>) {
  const done: T[] = [];
  const failed: T[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const results = await Promise.allSettled(batch.map((item) => handler(item)));
    results.forEach((result, index) => {
      const value = batch[index];
      if (result.status === 'fulfilled') {
        done.push(value);
      } else {
        failed.push(value);
      }
    });
  }
  return { done, failed };
}

export function DataControlsSection({ visible, isAuthenticated, isDark, colors, t, onChatsMutated }: DataControlsSectionProps) {
  const [archivedItems, setArchivedItems] = useState<ArchivedChatSnapshot[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [statusText, setStatusText] = useState('');
  const [showArchiveAllPrompt, setShowArchiveAllPrompt] = useState(false);
  const [showDeleteAllPrompt, setShowDeleteAllPrompt] = useState(false);
  const [showArchivedManager, setShowArchivedManager] = useState(false);
  const [deleteArchivedId, setDeleteArchivedId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const archivedCount = archivedItems.length;

  const loadArchived = useCallback(async () => {
    setLoadingArchived(true);
    const next = await getArchivedChatSnapshots();
    setArchivedItems(next);
    setLoadingArchived(false);
  }, []);

  useEffect(() => {
    if (!visible || !isAuthenticated) return;
    void loadArchived();
  }, [isAuthenticated, loadArchived, visible]);

  const applyBusy = useCallback((chatId: string, enabled: boolean) => {
    setBusyIds((prev) => {
      const set = new Set(prev);
      if (enabled) {
        set.add(chatId);
      } else {
        set.delete(chatId);
      }
      return [...set];
    });
  }, []);

  const archiveAllChats = useCallback(async () => {
    setShowArchiveAllPrompt(false);
    if (!isAuthenticated) return;
    setWorking(true);
    setStatusText('');
    try {
      const activeChats = await listAllAuthenticatedConversations();
      if (!activeChats.length) {
        setStatusText(t('settings.data.noActiveChats'));
        return;
      }

      const result = await runInBatches(activeChats, 6, async (chat) => {
        await archiveAuthenticatedConversation(chat.id, true);
      });

      if (result.done.length) {
        const archivedSnapshots: ArchivedChatSnapshot[] = result.done.map((chat) => ({
          id: chat.id,
          title: chat.title,
          preview: chat.preview,
          updatedAt: chat.updatedAt,
          archivedAt: Date.now(),
        }));
        const next = await upsertArchivedChatSnapshots(archivedSnapshots);
        setArchivedItems(next);
        onChatsMutated?.();
      }

      if (result.failed.length) {
        setStatusText(
          t('settings.data.archiveAllPartial', {
            success: String(result.done.length),
            failed: String(result.failed.length),
          }),
        );
      } else {
        setStatusText(t('settings.data.archiveAllSuccess'));
      }
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : t('settings.data.archiveAllError'));
    } finally {
      setWorking(false);
    }
  }, [isAuthenticated, t]);

  const deleteAllChats = useCallback(async () => {
    setShowDeleteAllPrompt(false);
    if (!isAuthenticated) return;
    setWorking(true);
    setStatusText('');
    try {
      const activeChats = await listAllAuthenticatedConversations();
      const archived = await getArchivedChatSnapshots();
      const allIds = [...new Set([...activeChats.map((item) => item.id), ...archived.map((item) => item.id)])];

      if (!allIds.length) {
        setStatusText(t('settings.data.noChatsToDelete'));
        return;
      }

      const result = await runInBatches(allIds, 6, async (chatId) => {
        await deleteAuthenticatedConversation(chatId);
      });

      if (result.done.length) {
        const next = await removeArchivedChatSnapshots(result.done);
        setArchivedItems(next);
        onChatsMutated?.();
      }

      if (result.failed.length) {
        setStatusText(
          t('settings.data.deleteAllPartial', {
            success: String(result.done.length),
            failed: String(result.failed.length),
          }),
        );
      } else {
        setStatusText(t('settings.data.deleteAllSuccess'));
      }
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : t('settings.data.deleteAllError'));
    } finally {
      setWorking(false);
    }
  }, [isAuthenticated, onChatsMutated, t]);

  const unarchiveChat = useCallback(
    async (chatId: string) => {
      applyBusy(chatId, true);
      try {
        await archiveAuthenticatedConversation(chatId, false);
        const next = await removeArchivedChatSnapshot(chatId);
        setArchivedItems(next);
        setStatusText(t('settings.data.unarchiveSuccess'));
        onChatsMutated?.();
      } catch (error) {
        setStatusText(error instanceof Error ? error.message : t('settings.data.unarchiveError'));
      } finally {
        applyBusy(chatId, false);
      }
    },
    [applyBusy, onChatsMutated, t],
  );

  const deleteArchivedChat = useCallback(
    async (chatId: string) => {
      applyBusy(chatId, true);
      try {
        await deleteAuthenticatedConversation(chatId);
        const next = await removeArchivedChatSnapshot(chatId);
        setArchivedItems(next);
        setStatusText(t('settings.data.deleteArchivedSuccess'));
        onChatsMutated?.();
      } catch (error) {
        setStatusText(error instanceof Error ? error.message : t('settings.data.deleteArchivedError'));
      } finally {
        applyBusy(chatId, false);
      }
    },
    [applyBusy, onChatsMutated, t],
  );

  const canRun = isAuthenticated && !working;

  const archivedManageLabel = useMemo(
    () => `${t('settings.data.archivedManage')} (${archivedCount})`,
    [archivedCount, t],
  );

  return (
    <View className="gap-3">
      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>{t('settings.data.title')}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('settings.data.subtitle')}</Text>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('settings.data.deleteAll')}
        disabled={!canRun}
        onPress={() => setShowDeleteAllPrompt(true)}
        className="h-11 items-center justify-center rounded-full px-3"
        style={{
          borderWidth: 1.2,
          borderColor: '#E11D48',
          backgroundColor: isDark ? 'rgba(127, 29, 29, 0.22)' : 'rgba(254, 226, 226, 0.95)',
          opacity: canRun ? 1 : 0.7,
        }}
      >
        <Text style={{ color: '#E11D48', fontSize: 13, fontWeight: '700' }}>{t('settings.data.deleteAll')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('settings.data.archiveAll')}
        disabled={!canRun}
        onPress={() => setShowArchiveAllPrompt(true)}
        className="h-11 items-center justify-center rounded-full px-3"
        style={{
          borderWidth: 1.2,
          borderColor: colors.primary,
          backgroundColor: 'transparent',
          opacity: canRun ? 1 : 0.7,
        }}
      >
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{t('settings.data.archiveAll')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={archivedManageLabel}
        disabled={!isAuthenticated}
        onPress={() => {
          setShowArchivedManager(true);
          void loadArchived();
        }}
        className="h-11 items-center justify-center rounded-full px-3"
        style={{
          borderWidth: 1.2,
          borderColor: colors.primary,
          backgroundColor: isDark ? 'rgba(32,64,121,0.16)' : 'rgba(32,64,121,0.08)',
          opacity: isAuthenticated ? 1 : 0.7,
        }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>{archivedManageLabel}</Text>
      </TouchableOpacity>

      {statusText ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, fontSize: 12 }}>
          {statusText}
        </Text>
      ) : null}

      <AppPromptModal
        visible={showArchiveAllPrompt}
        title={t('settings.data.archiveAllPromptTitle')}
        message={t('settings.data.archiveAllPromptMessage')}
        confirmLabel={t('settings.data.archiveAll')}
        cancelLabel={t('drawer.cancel')}
        iconName="archive-outline"
        onCancel={() => setShowArchiveAllPrompt(false)}
        onConfirm={() => {
          void archiveAllChats();
        }}
      />

      <AppPromptModal
        visible={showDeleteAllPrompt}
        title={t('settings.data.deleteAllPromptTitle')}
        message={t('settings.data.deleteAllPromptMessage')}
        confirmLabel={t('settings.data.deleteAll')}
        cancelLabel={t('drawer.cancel')}
        confirmTone="danger"
        iconName="trash-outline"
        onCancel={() => setShowDeleteAllPrompt(false)}
        onConfirm={() => {
          void deleteAllChats();
        }}
      />

      <AppPromptModal
        visible={Boolean(deleteArchivedId)}
        title={t('drawer.deleteTitle')}
        message={t('settings.data.deleteArchivedPrompt')}
        confirmLabel={t('drawer.deleteConfirm')}
        cancelLabel={t('drawer.cancel')}
        confirmTone="danger"
        iconName="trash-outline"
        onCancel={() => setDeleteArchivedId(null)}
        onConfirm={() => {
          if (!deleteArchivedId) return;
          const chatId = deleteArchivedId;
          setDeleteArchivedId(null);
          void deleteArchivedChat(chatId);
        }}
      />

      <ArchivedChatsManageModal
        visible={showArchivedManager}
        items={archivedItems}
        loading={loadingArchived}
        busyIds={busyIds}
        onClose={() => setShowArchivedManager(false)}
        onUnarchive={(chatId) => {
          void unarchiveChat(chatId);
        }}
        onDelete={(chatId) => setDeleteArchivedId(chatId)}
        t={t}
      />
    </View>
  );
}

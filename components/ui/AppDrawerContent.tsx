import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Image, Pressable, Text, TextInput, View } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAppContext } from '@/context';
import { API_BASE_URL } from '@/lib';
import {
  archiveAuthenticatedConversation,
  deleteAuthenticatedConversation,
  listAuthenticatedConversations,
  listGuestConversations,
} from '@/features';
import { useAppTheme, useI18n } from '@/hooks';
import {
  getChatPreferences,
  setCustomChatTitle,
  setPinnedChat,
} from '@/services/storage/chatPreferences';
import { getArchivedChatSnapshots, removeArchivedChatSnapshot, upsertArchivedChatSnapshots } from '@/services/storage';
import { subscribeToChatMutated } from '@/services';
import { hapticSelection } from '@/utils';
import { AppButton } from './AppButton';
import { AppInputPromptModal } from './AppInputPromptModal';
import { AppPromptModal } from './AppPromptModal';
import { SettingsModal } from './SettingsModal';

function toCapitalizedName(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function resolveAvatarUri(input?: string | null) {
  if (!input) return undefined;
  const value = input.trim();
  if (!value) return undefined;
  if (/^(https?:|file:|content:|data:)/i.test(value)) return value;

  const apiOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/i, '');
  if (value.startsWith('/')) return `${apiOrigin}${value}`;
  return `${apiOrigin}/${value}`;
}

type DrawerChatItem = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
};

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function deriveSmartChatTitle(preview: string, fallback: string) {
  const cleaned = preview.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  const lower = cleaned.toLowerCase();
  if (/^(hi|hello|hey)\b/.test(lower) || lower.includes('how are you')) {
    return 'Casual Greeting';
  }
  if (lower.includes('how to be rich') || lower.includes('make money') || lower.includes('wealth')) {
    return 'Wealth Building Advice';
  }
  const words = cleaned.replace(/[^\p{L}\p{N}\s'-]/gu, '').split(/\s+/).slice(0, 5).join(' ');
  return toTitleCase(words || fallback);
}

type ChatRowProps = {
  item: DrawerChatItem;
  active: boolean;
  menuOpen: boolean;
  onPress: (id: string) => void;
  onToggleMenu: (id: string) => void;
  onRename: (id: string) => void;
  onPin: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
  activeTint: string;
  isPinned: boolean;
  isAuthenticated: boolean;
  t: (key: string, params?: Record<string, string>) => string;
};

const ChatRow = memo(function ChatRow({
  item,
  active,
  menuOpen,
  onPress,
  onToggleMenu,
  onRename,
  onPin,
  onArchive,
  onDelete,
  textPrimary,
  textSecondary,
  borderColor,
  activeTint,
  isPinned,
  isAuthenticated,
  t,
}: ChatRowProps) {
  const menuTriggerRef = useRef<View | null>(null);
  const [menuOpenUpward, setMenuOpenUpward] = useState(false);
  const cardBg = active ? `${activeTint}1F` : 'transparent';
  const cardBorder = active ? activeTint : borderColor;

  useEffect(() => {
    if (!menuOpen) return;
    requestAnimationFrame(() => {
      menuTriggerRef.current?.measureInWindow((_x, y, _width, height) => {
        const viewportHeight = Dimensions.get('window').height;
        const estimatedMenuHeight = isAuthenticated ? 178 : 118;
        const spaceBelow = viewportHeight - (y + height);
        const spaceAbove = y;
        setMenuOpenUpward(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow);
      });
    });
  }, [isAuthenticated, menuOpen]);

  return (
    <View className="relative">
      <View
        className="relative rounded-2xl"
        style={{
          borderWidth: 1.2,
          borderColor: cardBorder,
          backgroundColor: cardBg,
          minHeight: 68,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 12,
          paddingRight: 8,
          paddingVertical: 8,
        }}
      >
        {active ? (
          <View
            className="absolute left-1 top-2 bottom-2 w-1 rounded-full"
            style={{ backgroundColor: activeTint }}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('drawer.openChat', { title: item.title })}
          accessibilityHint={t('drawer.openChatHint')}
          onPress={() => onPress(item.id)}
          style={({ pressed }) => ({
            width: '100%',
            minWidth: 0,
            paddingLeft: active ? 8 : 2,
            paddingRight: 56,
            paddingVertical: 4,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <View style={{ minHeight: 40, justifyContent: 'center', width: '100%', maxWidth: '100%' }}>
            <View className="flex-row items-center" style={{ minWidth: 0 }}>
              {isPinned ? (
                <Ionicons name="pin" size={11} color={activeTint} style={{ marginRight: 6 }} />
              ) : null}
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ color: textPrimary, fontWeight: '600', fontSize: 12, lineHeight: 16, flexShrink: 1, minWidth: 0 }}
              >
                {item.title}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ marginTop: 4, color: textSecondary, fontSize: 11, lineHeight: 14, minWidth: 0 }}
            >
              {item.preview}
            </Text>
          </View>
        </Pressable>

        <Pressable
          ref={menuTriggerRef}
          accessibilityRole="button"
          accessibilityLabel={t('drawer.chatMenu', { title: item.title })}
          accessibilityHint={t('drawer.chatMenuHint')}
          onPress={() => onToggleMenu(item.id)}
          className="absolute items-center justify-center rounded-full"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            right: 10,
            top: '50%',
            transform: [{ translateY: -16 }],
            width: 32,
            height: 32,
            borderWidth: 1,
            borderColor: active ? activeTint : borderColor,
            backgroundColor: active ? activeTint : '#16161A',
            zIndex: 2,
          }}
          android_ripple={{ color: `${activeTint}30`, borderless: false }}
        >
          <Ionicons name="ellipsis-vertical" size={16} color={active ? '#FFFFFF' : textPrimary} />
        </Pressable>
      </View>

      {menuOpen ? (
        <View
          className="absolute right-2 z-50 min-w-[158px] rounded-xl border p-1"
          style={{
            borderColor,
            backgroundColor: '#0F0F0F',
            top: menuOpenUpward ? undefined : 42,
            bottom: menuOpenUpward ? 42 : undefined,
          }}
        >
          <Pressable
            onPress={() => onRename(item.id)}
            accessibilityRole="button"
            accessibilityLabel={t('drawer.rename')}
            className="flex-row items-center rounded-lg px-2.5 py-2"
          >
            <Ionicons name="create-outline" size={14} color={textPrimary} />
            <Text style={{ color: textPrimary, marginLeft: 8, fontSize: 12 }}>{t('drawer.rename')}</Text>
          </Pressable>
          <Pressable
            onPress={() => onPin(item.id)}
            accessibilityRole="button"
            accessibilityLabel={isPinned ? t('drawer.unpin') : t('drawer.pin')}
            className="flex-row items-center rounded-lg px-2.5 py-2"
          >
            <Ionicons name={isPinned ? 'pin-outline' : 'pin'} size={14} color={textPrimary} />
            <Text style={{ color: textPrimary, marginLeft: 8, fontSize: 12 }}>
              {isPinned ? t('drawer.unpin') : t('drawer.pin')}
            </Text>
          </Pressable>
          {isAuthenticated ? (
            <Pressable
              onPress={() => onArchive(item.id)}
              accessibilityRole="button"
              accessibilityLabel={t('drawer.archive')}
              className="flex-row items-center rounded-lg px-2.5 py-2"
            >
              <Ionicons name="archive-outline" size={14} color={textPrimary} />
              <Text style={{ color: textPrimary, marginLeft: 8, fontSize: 12 }}>{t('drawer.archive')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => onDelete(item.id)}
            accessibilityRole="button"
            accessibilityLabel={t('drawer.delete')}
            className="flex-row items-center rounded-lg px-2.5 py-2"
          >
            <Ionicons name="trash-outline" size={14} color="#E11D48" />
            <Text style={{ color: '#E11D48', marginLeft: 8, fontSize: 12, fontWeight: '600' }}>{t('drawer.delete')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

export function AppDrawerContent({ navigation }: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { isAuthenticated, authUser, signOut } = useAppContext();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChatId, setActiveChatId] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatActionMenuId, setChatActionMenuId] = useState<string | null>(null);
  const [showSignoutPrompt, setShowSignoutPrompt] = useState(false);
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<DrawerChatItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [customTitles, setCustomTitles] = useState<Record<string, string>>({});
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const userName = useMemo(() => {
    if (!isAuthenticated) return t('drawer.userName.guest');
    const trimmedName = authUser?.name?.trim();
    if (trimmedName) return toCapitalizedName(trimmedName);
    if (authUser?.email) return toCapitalizedName(authUser.email.split('@')[0] ?? t('drawer.userName.auth'));
    return toCapitalizedName(t('drawer.userName.auth'));
  }, [authUser?.email, authUser?.name, isAuthenticated, t]);

  const currentPlan = useMemo(() => {
    if (!isAuthenticated) return t('drawer.plan.free');
    switch (authUser?.subscriptionTier) {
      case 'cafa_max':
        return 'Cafa Max';
      case 'cafa_smart':
        return 'Cafa Smart';
      case 'cafa_pro':
        return t('drawer.plan.pro');
      case 'free':
        return t('drawer.plan.free');
      default:
        return t('drawer.plan.free');
    }
  }, [authUser?.subscriptionTier, isAuthenticated, t]);

  const resolvedAvatarUri = useMemo(
    () => resolveAvatarUri(authUser?.avatar),
    [authUser?.avatar],
  );

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [resolvedAvatarUri]);

  const userAvatarSource = useMemo(() => {
    if (isAuthenticated && resolvedAvatarUri && !avatarLoadFailed) {
      return { uri: resolvedAvatarUri };
    }
    return require('../../assets/images/logo.png');
  }, [avatarLoadFailed, isAuthenticated, resolvedAvatarUri]);

  const loadChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      if (isAuthenticated) {
        const [conversationList, prefs] = await Promise.all([listAuthenticatedConversations(), getChatPreferences()]);
        setPinnedIds(prefs.pinnedIds);
        setCustomTitles(prefs.customTitles);
        const activeIds = new Set(conversationList.map((item) => item.id));
        const archivedSnapshots = await getArchivedChatSnapshots();
        const staleArchived = archivedSnapshots.filter((item) => activeIds.has(item.id)).map((item) => item.id);
        if (staleArchived.length) {
          await Promise.all(staleArchived.map((chatId) => removeArchivedChatSnapshot(chatId)));
        }
        const mappedChats = conversationList.map((item) => {
            const preview = item.preview || t('drawer.openChatHint');
            const rawTitle = (item.title || '').trim();
            const isUntitled = !rawTitle || rawTitle.toLowerCase() === 'new chat';
            return {
              id: item.id,
              title: isUntitled ? deriveSmartChatTitle(preview, t('drawer.newChat')) : rawTitle,
              preview,
              updatedAt: item.updatedAt,
            };
          });
        setChats(mappedChats);
        setActiveChatId((prev) => (mappedChats.some((chat) => chat.id === prev) ? prev : mappedChats[0]?.id || ''));
      } else {
        const conversationList = await listGuestConversations();
        const mappedChats = conversationList.map((item) => {
            const preview = item.lastMessagePreview || t('drawer.newChat');
            const rawTitle = (item.title || '').trim();
            const isUntitled = !rawTitle || rawTitle.toLowerCase() === 'new chat';
            return {
              id: item._id,
              title: isUntitled ? deriveSmartChatTitle(preview, t('drawer.newChat')) : rawTitle,
              preview,
              updatedAt: item.updatedAt,
            };
          });
        setChats(mappedChats);
        setActiveChatId((prev) => (mappedChats.some((chat) => chat.id === prev) ? prev : mappedChats[0]?.id || ''));
      }
    } catch {
      // Keep UI resilient; errors are non-fatal for drawer rendering.
    } finally {
      setLoadingChats(false);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    const unsubscribe = subscribeToChatMutated(() => {
      void loadChats();
    });
    return unsubscribe;
  }, [loadChats]);

  const filteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const withLocalTitles = chats.map((chat) => ({
      ...chat,
      title: customTitles[chat.id] || chat.title,
    }));

    const searched = !q
      ? withLocalTitles
      : withLocalTitles.filter(
          (chat) => chat.title.toLowerCase().includes(q) || chat.preview.toLowerCase().includes(q),
        );

    return searched.sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id) ? 1 : 0;
      const bPinned = pinnedIds.includes(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [chats, customTitles, pinnedIds, searchQuery]);

  const openRoute = useCallback(
    (routeName: 'index' | 'images' | 'videos' | 'voice' | 'plans' | 'help' | 'privacy-policy' | 'terms-of-service') => {
      navigation.navigate(routeName as never);
      navigation.closeDrawer();
    },
    [navigation],
  );

  const openChat = useCallback(
    (chatId: string) => {
      hapticSelection();
      setChatActionMenuId(null);
      setActiveChatId(chatId);
      (navigation as any).navigate('index', { conversationId: chatId, newChat: undefined });
      navigation.closeDrawer();
    },
    [navigation],
  );

  const createNewChat = useCallback(() => {
    hapticSelection();
    const tempId = `temp-new-chat-${Date.now()}`;
    const nowIso = new Date().toISOString();
    setActiveChatId(tempId);
    setChats((prev) => [
      {
        id: tempId,
        title: t('drawer.newChat'),
        preview: t('drawer.openChatHint'),
        updatedAt: nowIso,
      },
      ...prev.filter((chat) => !chat.id.startsWith('temp-new-chat-')),
    ]);
    (navigation as any).navigate('index', { newChat: `${Date.now()}`, conversationId: undefined });
    navigation.closeDrawer();
  }, [navigation, t]);

  const onUserOption = useCallback(
    (action: 'settings' | 'plans' | 'help' | 'privacy' | 'terms' | 'login' | 'signup' | 'signout') => {
      hapticSelection();
      setMenuOpen(false);

      if (action === 'settings') {
        navigation.closeDrawer();
        setShowSettingsModal(true);
        return;
      }
      if (action === 'plans') return openRoute('plans');
      if (action === 'login') return void router.push('/(auth)/login');
      if (action === 'signup') return void router.push('/(auth)/signup');
      if (action === 'help') return openRoute('help');
      if (action === 'privacy') return openRoute('privacy-policy');
      if (action === 'terms') return openRoute('terms-of-service');
      setShowSignoutPrompt(true);
    },
    [navigation, openRoute],
  );

  const onRenameChat = useCallback((chatId: string) => {
    setChatActionMenuId(null);
    setRenameChatId(chatId);
    setShowRenameModal(true);
  }, []);

  const onSaveRename = useCallback(async (nextTitle: string) => {
    if (!renameChatId || !nextTitle.trim()) {
      setShowRenameModal(false);
      return;
    }
    const nextPrefs = await setCustomChatTitle(renameChatId, nextTitle.trim());
    setCustomTitles(nextPrefs.customTitles);
    setShowRenameModal(false);
  }, [renameChatId]);

  const onTogglePinChat = useCallback(async (chatId: string) => {
    setChatActionMenuId(null);
    const currentlyPinned = pinnedIds.includes(chatId);
    const nextPrefs = await setPinnedChat(chatId, !currentlyPinned);
    setPinnedIds(nextPrefs.pinnedIds);
  }, [pinnedIds]);

  const onArchiveChat = useCallback(async (chatId: string) => {
    setChatActionMenuId(null);
    if (!isAuthenticated) return;
    try {
      const chat = chats.find((item) => item.id === chatId);
      await archiveAuthenticatedConversation(chatId, true);
      if (chat) {
        await upsertArchivedChatSnapshots([
          {
            id: chat.id,
            title: customTitles[chat.id] || chat.title,
            preview: chat.preview,
            updatedAt: chat.updatedAt,
            archivedAt: Date.now(),
          },
        ]);
      }
      setChats((prev) => prev.filter((chat) => chat.id !== chatId));
    } catch {
      // Keep experience resilient.
    }
  }, [chats, customTitles, isAuthenticated]);

  const onRequestDeleteChat = useCallback((chatId: string) => {
    setChatActionMenuId(null);
    setDeleteChatId(chatId);
    setShowDeletePrompt(true);
  }, []);

  const onConfirmDeleteChat = useCallback(async () => {
    if (!deleteChatId) {
      setShowDeletePrompt(false);
      return;
    }
    try {
      if (isAuthenticated) {
        await deleteAuthenticatedConversation(deleteChatId);
      }
      await removeArchivedChatSnapshot(deleteChatId);
      setChats((prev) => prev.filter((chat) => chat.id !== deleteChatId));
    } catch {
      // Keep experience resilient.
    } finally {
      setShowDeletePrompt(false);
      setDeleteChatId(null);
    }
  }, [deleteChatId, isAuthenticated]);

  const renderChatItem = useCallback(
    ({ item }: { item: DrawerChatItem }) => (
      <ChatRow
        item={item}
        active={item.id === activeChatId}
        menuOpen={chatActionMenuId === item.id}
        onPress={openChat}
        onToggleMenu={(id) => setChatActionMenuId((prev) => (prev === id ? null : id))}
        onRename={onRenameChat}
        onPin={onTogglePinChat}
        onArchive={onArchiveChat}
        onDelete={onRequestDeleteChat}
        textPrimary={colors.textPrimary}
        textSecondary={colors.textSecondary}
        borderColor={colors.border}
        activeTint={colors.primary}
        isPinned={pinnedIds.includes(item.id)}
        isAuthenticated={isAuthenticated}
        t={t}
      />
    ),
    [
      activeChatId,
      chatActionMenuId,
      colors.border,
      colors.primary,
      colors.textPrimary,
      colors.textSecondary,
      isAuthenticated,
      onArchiveChat,
      onRenameChat,
      onRequestDeleteChat,
      onTogglePinChat,
      openChat,
      pinnedIds,
      t,
    ],
  );

  const renameInitialValue = useMemo(() => {
    const chat = chats.find((item) => item.id === renameChatId);
    if (!chat) return '';
    return customTitles[chat.id] || chat.title;
  }, [chats, customTitles, renameChatId]);

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: colors.surface,
        paddingTop: Math.max(insets.top, 12),
        paddingHorizontal: 10,
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      {menuOpen || chatActionMenuId ? (
        <Pressable
          onPress={() => {
            setMenuOpen(false);
            setChatActionMenuId(null);
          }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
      ) : null}

      <AppPromptModal
        visible={showSignoutPrompt}
        title={t('drawer.signoutPromptTitle')}
        message={t('drawer.signoutPromptMessage')}
        confirmLabel={t('drawer.confirmSignout')}
        cancelLabel={t('auth.signoutCancel')}
        confirmTone="danger"
        iconName="log-out-outline"
        onCancel={() => setShowSignoutPrompt(false)}
        onConfirm={() => {
          navigation.closeDrawer();
          setShowSignoutPrompt(false);
          setMenuOpen(false);
          setChatActionMenuId(null);
          signOut();
          router.replace('/(drawer)');
        }}
      />

      <AppPromptModal
        visible={showDeletePrompt}
        title={t('drawer.deleteTitle')}
        message={t('drawer.deleteMessage')}
        confirmLabel={t('drawer.deleteConfirm')}
        cancelLabel={t('drawer.cancel')}
        confirmTone="danger"
        iconName="trash-outline"
        onCancel={() => setShowDeletePrompt(false)}
        onConfirm={() => {
          void onConfirmDeleteChat();
        }}
      />

      <AppInputPromptModal
        visible={showRenameModal}
        title={t('drawer.renameTitle')}
        message={t('drawer.renameMessage')}
        initialValue={renameInitialValue}
        placeholder={t('drawer.renamePlaceholder')}
        confirmLabel={t('drawer.save')}
        cancelLabel={t('drawer.cancel')}
        onCancel={() => setShowRenameModal(false)}
        onConfirm={(value) => {
          void onSaveRename(value);
        }}
      />

      <SettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onChatsMutated={() => {
          void loadChats();
        }}
      />

      <View>
        <View className="mb-3 mt-2 gap-2">
          <AppButton label={t('drawer.newChat')} iconName="add-outline" compact minWidth={82} onPress={createNewChat} />
          <AppButton label={t('drawer.images')} iconName="images-outline" compact minWidth={74} variant="outline" onPress={() => openRoute('images')} />
          <AppButton label={t('drawer.videos')} iconName="videocam-outline" compact minWidth={74} variant="outline" onPress={() => openRoute('videos')} />
        </View>

        <View
          accessibilityRole="search"
          className="mb-3 flex-row items-center rounded-full border px-3"
          style={{ borderColor: colors.border, backgroundColor: isDark ? '#0F0F0F' : '#FFFFFF', height: 42 }}
        >
          <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('drawer.searchChats')}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={t('drawer.searchChats')}
            accessibilityHint={t('drawer.searchChatsHint')}
            className="ml-2 flex-1"
            style={{ color: colors.textPrimary, fontSize: 14 }}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <View className="flex-1">
        <FlatList
          data={filteredChats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
          accessibilityLabel={t('drawer.chatList')}
          ListEmptyComponent={
            <View className="rounded-xl border px-3 py-3" style={{ borderColor: colors.border }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {loadingChats ? t('drawer.loadingChats') : t('drawer.noChats')}
              </Text>
            </View>
          }
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={8}
        />
      </View>

      <View className="relative pt-3">
        {menuOpen ? (
          <View
            className="absolute left-0 right-0 rounded-2xl p-2"
            style={{
              bottom: 74 + Math.max(insets.bottom, 8),
              borderWidth: 1.5,
              borderColor: colors.primary,
              backgroundColor: isDark ? '#0F0F0F' : '#FFFFFF',
              zIndex: 50,
            }}
          >
            {isAuthenticated ? (
              <>
                <Pressable onPress={() => onUserOption('settings')} accessibilityRole="button" accessibilityLabel={t('drawer.userMenu.settings')} className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="settings-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>{t('drawer.userMenu.settings')}</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('plans')} accessibilityRole="button" accessibilityLabel={t('drawer.userMenu.upgrade')} className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="rocket-outline" size={16} color={colors.primary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>{t('drawer.userMenu.upgrade')}</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('help')} accessibilityRole="button" accessibilityLabel={t('drawer.userMenu.help')} className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="help-circle-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>{t('drawer.userMenu.help')}</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('privacy')} accessibilityRole="button" accessibilityLabel={t('drawer.userMenu.privacy')} className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>{t('drawer.userMenu.privacy')}</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('terms')} accessibilityRole="button" accessibilityLabel={t('drawer.userMenu.terms')} className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="document-text-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>{t('drawer.userMenu.terms')}</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('signout')} accessibilityRole="button" accessibilityLabel={t('drawer.userMenu.signout')} className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="log-out-outline" size={16} color="#E11D48" />
                  <Text style={{ color: '#E11D48', fontSize: 13, fontWeight: '600', marginLeft: 8 }}>{t('drawer.userMenu.signout')}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={() => onUserOption('login')} accessibilityRole="button" accessibilityLabel={t('drawer.userMenu.login')} className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="log-in-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>{t('drawer.userMenu.login')}</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('signup')} accessibilityRole="button" accessibilityLabel={t('drawer.userMenu.signup')} className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="person-add-outline" size={16} color={colors.primary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>{t('drawer.userMenu.signup')}</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        <View
          className="rounded-full"
          style={{
            borderWidth: 1.5,
            borderColor: colors.primary,
            backgroundColor: isDark ? '#0F0F0F' : '#FFFFFF',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('drawer.userCard')}
            accessibilityHint={t('drawer.userCardHint')}
            onPress={() => setMenuOpen((prev) => !prev)}
            className="rounded-full p-3"
            style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Image
                  source={userAvatarSource}
                  className="h-12 w-12 rounded-full"
                  style={{ borderWidth: 1.5, borderColor: colors.primary }}
                  resizeMode="cover"
                  accessibilityLabel={`${t('drawer.userAvatar')}: ${userName}`}
                  onError={() => setAvatarLoadFailed(true)}
                />
                <View className="ml-3">
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{userName}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{currentPlan}</Text>
                </View>
              </View>
              <Ionicons name={menuOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={colors.textSecondary} />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

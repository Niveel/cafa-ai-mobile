import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Share, Text, TextInput, View } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAppContext } from '@/context';
import {
  archiveAuthenticatedConversation,
  deleteAuthenticatedConversation,
  listAuthenticatedConversations,
  listGuestConversations,
} from '@/features';
import { useAppTheme } from '@/hooks';
import {
  getChatPreferences,
  setCustomChatTitle,
  setPinnedChat,
} from '@/services/storage/chatPreferences';
import { hapticSelection } from '@/utils';
import { AppButton } from './AppButton';
import { AppInputPromptModal } from './AppInputPromptModal';
import { AppPromptModal } from './AppPromptModal';
import { SettingsModal } from './SettingsModal';

type DrawerChatItem = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
};

type ChatRowProps = {
  item: DrawerChatItem;
  active: boolean;
  menuOpen: boolean;
  onPress: (id: string) => void;
  onToggleMenu: (id: string) => void;
  onShare: (id: string) => void;
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
};

const ChatRow = memo(function ChatRow({
  item,
  active,
  menuOpen,
  onPress,
  onToggleMenu,
  onShare,
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
}: ChatRowProps) {
  return (
    <View className="relative">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open chat: ${item.title}`}
        accessibilityHint="Opens this conversation."
        onPress={() => onPress(item.id)}
        style={({ pressed }) => ({
          borderWidth: 1,
          borderColor: active ? activeTint : borderColor,
          backgroundColor: active ? `${activeTint}1A` : 'transparent',
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <View className="flex-row items-start justify-between">
          <View className="mr-3 flex-1">
            <View className="flex-row items-center">
              {isPinned ? (
                <Ionicons name="pin" size={12} color={activeTint} style={{ marginRight: 6 }} />
              ) : null}
              <Text numberOfLines={1} style={{ color: textPrimary, fontWeight: '600', fontSize: 14, flexShrink: 1 }}>
                {item.title}
              </Text>
            </View>
            <Text numberOfLines={1} style={{ marginTop: 2, color: textSecondary, fontSize: 12 }}>
              {item.preview}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open options for ${item.title}`}
            accessibilityHint="Opens chat actions like share, rename, and delete."
            onPress={() => onToggleMenu(item.id)}
            className="rounded-full p-1.5"
            hitSlop={8}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={textSecondary} />
          </Pressable>
        </View>
      </Pressable>

      {menuOpen ? (
        <View
          className="absolute right-2 top-11 z-50 min-w-[158px] rounded-xl border p-1"
          style={{ borderColor, backgroundColor: '#0F0F0F' }}
        >
          <Pressable
            onPress={() => onShare(item.id)}
            accessibilityRole="button"
            accessibilityLabel="Share chat"
            className="flex-row items-center rounded-lg px-2.5 py-2"
          >
            <Ionicons name="share-social-outline" size={14} color={textPrimary} />
            <Text style={{ color: textPrimary, marginLeft: 8, fontSize: 12 }}>Share</Text>
          </Pressable>
          <Pressable
            onPress={() => onRename(item.id)}
            accessibilityRole="button"
            accessibilityLabel="Rename chat"
            className="flex-row items-center rounded-lg px-2.5 py-2"
          >
            <Ionicons name="create-outline" size={14} color={textPrimary} />
            <Text style={{ color: textPrimary, marginLeft: 8, fontSize: 12 }}>Rename</Text>
          </Pressable>
          <Pressable
            onPress={() => onPin(item.id)}
            accessibilityRole="button"
            accessibilityLabel={isPinned ? 'Unpin chat' : 'Pin chat'}
            className="flex-row items-center rounded-lg px-2.5 py-2"
          >
            <Ionicons name={isPinned ? 'pin-outline' : 'pin'} size={14} color={textPrimary} />
            <Text style={{ color: textPrimary, marginLeft: 8, fontSize: 12 }}>{isPinned ? 'Unpin chat' : 'Pin chat'}</Text>
          </Pressable>
          {isAuthenticated ? (
            <Pressable
              onPress={() => onArchive(item.id)}
              accessibilityRole="button"
              accessibilityLabel="Archive chat"
              className="flex-row items-center rounded-lg px-2.5 py-2"
            >
              <Ionicons name="archive-outline" size={14} color={textPrimary} />
              <Text style={{ color: textPrimary, marginLeft: 8, fontSize: 12 }}>Archive</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => onDelete(item.id)}
            accessibilityRole="button"
            accessibilityLabel="Delete chat"
            className="flex-row items-center rounded-lg px-2.5 py-2"
          >
            <Ionicons name="trash-outline" size={14} color="#E11D48" />
            <Text style={{ color: '#E11D48', marginLeft: 8, fontSize: 12, fontWeight: '600' }}>Delete</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

export function AppDrawerContent({ navigation }: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { isAuthenticated, signOut } = useAppContext();
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

  const userName = isAuthenticated ? 'Cafa User' : 'Guest User';
  const currentPlan = isAuthenticated ? 'Cafa Pro' : 'Free Plan';

  const loadChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      if (isAuthenticated) {
        const [conversationList, prefs] = await Promise.all([listAuthenticatedConversations(), getChatPreferences()]);
        setPinnedIds(prefs.pinnedIds);
        setCustomTitles(prefs.customTitles);
        setChats(
          conversationList.map((item) => ({
            id: item.id,
            title: item.title,
            preview: item.preview || 'Continue this conversation.',
            updatedAt: item.updatedAt,
          })),
        );
        setActiveChatId((prev) => prev || conversationList[0]?.id || '');
      } else {
        const conversationList = await listGuestConversations();
        setChats(
          conversationList.map((item) => ({
            id: item._id,
            title: item.title,
            preview: item.lastMessagePreview || 'Start a fresh conversation.',
            updatedAt: item.updatedAt,
          })),
        );
        setActiveChatId((prev) => prev || conversationList[0]?._id || '');
      }
    } catch {
      // Keep UI resilient; errors are non-fatal for drawer rendering.
    } finally {
      setLoadingChats(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadChats();
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
      navigation.navigate('index' as never, { conversationId: chatId } as never);
      navigation.closeDrawer();
    },
    [navigation],
  );

  const createNewChat = useCallback(() => {
    hapticSelection();
    navigation.navigate('index' as never, { newChat: '1' } as never);
    navigation.closeDrawer();
  }, [navigation]);

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

  const onShareChat = useCallback(
    async (chatId: string) => {
      setChatActionMenuId(null);
      const chat = chats.find((item) => item.id === chatId);
      if (!chat) return;
      await Share.share({
        message: `Cafa AI chat\n\n${customTitles[chat.id] || chat.title}\n${chat.preview}`,
      });
    },
    [chats, customTitles],
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
      await archiveAuthenticatedConversation(chatId, true);
      setChats((prev) => prev.filter((chat) => chat.id !== chatId));
    } catch {
      // Keep experience resilient.
    }
  }, [isAuthenticated]);

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
        onShare={onShareChat}
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
      onShareChat,
      onTogglePinChat,
      openChat,
      pinnedIds,
    ],
  );

  const renameInitialValue = useMemo(() => {
    const chat = chats.find((item) => item.id === renameChatId);
    if (!chat) return '';
    return customTitles[chat.id] || chat.title;
  }, [chats, customTitles, renameChatId]);

  return (
    <View
      className="flex-1 pb-4"
      style={{ backgroundColor: colors.surface, paddingTop: Math.max(insets.top, 12), paddingHorizontal: 10 }}
    >
      <AppPromptModal
        visible={showSignoutPrompt}
        title="Sign out?"
        message="You will return to guest mode and can still chat with limited features."
        confirmLabel="Sign out"
        cancelLabel="Stay logged in"
        confirmTone="danger"
        iconName="log-out-outline"
        onCancel={() => setShowSignoutPrompt(false)}
        onConfirm={() => {
          setShowSignoutPrompt(false);
          signOut();
        }}
      />

      <AppPromptModal
        visible={showDeletePrompt}
        title="Delete chat?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmTone="danger"
        iconName="trash-outline"
        onCancel={() => setShowDeletePrompt(false)}
        onConfirm={() => {
          void onConfirmDeleteChat();
        }}
      />

      <AppInputPromptModal
        visible={showRenameModal}
        title="Rename chat"
        message="Choose a clear title for this conversation."
        initialValue={renameInitialValue}
        placeholder="Conversation title"
        confirmLabel="Save"
        cancelLabel="Cancel"
        onCancel={() => setShowRenameModal(false)}
        onConfirm={(value) => {
          void onSaveRename(value);
        }}
      />

      <SettingsModal visible={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

      <View>
        <View className="mb-3 gap-2">
          <AppButton label="New chat" iconName="add-outline" compact minWidth={82} onPress={createNewChat} />
          <AppButton label="Images" iconName="images-outline" compact minWidth={74} variant="outline" onPress={() => openRoute('images')} />
          <AppButton label="Videos" iconName="videocam-outline" compact minWidth={74} variant="outline" onPress={() => openRoute('videos')} />
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
            placeholder="Search chats"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Search chats"
            accessibilityHint="Type to filter conversations in real time."
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
          accessibilityLabel="Chat conversations list"
          ListEmptyComponent={
            <View className="rounded-xl border px-3 py-3" style={{ borderColor: colors.border }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {loadingChats ? 'Loading chats...' : 'No chats found.'}
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
              bottom: 74,
              borderWidth: 1.5,
              borderColor: colors.primary,
              backgroundColor: isDark ? '#0F0F0F' : '#FFFFFF',
              zIndex: 50,
            }}
          >
            {isAuthenticated ? (
              <>
                <Pressable onPress={() => onUserOption('settings')} accessibilityRole="button" accessibilityLabel="Open settings" className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="settings-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Settings</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('plans')} accessibilityRole="button" accessibilityLabel="Upgrade plan" className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="rocket-outline" size={16} color={colors.primary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Upgrade plan</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('help')} accessibilityRole="button" accessibilityLabel="Open help" className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="help-circle-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Help</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('privacy')} accessibilityRole="button" accessibilityLabel="Open privacy policy" className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Privacy policy</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('terms')} accessibilityRole="button" accessibilityLabel="Open terms of service" className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="document-text-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Terms of service</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('signout')} accessibilityRole="button" accessibilityLabel="Sign out" className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="log-out-outline" size={16} color="#E11D48" />
                  <Text style={{ color: '#E11D48', fontSize: 13, fontWeight: '600', marginLeft: 8 }}>Sign out</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={() => onUserOption('login')} accessibilityRole="button" accessibilityLabel="Go to login" className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="log-in-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Login</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('signup')} accessibilityRole="button" accessibilityLabel="Go to signup" className="flex-row items-center rounded-lg px-3 py-2">
                  <Ionicons name="person-add-outline" size={16} color={colors.primary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Signup</Text>
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
            accessibilityLabel={`Account card. ${userName}. Current plan ${currentPlan}.`}
            accessibilityHint="Opens account options."
            onPress={() => setMenuOpen((prev) => !prev)}
            className="rounded-full p-3"
            style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Image source={require('../../assets/images/logo.png')} className="h-10 w-10 rounded-full" accessibilityLabel="User avatar" />
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

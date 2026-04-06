import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Text, TextInput, View } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAppContext } from '@/context';
import { mockChats, type ChatSummary } from '@/data';
import { useAppTheme } from '@/hooks';
import { AppButton } from './AppButton';
import { AppPromptModal } from './AppPromptModal';
import { SettingsModal } from './SettingsModal';

type ChatRowProps = {
  item: ChatSummary;
  active: boolean;
  onPress: (id: string) => void;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
  activeTint: string;
};

const ChatRow = memo(function ChatRow({
  item,
  active,
  onPress,
  textPrimary,
  textSecondary,
  borderColor,
  activeTint,
}: ChatRowProps) {
  return (
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
      <Text numberOfLines={1} style={{ color: textPrimary, fontWeight: '600', fontSize: 14 }}>
        {item.title}
      </Text>
      <Text numberOfLines={1} style={{ marginTop: 2, color: textSecondary, fontSize: 12 }}>
        {item.preview}
      </Text>
      <Text style={{ marginTop: 6, color: textSecondary, fontSize: 11 }}>{item.updatedAt}</Text>
    </Pressable>
  );
});

export function AppDrawerContent({ navigation }: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { isAuthenticated, signOut } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChatId, setActiveChatId] = useState<string>(mockChats[0]?.id ?? '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSignoutPrompt, setShowSignoutPrompt] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>(mockChats);

  const userName = isAuthenticated ? 'Cafa User' : 'Guest User';
  const currentPlan = isAuthenticated ? 'Cafa Pro' : 'Free Plan';

  const filteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(
      (chat) => chat.title.toLowerCase().includes(q) || chat.preview.toLowerCase().includes(q),
    );
  }, [chats, searchQuery]);

  const openRoute = useCallback(
    (
      routeName:
        | 'index'
        | 'images'
        | 'videos'
        | 'voice'
        | 'plans'
        | 'help'
        | 'privacy-policy'
        | 'terms-of-service',
    ) => {
      navigation.navigate(routeName as never);
      navigation.closeDrawer();
    },
    [navigation],
  );

  const openChat = useCallback(
    (chatId: string) => {
      setActiveChatId(chatId);
      openRoute('index');
    },
    [openRoute],
  );

  const createNewChat = useCallback(() => {
    const id = `chat-${Date.now()}`;
    const nextChat: ChatSummary = {
      id,
      title: 'New Chat',
      preview: 'Start a fresh conversation.',
      updatedAt: 'Now',
    };
    setChats((prev) => [nextChat, ...prev]);
    setActiveChatId(id);
    setSearchQuery('');
    openRoute('index');
  }, [openRoute]);

  const onUserOption = useCallback(
    (action: 'settings' | 'plans' | 'help' | 'privacy' | 'terms' | 'login' | 'signup' | 'signout') => {
      setMenuOpen(false);

      if (action === 'settings') {
        navigation.closeDrawer();
        setShowSettingsModal(true);
        return;
      }

      if (action === 'plans') {
        openRoute('plans');
        return;
      }

      if (action === 'login') {
        router.push('/(auth)/login');
        return;
      }

      if (action === 'signup') {
        router.push('/(auth)/signup');
        return;
      }

      if (action === 'help') {
        openRoute('help');
        return;
      }

      if (action === 'privacy') {
        openRoute('privacy-policy');
        return;
      }

      if (action === 'terms') {
        openRoute('terms-of-service');
        return;
      }

      setShowSignoutPrompt(true);
    },
    [navigation, openRoute],
  );

  const renderChatItem = useCallback(
    ({ item }: { item: ChatSummary }) => (
      <ChatRow
        item={item}
        active={item.id === activeChatId}
        onPress={openChat}
        textPrimary={colors.textPrimary}
        textSecondary={colors.textSecondary}
        borderColor={colors.border}
        activeTint={colors.primary}
      />
    ),
    [activeChatId, colors.border, colors.primary, colors.textPrimary, colors.textSecondary, openChat],
  );

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
      <SettingsModal visible={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

      <View>
        <View className="mb-3 gap-2">
          <AppButton
            label="New chat"
            iconName="add-outline"
            compact
            minWidth={82}
            onPress={createNewChat}
          />
          <AppButton
            label="Images"
            iconName="images-outline"
            compact
            minWidth={74}
            variant="outline"
            onPress={() => openRoute('images')}
          />
          <AppButton
            label="Videos"
            iconName="videocam-outline"
            compact
            minWidth={74}
            variant="outline"
            onPress={() => openRoute('videos')}
          />
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
                <Pressable
                  onPress={() => onUserOption('settings')}
                  accessibilityRole="button"
                  accessibilityLabel="Open settings"
                  accessibilityHint="Opens the settings modal."
                  className="flex-row items-center rounded-lg px-3 py-2"
                >
                  <Ionicons name="settings-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Settings</Text>
                </Pressable>
                <Pressable
                  onPress={() => onUserOption('plans')}
                  accessibilityRole="button"
                  accessibilityLabel="Upgrade plan"
                  accessibilityHint="Opens plan and billing options."
                  className="flex-row items-center rounded-lg px-3 py-2"
                >
                  <Ionicons name="rocket-outline" size={16} color={colors.primary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Upgrade plan</Text>
                </Pressable>
                <Pressable
                  onPress={() => onUserOption('help')}
                  accessibilityRole="button"
                  accessibilityLabel="Open help"
                  accessibilityHint="Opens help resources."
                  className="flex-row items-center rounded-lg px-3 py-2"
                >
                  <Ionicons name="help-circle-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Help</Text>
                </Pressable>
                <Pressable
                  onPress={() => onUserOption('privacy')}
                  accessibilityRole="button"
                  accessibilityLabel="Open privacy policy"
                  accessibilityHint="Opens privacy policy information."
                  className="flex-row items-center rounded-lg px-3 py-2"
                >
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Privacy policy</Text>
                </Pressable>
                <Pressable
                  onPress={() => onUserOption('terms')}
                  accessibilityRole="button"
                  accessibilityLabel="Open terms of service"
                  accessibilityHint="Opens terms of service information."
                  className="flex-row items-center rounded-lg px-3 py-2"
                >
                  <Ionicons name="document-text-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Terms of service</Text>
                </Pressable>
                <Pressable
                  onPress={() => onUserOption('signout')}
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                  accessibilityHint="Signs you out and returns to guest mode."
                  className="flex-row items-center rounded-lg px-3 py-2"
                >
                  <Ionicons name="log-out-outline" size={16} color="#E11D48" />
                  <Text style={{ color: '#E11D48', fontSize: 13, fontWeight: '600', marginLeft: 8 }}>Sign out</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => onUserOption('login')}
                  accessibilityRole="button"
                  accessibilityLabel="Go to login"
                  accessibilityHint="Opens the login screen."
                  className="flex-row items-center rounded-lg px-3 py-2"
                >
                  <Ionicons name="log-in-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Login</Text>
                </Pressable>
                <Pressable
                  onPress={() => onUserOption('signup')}
                  accessibilityRole="button"
                  accessibilityLabel="Go to signup"
                  accessibilityHint="Opens account creation screen."
                  className="flex-row items-center rounded-lg px-3 py-2"
                >
                  <Ionicons name="person-add-outline" size={16} color={colors.primary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Signup</Text>
                </Pressable>
                <Pressable
                  onPress={() => onUserOption('help')}
                  accessibilityRole="button"
                  accessibilityLabel="Open help"
                  accessibilityHint="Opens help resources."
                  className="flex-row items-center rounded-lg px-3 py-2"
                >
                  <Ionicons name="help-circle-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Help</Text>
                </Pressable>
                <Pressable
                  onPress={() => onUserOption('privacy')}
                  accessibilityRole="button"
                  accessibilityLabel="Open privacy policy"
                  accessibilityHint="Opens privacy policy information."
                  className="flex-row items-center rounded-lg px-3 py-2"
                >
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Privacy policy</Text>
                </Pressable>
                <Pressable
                  onPress={() => onUserOption('terms')}
                  accessibilityRole="button"
                  accessibilityLabel="Open terms of service"
                  accessibilityHint="Opens terms of service information."
                  className="flex-row items-center rounded-lg px-3 py-2"
                >
                  <Ionicons name="document-text-outline" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, marginLeft: 8 }}>Terms of service</Text>
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
            style={({ pressed }) => ({
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Image
                  source={require('../../assets/images/logo.png')}
                  className="h-10 w-10 rounded-full"
                  accessibilityLabel="User avatar"
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

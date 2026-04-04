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
    (routeName: 'index' | 'images' | 'videos' | 'voice' | 'plans' | 'settings') => {
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
    (action: 'settings' | 'plans' | 'login' | 'signup' | 'signout') => {
      setMenuOpen(false);

      if (action === 'settings') {
        openRoute('settings');
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

      signOut();
    },
    [openRoute, signOut],
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
      className="flex-1 px-4 pb-4"
      style={{ backgroundColor: colors.surface, paddingTop: Math.max(insets.top, 12) }}
    >
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

      <View className="pt-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Account card. ${userName}. Current plan ${currentPlan}.`}
          accessibilityHint="Opens account options."
          onPress={() => setMenuOpen((prev) => !prev)}
          className="rounded-2xl border p-3"
          style={({ pressed }) => ({
            borderColor: colors.border,
            backgroundColor: isDark ? '#0F0F0F' : '#FFFFFF',
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

        {menuOpen ? (
          <View className="mt-2 rounded-xl border p-2" style={{ borderColor: colors.border }}>
            {isAuthenticated ? (
              <>
                <Pressable onPress={() => onUserOption('settings')} className="rounded-lg px-3 py-2">
                  <Text style={{ color: colors.textPrimary, fontSize: 13 }}>Settings</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('plans')} className="rounded-lg px-3 py-2">
                  <Text style={{ color: colors.textPrimary, fontSize: 13 }}>Plan & Billing</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('signout')} className="rounded-lg px-3 py-2">
                  <Text style={{ color: '#E11D48', fontSize: 13, fontWeight: '600' }}>Sign out</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={() => onUserOption('login')} className="rounded-lg px-3 py-2">
                  <Text style={{ color: colors.textPrimary, fontSize: 13 }}>Login</Text>
                </Pressable>
                <Pressable onPress={() => onUserOption('signup')} className="rounded-lg px-3 py-2">
                  <Text style={{ color: colors.textPrimary, fontSize: 13 }}>Signup</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

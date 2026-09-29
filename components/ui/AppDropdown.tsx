import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/config';
import { hapticSelection } from '@/utils';

// Real fix: every ad-hoc dropdown in the app (Settings language, AI Tone,
// Response Length, default Voice) rendered its option list as a plain
// absolutely-positioned View sitting inside whatever ScrollView/Modal it
// lived in. There was never a backdrop to catch a tap "elsewhere" on the
// screen, so the only ways to close one were: pick an option, or tap the
// same trigger again. This component renders the option list in its own
// top-level Modal instead -- a real anchored popover (the same approach
// Material Design's Menu and most native pickers use) -- so a full-screen
// backdrop can sit behind the panel and close it on any outside tap,
// consistently, everywhere it's used.

export type AppDropdownOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type AppDropdownProps<T extends string> = {
  value: T;
  options: AppDropdownOption<T>[];
  onChange: (value: T) => void;
  colors: Pick<ThemeColors, 'primary' | 'border' | 'textPrimary' | 'textSecondary'>;
  isDark: boolean;
  disabled?: boolean;
  placeholder?: string;
  accessibilityLabel?: string;
  /** Caps the option panel's height; long lists (e.g. voices) scroll inside it. */
  maxMenuHeight?: number;
};

const ESTIMATED_ROW_HEIGHT = 40;
const MENU_VERTICAL_MARGIN = 8;

export function AppDropdown<T extends string>({
  value,
  options,
  onChange,
  colors,
  isDark,
  disabled = false,
  placeholder,
  accessibilityLabel,
  maxMenuHeight = 280,
}: AppDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const triggerRef = useRef<View | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const selectedOption = options.find((entry) => entry.value === value);

  useEffect(() => {
    if (!open) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  }, [open, fade]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    const node = triggerRef.current as unknown as {
      measureInWindow?: (cb: (x: number, y: number, width: number, height: number) => void) => void;
    } | null;
    if (!node?.measureInWindow) {
      setOpen(true);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }, [disabled]);

  const estimatedMenuHeight = Math.min(maxMenuHeight, options.length * ESTIMATED_ROW_HEIGHT + 8);
  const spaceBelow = anchor ? windowHeight - (anchor.y + anchor.height) : 0;
  const spaceAbove = anchor ? anchor.y : 0;
  const openUpward = anchor ? spaceBelow < estimatedMenuHeight + MENU_VERTICAL_MARGIN && spaceAbove > spaceBelow : false;
  const menuHeight = Math.min(estimatedMenuHeight, Math.max(120, (openUpward ? spaceAbove : spaceBelow) - MENU_VERTICAL_MARGIN * 2));

  const menuTop = anchor
    ? openUpward
      ? Math.max(MENU_VERTICAL_MARGIN, anchor.y - menuHeight - MENU_VERTICAL_MARGIN)
      : anchor.y + anchor.height + MENU_VERTICAL_MARGIN
    : 0;
  const menuLeft = anchor ? Math.max(8, Math.min(anchor.x, windowWidth - anchor.width - 8)) : 0;

  return (
    <>
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={openMenu}
        className="h-10 flex-row items-center justify-between rounded-xl border px-3"
        style={{
          borderColor: colors.primary,
          backgroundColor: isDark ? '#101015' : '#FFFFFF',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, flexShrink: 1 }}>
          {selectedOption?.label ?? placeholder ?? ''}
        </Text>
        <Ionicons name={open ? 'chevron-up-outline' : 'chevron-down-outline'} size={16} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={close}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        {anchor ? (
          <Animated.View
            style={{
              position: 'absolute',
              top: menuTop,
              left: menuLeft,
              width: anchor.width,
              maxHeight: menuHeight,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: isDark ? '#15151B' : '#FFFFFF',
              padding: 4,
              opacity: fade,
              transform: [
                {
                  translateY: fade.interpolate({
                    inputRange: [0, 1],
                    outputRange: [openUpward ? 6 : -6, 0],
                  }),
                },
              ],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: isDark ? 0.4 : 0.16,
              shadowRadius: 14,
              elevation: 12,
            }}
          >
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {options.map((entry) => {
                const selected = entry.value === value;
                return (
                  <Pressable
                    key={entry.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={entry.label}
                    onPress={() => {
                      hapticSelection();
                      onChange(entry.value);
                      close();
                    }}
                    className="rounded-lg px-3 py-2.5"
                    style={{ backgroundColor: selected ? `${colors.primary}20` : 'transparent' }}
                  >
                    <Text style={{ color: selected ? colors.primary : colors.textPrimary, fontSize: 13, fontWeight: selected ? '700' : '500' }}>
                      {entry.label}
                    </Text>
                    {entry.description ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>{entry.description}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        ) : null}
      </Modal>
    </>
  );
}

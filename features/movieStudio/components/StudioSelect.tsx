import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { useAppTheme } from '@/hooks';

import { StudioIcon } from './StudioIcon';
import { useStudioPalette } from '../theme';

type Option = { value: string; label: string };
type Props = {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

/** Picker used for selects and durations: closed state shows chevron-down, the chosen option shows check. */
export function StudioSelect({ label, value, options, onChange, placeholder = '', disabled = false }: Props) {
  const { colors } = useAppTheme();
  const P = useStudioPalette();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const surface = P.surface;

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}${selected ? `, ${selected.label}` : ''}`}
        style={{
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: P.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          backgroundColor: surface,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Text style={{ color: selected ? colors.textPrimary : colors.textSecondary, fontSize: 14, flex: 1 }} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <StudioIcon name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setOpen(false)}>
          <View
            style={{
              backgroundColor: P.sheet,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '70%',
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', padding: 14 }}>{label}</Text>
            <ScrollView>
              {options.map((o) => {
                const on = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: on }}
                    style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: on ? '700' : '500' }}>{o.label}</Text>
                    {on ? <StudioIcon name="check" size={16} color="#9333EA" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/hooks';

import { emitStudioGate } from '../data/events';
import { formatCredits } from '../domain/rules';
import { useStudioCredits } from '../hooks/useStudioCredits';
import { StudioIcon } from './StudioIcon';
import { useStudioPalette } from '../theme';

type Props = {
  /** Shows the "Discard project" trash button (inside a flow, project unfinished). */
  onDiscard?: () => void;
};

/** Studio header actions: credits chip (coins icon, opens Top-up) and, in a flow, Discard project. */
export function StudioHeaderActions({ onDiscard }: Props) {
  const P = useStudioPalette();
  const { t } = useI18n();
  const { credits } = useStudioCredits();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {onDiscard ? (
        <Pressable
          onPress={onDiscard}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('studio.discard.action')}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <StudioIcon name="trash-2" size={16} color="#EF4444" />
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => emitStudioGate('open_topup')}
        accessibilityRole="button"
        accessibilityLabel={t('studio.topup.sheetTitle')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          borderWidth: 1,
          borderColor: P.border,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 6,
        }}
      >
        <StudioIcon name="coins" size={16} color="#F59E0B" />
        <Text style={{ color: '#D97706', fontSize: 12, fontWeight: '700' }}>
          {credits === null ? t('studio.creditsUnknown') : t('studio.credits', { credits: formatCredits(credits) })}
        </Text>
      </Pressable>
    </View>
  );
}

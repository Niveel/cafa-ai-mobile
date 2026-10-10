import { Pressable, Text, View } from 'react-native';

import { useAppTheme, useI18n } from '@/hooks';

import type { ResumeStage } from '../domain/rules';
import { StudioIcon } from './StudioIcon';

const STEPS: { stage: ResumeStage[]; key: string }[] = [
  { stage: ['configuration', 'video-type'], key: 'studio.progress.videoType' },
  { stage: ['script'], key: 'studio.progress.script' },
  { stage: ['characters'], key: 'studio.progress.characters' },
  { stage: ['scenes'], key: 'studio.progress.scenes' },
  { stage: ['editor'], key: 'studio.progress.editor' },
  { stage: ['export'], key: 'studio.progress.export' },
];

/**
 * Auto-flow progress: six numbered steps 01 to 06. Current is purple, finished are green, upcoming are muted.
 * Configuration lives under step 01 (there is no seventh step).
 */
export function StudioProgress({ stage, onSelect }: { stage: ResumeStage; onSelect?: (stage: ResumeStage) => void }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const current = Math.max(
    0,
    STEPS.findIndex((s) => s.stage.includes(stage)),
  );

  return (
    <View
      accessible={!onSelect}
      accessibilityLabel={t('studio.progress.a11y', { step: String(current + 1), total: String(STEPS.length), name: t(STEPS[current].key) })}
      style={{ flexDirection: 'row', marginBottom: 14, gap: 4 }}
    >
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const tone = done ? '#16A34A' : active ? '#9333EA' : colors.textSecondary;
        // Finished steps are tappable so users can jump back without pressing Back repeatedly.
        const jump = done && onSelect ? () => onSelect(step.stage[0]) : undefined;
        return (
          <Pressable
            key={step.key}
            disabled={!jump}
            onPress={jump}
            accessibilityRole={jump ? 'button' : undefined}
            accessibilityLabel={jump ? t('studio.progress.goTo', { name: t(step.key) }) : undefined}
            style={{ flex: 1, alignItems: 'center', minHeight: 44 }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: done || active ? tone : 'transparent',
                borderWidth: 1,
                borderColor: tone,
              }}
            >
              {done ? (
                <StudioIcon name="check" size={14} color="#FFFFFF" />
              ) : (
                <Text style={{ color: active ? '#FFFFFF' : tone, fontSize: 10, fontWeight: '700' }}>{`0${i + 1}`}</Text>
              )}
            </View>
            <Text numberOfLines={1} style={{ color: active ? colors.textPrimary : tone, fontSize: 9, marginTop: 3, fontWeight: active ? '700' : '500' }}>
              {t(step.key)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { useAppTheme, useI18n } from '@/hooks';

import { movieStudioApi } from '../data/api';
import { configToForm, isConfigComplete, mergeConfig, schemaFor } from '../domain/configSchemas';
import { formatDuration } from '../domain/rules';
import type { Project } from '../domain/types';
import { StudioButton } from './StudioButton';
import { StudioSelect } from './StudioSelect';
import { useStudioPalette } from '../theme';

type Props = { project: Project; onSaved: (project: Project) => void; onBack: () => void; onDirtyChange?: (dirty: boolean) => void };

export function ConfigurationStage({ project, onSaved, onBack, onDirtyChange }: Props) {
  const { colors } = useAppTheme();
  const P = useStudioPalette();
  const { t } = useI18n();
  const surface = P.surface;
  const fields = schemaFor(project.videoType);
  const [form, setForm] = useState(() => configToForm(project.videoType, project.config));
  const initial = useRef(JSON.stringify(configToForm(project.videoType, project.config)));
  const edited = JSON.stringify(form) !== initial.current;
  useEffect(() => {
    onDirtyChange?.(edited);
    return () => onDirtyChange?.(false);
  }, [edited, onDirtyChange]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = isConfigComplete(project.videoType, form);

  const save = async () => {
    if (!complete || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await movieStudioApi.patchProject(project.id, { config: mergeConfig(project.config, form) });
      await movieStudioApi.setWizardStep(project.id, 'script');
      onSaved({ ...updated, currentStep: 'script' });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('studio.config.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>{t('studio.config.title')}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 16 }}>
        {t('studio.config.subtitle')}
      </Text>

      {fields.map((field) => (
        <View key={field.key} style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{field.label}</Text>
          {field.kind === 'select' || field.kind === 'duration' ? (
            <StudioSelect
              label={field.label}
              value={form[field.key]}
              disabled={busy}
              options={(field.options ?? []).map((option) => ({
                value: option,
                label: field.kind === 'duration' ? formatDuration(Number(option)) : option,
              }))}
              onChange={(value) => setForm((f) => ({ ...f, [field.key]: value }))}
            />
          ) : (
            <TextInput
              value={form[field.key]}
              onChangeText={(v) => setForm((f) => ({ ...f, [field.key]: v }))}
              editable={!busy}
              multiline={field.kind === 'textarea'}
              textAlignVertical={field.kind === 'textarea' ? 'top' : 'center'}
              placeholderTextColor={colors.textSecondary}
              className="rounded-xl border px-3"
              style={{
                borderColor: P.border,
                color: colors.textPrimary,
                backgroundColor: surface,
                minHeight: field.kind === 'textarea' ? 96 : 44,
                paddingVertical: field.kind === 'textarea' ? 10 : 0,
              }}
            />
          )}
        </View>
      ))}

      {error ? <Text style={{ color: '#EF4444', fontSize: 12, marginBottom: 10 }}>{error}</Text> : null}
      {!complete ? <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10 }}>{t('studio.config.helper')}</Text> : null}
      <View className="flex-row flex-wrap items-center" style={{ gap: 10 }}>
        <StudioButton label={t('studio.common.back')} icon="arrow-left" variant="outline" disabled={busy} onPress={onBack} />
        <StudioButton
          label={t('studio.config.save')}
          icon="arrow-right"
          iconAfter
          loading={busy}
          loadingLabel={t('studio.common.saving')}
          disabled={!complete}
          onPress={() => void save()}
        />
      </View>
    </ScrollView>
  );
}

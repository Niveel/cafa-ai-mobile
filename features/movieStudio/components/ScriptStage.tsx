import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AppPromptModal } from '@/components';
import { StreamingMarkdown } from '@/components/chat/StreamingMarkdown';
import { useAppTheme, useI18n } from '@/hooks';

import { movieStudioApi } from '../data/api';
import { appendLocalScriptVersion, readLocalScriptVersions, type LocalScriptVersion } from '../data/localScripts';
import { StudioError } from '../domain/errors';
import {
  buildScriptPayload,
  canContinueToCharacters,
  canGenerateScriptFor,
  canSaveScript,
  readingMinutes,
  wordCount,
} from '../domain/rules';
import type { Project, Script } from '../domain/types';
import { useLatest } from '../hooks/useLatest';
import { StudioButton } from './StudioButton';
import { StudioIcon } from './StudioIcon';
import { ICON, useStudioPalette } from '../theme';

type Busy = 'load' | 'generate' | 'save' | 'refine' | 'continue' | null;
type Props = {
  project: Project;
  mode: 'auto' | 'manual';
  onBack: () => void;
  onContinue: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};


const messageOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export function ScriptStage({ project, mode, onBack, onContinue, onDirtyChange }: Props) {
  const { colors } = useAppTheme();
  const P = useStudioPalette();
  const { t } = useI18n();
  const tRef = useLatest(t);
  const surface = P.surface;

  const [script, setScript] = useState<Script | null>(null);
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState('');
  const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState<Busy>('load');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [showRefine, setShowRefine] = useState(false);
  // Generated scripts come back as markdown (headings, tables); Preview shows them formatted, Edit shows the raw text.
  const [preview, setPreview] = useState(false);
  const [versions, setVersions] = useState<LocalScriptVersion[]>([]);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000); // auto-hides after 3 s
  };
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const apply = (s: Script, isFresh: boolean) => {
    setScript(s);
    setContent(s.content);
    setSaved(s.content);
    setFresh(isFresh);
    // Generated scripts are markdown: open them formatted. Edit is one tap away and typed scripts stay in the editor.
    setPreview(/\*\*|<br\s*\/?>|<\/?center>|^#{1,6}\s/m.test(s.content));
  };

  const load = useCallback(async () => {
    setBusy('load');
    setError(null);
    try {
      const [s, local] = await Promise.all([movieStudioApi.getScript(project.id), readLocalScriptVersions(project.id)]);
      if (s) apply(s, false);
      setVersions(local);
    } catch (e) {
      setError(messageOf(e, tRef.current('studio.script.loadFailed')));
    } finally {
      setBusy(null);
    }
  }, [project.id, tRef]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = script !== null && content !== saved;
  const unsaved = content !== saved;
  useEffect(() => {
    onDirtyChange?.(unsaved);
    return () => onDirtyChange?.(false);
  }, [unsaved, onDirtyChange]);

  // Manual projects start with no script; try the save anyway so it works as soon as the backend allows it.
  const canSave = canSaveScript({ hasScript: script !== null || mode === 'manual', content, saved, freshlyGenerated: fresh });
  const canGenerate = mode === 'auto' && canGenerateScriptFor(project.videoType);
  const working = busy !== null;

  const save = async (): Promise<boolean> => {
    setBusy('save');
    setError(null);
    try {
      const s = await movieStudioApi.saveScript(project.id, content);
      apply(s, false);
      setVersions(await appendLocalScriptVersion(project.id, s.content));
      flash(mode === 'manual' ? t('studio.desk.saved') : t('studio.script.saved'));
      return true;
    } catch (e) {
      const noScriptYet = script === null && e instanceof StudioError && e.httpStatus === 404;
      setError(noScriptYet ? t('studio.script.manualUnavailable') : messageOf(e, t('studio.script.saveFailed')));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    setConfirmRegen(false);
    setError(null);
    setNotice(null);
    try {
      if (dirty) {
        setBusy('save');
        await movieStudioApi.saveScript(project.id, content); // save the user's edits before replacing them
      }
      setBusy('generate');
      apply(await movieStudioApi.generateScript(project.id, buildScriptPayload(project.videoType ?? 'custom_video', project.config)), true);
    } catch (e) {
      setError(messageOf(e, t('studio.script.generateFailed')));
    } finally {
      setBusy(null);
    }
  };

  const requestGenerate = () => (script && script.content.trim() ? setConfirmRegen(true) : void generate());

  const refine = async () => {
    if (!instructions.trim() || !content.trim()) return;
    setBusy('refine');
    setError(null);
    setNotice(null);
    try {
      const next = await movieStudioApi.refineScript(project.id, content, instructions.trim());
      if (next === null) throw new Error(t('studio.script.refineFailed'));
      setContent(next); // not saved: the user reviews first
      flash(t('studio.desk.refineReview'));
    } catch (e) {
      setError(messageOf(e, t('studio.script.refineFailed')));
    } finally {
      setBusy(null);
    }
  };

  const goNext = async () => {
    if (!canContinueToCharacters(script !== null, content)) return;
    setBusy('continue');
    setError(null);
    try {
      if (dirty || fresh) await movieStudioApi.saveScript(project.id, content);
      // Extraction appends without de-duplicating, so only run it when there are no characters yet.
      const existing = await movieStudioApi.listCharacters(project.id);
      if (existing.length === 0) await movieStudioApi.extractCharacters(project.id);
      await movieStudioApi.setWizardStep(project.id, 'characters');
      onContinue();
    } catch (e) {
      setError(messageOf(e, t('studio.script.continueFailed')));
    } finally {
      setBusy(null);
    }
  };

  const manual = mode === 'manual';
  const editor = preview ? (
    <View className="mt-3 rounded-xl border px-3 py-2" style={{ borderColor: P.border, backgroundColor: surface, minHeight: 200 }}>
      <StreamingMarkdown content={content.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?center>/gi, '')} isUser={false} onOpenLink={() => undefined} />
    </View>
  ) : (
    <View>
      <TextInput
        value={content}
        onChangeText={(v) => {
          setContent(v);
          setNotice(null);
        }}
        editable={!working}
        multiline
        textAlignVertical="top"
        placeholder={manual ? t('studio.desk.placeholder') : t('studio.script.placeholder')}
        placeholderTextColor={colors.textSecondary}
        className="mt-3 rounded-xl border px-3"
        style={{
          borderColor: P.border,
          color: colors.textPrimary,
          backgroundColor: surface,
          minHeight: manual ? 340 : 280,
          paddingVertical: 10,
          fontFamily: 'monospace',
          fontSize: 13,
          opacity: busy === 'generate' ? 0.4 : 1,
        }}
      />
      {busy === 'generate' ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{ position: 'absolute', top: 12, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <StudioIcon name="loader-circle" size={32} color={ICON} />
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{t('studio.script.generating')}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>{manual ? t('studio.desk.title') : t('studio.script.title')}</Text>
      {manual ? <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{t('studio.desk.intro')}</Text> : null}

      {busy === 'load' ? (
        <View className="mt-5 flex-row items-center" style={{ gap: 8 }}>
          <ActivityIndicator color={ICON} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('studio.script.loading')}</Text>
        </View>
      ) : null}

      {busy !== 'load' && !manual && !canGenerate ? (
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8 }}>{t('studio.script.movieBlocked')}</Text>
      ) : null}
      {busy !== 'load' && !script && !manual && canGenerate ? (
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8 }}>{t('studio.script.empty')}</Text>
      ) : null}
      {busy !== 'load' && !script && manual ? (
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>{t('studio.script.emptyManual')}</Text>
      ) : null}

      {busy !== 'load' && (script || manual) ? (
        <>
          {editor}
          <View className="mt-2 flex-row items-center justify-between">
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {manual
                ? `${t('studio.desk.words', { words: String(wordCount(content)) })} · ${t('studio.desk.minutes', { minutes: String(readingMinutes(content)) })}`
                : t('studio.script.words', { words: String(wordCount(content)), minutes: String(readingMinutes(content)) })}
            </Text>
            {dirty ? <Text style={{ color: '#D97706', fontSize: 12, fontWeight: '600' }}>{t('studio.script.unsaved')}</Text> : null}
          </View>
        </>
      ) : null}

      {error ? (
        <View className="mt-3 flex-row" style={{ gap: 6 }} accessibilityLiveRegion="assertive">
          <View style={{ marginTop: 2 }}>
            <StudioIcon name="triangle-alert" size={16} color="#EF4444" />
          </View>
          <Text style={{ color: '#EF4444', fontSize: 12, flex: 1 }}>{error}</Text>
        </View>
      ) : null}
      {notice ? (
        <View className="mt-3 flex-row items-center" style={{ gap: 6 }}>
          <StudioIcon name="circle-check" size={16} color="#16A34A" />
          <Text style={{ color: '#16A34A', fontSize: 12 }}>{notice}</Text>
        </View>
      ) : null}

      <View className="mt-4 flex-row flex-wrap" style={{ gap: 10 }}>
        {canGenerate && busy !== 'load' ? (
          <StudioButton
            label={script ? t('studio.script.regenerate') : t('studio.script.generate')}
            icon="refresh-cw"
            variant={script ? 'outline' : 'solid'}
            loading={busy === 'generate'}
            loadingLabel={t('studio.script.generating')}
            disabled={working && busy !== 'generate'}
            onPress={requestGenerate}
          />
        ) : null}
        {(script || manual) && busy !== 'load' && content.trim() ? (
          <StudioButton
            label={preview ? t('studio.script.editMode') : t('studio.script.previewMode')}
            icon="file-text"
            variant="outline"
            disabled={working}
            onPress={() => setPreview((p) => !p)}
          />
        ) : null}
        {(script || manual) && busy !== 'load' ? (
          <StudioButton
            label={t('studio.script.save')}
            icon="save"
            variant="outline"
            loading={busy === 'save'}
            loadingLabel={manual ? t('studio.common.saving') : t('studio.script.saving')}
            disabled={!canSave || (working && busy !== 'save')}
            onPress={() => void save()}
          />
        ) : null}
        {manual && script ? (
          <StudioButton label={t('studio.desk.refine')} icon="wand-sparkles" variant="outline" disabled={working} onPress={() => setShowRefine((v) => !v)} />
        ) : null}
      </View>

      {manual && script && showRefine ? (
        <View className="mt-4 rounded-2xl border p-3" style={{ borderColor: P.border, backgroundColor: surface }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{t('studio.desk.refineLabel')}</Text>
          <TextInput
            value={instructions}
            onChangeText={setInstructions}
            editable={!working}
            multiline
            placeholder={t('studio.script.refinePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            className="mt-2 rounded-xl border px-3"
            style={{ borderColor: P.border, color: colors.textPrimary, minHeight: 64, paddingVertical: 8 }}
          />
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>{t('studio.script.refineHint')}</Text>
          <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
            <StudioButton
              label={t('studio.desk.refineApply')}
              icon="sparkles"
              loading={busy === 'refine'}
              loadingLabel={t('studio.desk.refining')}
              disabled={!instructions.trim() || !content.trim() || (working && busy !== 'refine')}
              onPress={() => void refine()}
            />
          </View>
        </View>
      ) : null}

      {manual ? (
        <View className="mt-5 rounded-2xl border p-3" style={{ borderColor: P.border, backgroundColor: surface }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 6 }}>{t('studio.desk.tipsTitle')}</Text>
          {(['studio.desk.tip1', 'studio.desk.tip2', 'studio.desk.tip3'] as const).map((key) => (
            <Text key={key} style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>{`• ${t(key)}`}</Text>
          ))}
        </View>
      ) : (
        <View className="mt-5 rounded-2xl border p-3" style={{ borderColor: P.border, backgroundColor: surface }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{t('studio.script.localTitle')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 6 }}>{t('studio.script.localHint')}</Text>
          {versions.length === 0 ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('studio.script.localEmpty')}</Text>
          ) : (
            versions.map((v, i) => (
              <Pressable
                key={v.savedAt}
                disabled={working}
                onPress={() => {
                  setContent(v.content);
                  setNotice(null);
                }}
                accessibilityRole="button"
                style={{ minHeight: 40, justifyContent: 'center' }}
              >
                <Text style={{ color: P.accentText, fontSize: 12, fontWeight: '600' }}>
                  {t('studio.script.localItem', { number: String(versions.length - i), date: new Date(v.savedAt).toLocaleString() })}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      )}

      {!manual ? (
        <View className="mt-6 flex-row flex-wrap items-center" style={{ gap: 10 }}>
          <StudioButton label={t('studio.common.back')} icon="arrow-left" variant="outline" disabled={working} onPress={onBack} />
          <StudioButton
            label={t('studio.script.continue')}
            icon="arrow-right"
            iconAfter
            loading={busy === 'continue'}
            loadingLabel={t('studio.common.saving')}
            disabled={!canContinueToCharacters(script !== null, content) || (working && busy !== 'continue')}
            onPress={() => void goNext()}
          />
        </View>
      ) : null}

      <AppPromptModal
        visible={confirmRegen}
        icon={<StudioIcon name="refresh-cw" size={20} color={ICON} />}
        iconBackground={`${P.accent}55`}
        title={t('studio.script.regenConfirmTitle')}
        message={t('studio.script.regenConfirmMessage')}
        confirmLabel={t('studio.script.regenConfirm')}
        cancelLabel={t('studio.common.cancel')}
        onConfirm={() => void generate()}
        onCancel={() => setConfirmRegen(false)}
        onDismiss={() => setConfirmRegen(false)}
      />
    </ScrollView>
  );
}

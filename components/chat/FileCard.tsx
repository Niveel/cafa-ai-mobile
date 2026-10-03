import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useAppTheme, useI18n } from '@/hooks';
import { getAccessToken } from '@/services/storage/session';
import {
  downloadAndSaveFile,
  extensionOf,
  FILE_KIND_LABEL,
  forgetSavedFile,
  formatFileSize,
  hapticError,
  hapticSelection,
  hapticSuccess,
  identityFromExtension,
  identityFromMime,
  openDownloadsCafaFolder,
  openSavedFile,
  savedFileStillExists,
  useSavedFile,
  type FileKind,
} from '@/utils';
import { FileTypeIcon } from './FileTypeIcon';

type FileCardProps = {
  /** Full, already-resolved URL of the file. */
  url: string;
  /** File name if the backend gave one; the real type is detected on download. */
  name?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  /** Used to name the file when the backend gave no (or a generic) name, e.g. the document title. */
  titleHint?: string | null;
  /** Format from the tool call ("pdf", "docx"...) for when the file has no name or MIME type yet. */
  formatHint?: string | null;
  /** Overrides the key the saved copy is remembered under (defaults to the URL). */
  registryKey?: string;
  /** Needed for files served behind the API's auth. Defaults to the signed-in token. */
  authenticated?: boolean;
  onStateChange?: (state: 'idle' | 'saving' | 'saved' | 'error') => void;
};

/**
 * A file chip in the style of ChatGPT/Gemini: a real file-type icon, the name,
 * the type and size, and one action. Tap to save; once saved the chip says
 * "Open" and opens the file in whatever app the user has for that type.
 */
export function FileCard({
  url,
  name,
  mimeType,
  sizeBytes,
  titleHint,
  formatHint,
  registryKey,
  authenticated = true,
  onStateChange,
}: FileCardProps) {
  const { colors, isDark } = useAppTheme();
  const { t } = useI18n();
  const key = registryKey ?? url;
  const saved = useSavedFile(key);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'error' | 'noViewer'>('idle');

  // Best available answer, most reliable first. The live chat message knows the
  // name/type, but a copy re-read from the server often does not, so the file's
  // own URL and the tool call's format are used too, and a known icon is never
  // downgraded back to the generic one.
  const urlPath = (url.split('?')[0] ?? '').split('#')[0];
  const computedKind: FileKind =
    saved?.kind
    ?? identityFromExtension(extensionOf(name))?.kind
    ?? identityFromMime(mimeType)?.kind
    ?? identityFromExtension(extensionOf(urlPath))?.kind
    ?? identityFromExtension((formatHint ?? '').toLowerCase())?.kind
    ?? identityFromExtension(extensionOf(titleHint))?.kind
    ?? 'other';
  const [stickyKind, setStickyKind] = useState<FileKind>(computedKind);
  useEffect(() => {
    if (computedKind !== 'other') setStickyKind(computedKind);
  }, [computedKind]);

  const hintedKind: FileKind = computedKind !== 'other' ? computedKind : stickyKind;
  // A placeholder such as "Cafa AI pdf" or "cafa-ai-file-123.bin" is not a real name: prefer the title.
  const rawName = (saved?.fileName ?? name?.trim()) || '';
  const isPlaceholderName = /^cafa[\s_-]*(?:ai)?[\s_-]*(?:file|download|pdf|document|docx?|pptx?)?[\s_-]*\d*(?:\.[a-z0-9]{1,5})?$/i.test(rawName);
  const titleWithExtension = titleHint?.trim()
    ? `${titleHint.trim()}${extensionOf(rawName) && extensionOf(rawName) !== 'bin' ? `.${extensionOf(rawName)}` : ''}`
    : '';
  const displayName = (isPlaceholderName && titleWithExtension ? titleWithExtension : rawName || titleHint?.trim()) || t('file.defaultName');
  const sizeLabel = formatFileSize(sizeBytes);
  const typeLabel = hintedKind === 'other' && !saved ? '' : FILE_KIND_LABEL[hintedKind];

  const setState = useCallback(
    (next: 'idle' | 'saving' | 'error' | 'noViewer', reported: 'idle' | 'saving' | 'saved' | 'error') => {
      setPhase(next);
      onStateChange?.(reported);
    },
    [onStateChange],
  );

  const save = useCallback(async () => {
    setState('saving', 'saving');
    hapticSelection();
    try {
      const token = authenticated ? await getAccessToken() : null;
      await downloadAndSaveFile({
        url,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        fileName: name,
        mimeType,
        titleHint,
        registryKey: key,
      });
      hapticSuccess();
      setState('idle', 'saved');
    } catch (error) {
      console.log(`[file-card:save-error] ${error instanceof Error ? error.message : 'unknown'}`);
      hapticError();
      setState('error', 'error');
    }
  }, [authenticated, key, mimeType, name, setState, titleHint, url]);

  const open = useCallback(async () => {
    if (!saved) return;
    hapticSelection();
    if (!(await savedFileStillExists(saved.contentUri))) {
      // The user deleted or moved it: forget the old copy and save again.
      await forgetSavedFile(key);
      void save();
      return;
    }
    if (await openSavedFile(saved)) return;
    // Nothing installed can open this type: show where it is instead.
    setState('noViewer', 'saved');
    try {
      await openDownloadsCafaFolder();
    } catch {
      // the message below still tells the user where the file is
    }
  }, [key, save, saved, setState]);

  const onPress = () => {
    if (phase === 'saving') return;
    if (saved) void open();
    else void save();
  };

  const subtitle = (() => {
    if (phase === 'saving') return t('file.saving');
    if (phase === 'error') return t('file.failed');
    if (phase === 'noViewer') return t('file.noViewer');
    if (saved) return t('file.savedTo', { path: saved.displayPath.replace(/\/[^/]+$/, '') });
    return [typeLabel, sizeLabel].filter(Boolean).join(' · ') || t('file.tapToDownload');
  })();

  const accent = colors.primary;
  const action = (() => {
    if (phase === 'saving') return <ActivityIndicator size="small" color={accent} />;
    if (phase === 'error') return <Ionicons name="refresh" size={20} color={accent} />;
    if (saved) {
      return (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: `${accent}1F`,
          }}
        >
          <MaterialCommunityIcons name="open-in-new" size={15} color={accent} />
          <Text style={{ marginLeft: 6, color: accent, fontSize: 13, fontWeight: '700' }}>{t('file.open')}</Text>
        </View>
      );
    }
    return <MaterialCommunityIcons name="tray-arrow-down" size={22} color={accent} />;
  })();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={saved ? t('file.a11yOpen', { name: displayName }) : t('file.a11yDownload', { name: displayName })}
      accessibilityState={{ busy: phase === 'saving' }}
      android_ripple={{ color: `${accent}22`, borderless: false }}
      style={{
        marginTop: 6,
        marginBottom: 6,
        alignSelf: 'stretch',
        maxWidth: 420,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: isDark ? '#111111' : '#F8F8F8',
        paddingHorizontal: 12,
        paddingVertical: 10,
        overflow: 'hidden',
      }}
    >
      <FileTypeIcon kind={hintedKind} />
      <View style={{ flex: 1, minWidth: 0, marginLeft: 12, marginRight: 8 }}>
        <Text numberOfLines={1} ellipsizeMode="middle" style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
          {displayName}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            marginTop: 2,
            fontSize: 12,
            lineHeight: 16,
            color: phase === 'error' ? '#E5484D' : colors.textSecondary,
          }}
        >
          {subtitle}
        </Text>
      </View>
      <View style={{ minWidth: 36, alignItems: 'flex-end', justifyContent: 'center' }}>{action}</View>
    </Pressable>
  );
}

export default FileCard;

import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

import CafaDownloads from '@/modules/cafa-downloads';
import { headersForAssetUrl } from './assetAuth';
import { resolveFileIdentity, type FileKind } from './fileType';
import { rememberSavedFile } from './savedFiles';

const CAFA_MEDIA_ALBUM = 'Cafa AI';

let mediaLibraryModulePromise: Promise<typeof import('expo-media-library')> | null = null;

export const IOS_PHOTO_PERMISSION_DENIED_CODE = 'IOS_PHOTO_PERMISSION_DENIED';

async function getMediaLibraryModule() {
  if (!mediaLibraryModulePromise) {
    mediaLibraryModulePromise = import('expo-media-library');
  }

  try {
    return await mediaLibraryModulePromise;
  } catch {
    mediaLibraryModulePromise = null;
    throw new Error('Media library is unavailable in this build. Rebuild the app or update Expo Go.');
  }
}

function inferFileNameFromUri(localFileUri: string) {
  const raw = decodeURIComponent(localFileUri.split('?')[0] || '');
  const segment = raw.split('/').filter(Boolean).pop() || '';
  return segment.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
}

/** A file that has been saved to the device. */
export type SavedFile = {
  /** content:// URI (Android) so the file can be reopened; null if it was only shared. */
  contentUri: string | null;
  fileName: string;
  mimeType: string;
  kind: FileKind;
  /** Where it ended up, e.g. "Downloads/Cafa AI/Report.pdf". */
  displayPath: string;
  /** True when it was saved to a folder; false when the share sheet was used. */
  persisted: boolean;
};

async function shareLocalFile(localUri: string, mimeType: string) {
  const Sharing = await import('expo-sharing');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri, { mimeType, dialogTitle: 'Save or share file' });
    return;
  }
  throw new Error('Saving files is not available on this device.');
}

/**
 * Saves a local file to the device the way the platform expects:
 *  - Android: Gallery (images/video), Music (audio) or Downloads (everything
 *    else) through MediaStore, no permission picker, plus a tappable
 *    "Download complete" notification.
 *  - iOS (and old Android): the system share sheet ("Save to Files" etc.).
 * The real file type is detected from the content, so a document that arrives
 * as "file.bin" is still saved as a proper .pdf/.docx/...
 */
export async function saveFileToDevice(options: {
  localFileUri: string;
  fileName?: string | null;
  mimeType?: string | null;
  titleHint?: string | null;
  notify?: boolean;
}): Promise<SavedFile> {
  const identity = resolveFileIdentity({
    localUri: options.localFileUri,
    fileName: options.fileName,
    mimeType: options.mimeType,
    titleHint: options.titleHint,
  });

  if (Platform.OS === 'android' && CafaDownloads) {
    try {
      const result = await CafaDownloads.saveFile(
        options.localFileUri,
        identity.fileName,
        identity.mimeType,
        options.notify ?? true,
      );
      return {
        contentUri: result.contentUri,
        fileName: result.fileName,
        mimeType: identity.mimeType,
        kind: identity.kind,
        displayPath: result.displayPath.replace(/^Download\//, 'Downloads/'),
        persisted: true,
      };
    } catch (error) {
      const code = (error as { code?: string } | undefined)?.code;
      if (code !== 'ERR_UNSUPPORTED') throw error;
      // Android 9 and older: fall through to the share sheet.
    }
  }

  await shareLocalFile(options.localFileUri, identity.mimeType);
  return {
    contentUri: null,
    fileName: identity.fileName,
    mimeType: identity.mimeType,
    kind: identity.kind,
    displayPath: identity.fileName,
    persisted: false,
  };
}

/** Opens a saved file in an installed app. Returns false if nothing can open it. */
export async function openSavedFile(saved: { contentUri: string | null; mimeType: string }): Promise<boolean> {
  if (Platform.OS !== 'android' || !CafaDownloads || !saved.contentUri) return false;
  return CafaDownloads.openFile(saved.contentUri, saved.mimeType);
}

/** Whether a previously saved file is still on the device. */
export async function savedFileStillExists(contentUri: string | null | undefined): Promise<boolean> {
  if (Platform.OS !== 'android' || !CafaDownloads || !contentUri) return false;
  return CafaDownloads.fileExists(contentUri);
}

/**
 * Downloads a remote file to the app cache, then saves it to the device and
 * remembers where it went (so the UI can offer "Open" afterwards).
 */
export async function downloadAndSaveFile(options: {
  url: string;
  headers?: Record<string, string>;
  fileName?: string | null;
  mimeType?: string | null;
  titleHint?: string | null;
  /** Key the saved file is remembered under; defaults to the URL. */
  registryKey?: string;
  notify?: boolean;
}): Promise<SavedFile> {
  const target = new File(Paths.cache, `cafa-download-${Date.now()}.tmp`);
  try {
    if (target.exists) target.delete();
    const downloaded = await File.downloadFileAsync(options.url, target, {
      idempotent: true,
      headers: headersForAssetUrl(options.url, options.headers),
    });
    const saved = await saveFileToDevice({
      localFileUri: downloaded.uri,
      fileName: options.fileName,
      mimeType: options.mimeType,
      titleHint: options.titleHint,
      notify: options.notify,
    });
    if (saved.contentUri) {
      await rememberSavedFile(options.registryKey ?? options.url, {
        contentUri: saved.contentUri,
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        displayPath: saved.displayPath,
        kind: saved.kind,
      });
    }
    return saved;
  } finally {
    try {
      if (target.exists) target.delete();
    } catch {
      // cache cleanup is best effort
    }
  }
}

// ---------------------------------------------------------------------------
// Existing entry points. They keep their names/shapes so every screen that
// downloads (chat, Artifacts, Images, Videos, Avatar, Voice) gets the new
// behaviour without being rewritten.
// ---------------------------------------------------------------------------

export async function saveMediaToCafaAlbum(localFileUri: string) {
  if (Platform.OS === 'android') {
    await saveFileToDevice({ localFileUri, fileName: inferFileNameFromUri(localFileUri) });
    return;
  }

  const MediaLibrary = await getMediaLibraryModule();
  let permission = await MediaLibrary.getPermissionsAsync();
  if (!permission.granted) {
    permission = await MediaLibrary.requestPermissionsAsync();
  }
  if (!permission.granted) {
    const permissionError = new Error('Please allow photo library access to save media from Settings.');
    (permissionError as Error & { code?: string }).code = IOS_PHOTO_PERMISSION_DENIED_CODE;
    throw permissionError;
  }

  const asset = await MediaLibrary.createAssetAsync(localFileUri);
  const existingAlbum = await MediaLibrary.getAlbumAsync(CAFA_MEDIA_ALBUM);
  try {
    if (existingAlbum) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
    } else {
      await MediaLibrary.createAlbumAsync(CAFA_MEDIA_ALBUM, asset, false);
    }
  } catch {
    // Asset is already in Photos once createAssetAsync succeeds.
    // Album assignment can fail on some iOS devices even when the save itself worked.
  }
}

export async function saveFileToDownloadsCafaFolder(options: {
  localFileUri: string;
  fileName: string;
  mimeType: string;
}) {
  const saved = await saveFileToDevice({
    localFileUri: options.localFileUri,
    fileName: options.fileName,
    mimeType: options.mimeType,
  });
  const folder = saved.displayPath.includes('/')
    ? saved.displayPath.slice(0, saved.displayPath.lastIndexOf('/'))
    : saved.displayPath;
  return {
    safFileUri: saved.contentUri ?? '',
    folderUri: folder,
    readableFolderPath: folder,
    readableFilePath: saved.displayPath,
    saved,
  };
}

/** Opens the system Downloads screen (Android). */
export async function openDownloadsCafaFolder() {
  if (Platform.OS !== 'android' || !CafaDownloads) {
    throw new Error('Opening the downloads folder is available on Android only.');
  }
  if (!CafaDownloads.openDownloadsFolder()) {
    throw new Error('Could not open the downloads folder.');
  }
}

/** Kept for the Settings button: there is no folder to pick any more, so it opens Downloads. */
export async function changeDownloadsFolder() {
  await openDownloadsCafaFolder();
}

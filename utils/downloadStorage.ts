import { Platform } from 'react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';

import { clearDownloadsSafUri, getDownloadsSafUri, setDownloadsSafUri } from '@/services/storage';

const CAFA_MEDIA_ALBUM = 'Cafa AI';
const CAFA_DOWNLOADS_FOLDER = 'Cafa AI';

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

function sanitizeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || `cafa-${Date.now()}`;
}

function splitNameAndExtension(name: string) {
  const safe = sanitizeFileName(name);
  const match = safe.match(/^(.*)\.([^.]+)$/);
  if (!match) return { baseName: safe, extension: null };
  return { baseName: match[1], extension: match[2] };
}

function inferFileNameFromUri(localFileUri: string) {
  const raw = decodeURIComponent(localFileUri.split('?')[0] || '');
  const segment = raw.split('/').filter(Boolean).pop() || `cafa-${Date.now()}`;
  return sanitizeFileName(segment);
}

function inferMimeTypeFromFileName(fileName: string) {
  const ext = splitNameAndExtension(fileName).extension?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'm4v':
      return 'video/x-m4v';
    case 'webm':
      return 'video/webm';
    default:
      return 'application/octet-stream';
  }
}

export async function saveMediaToCafaAlbum(localFileUri: string) {
  if (Platform.OS === 'android') {
    const fileName = inferFileNameFromUri(localFileUri);
    const mimeType = inferMimeTypeFromFileName(fileName);
    await saveFileToDownloadsCafaFolder({
      localFileUri,
      fileName,
      mimeType,
    });
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

async function resolveCafaDownloadsFolderUri() {
  if (Platform.OS !== 'android') {
    throw new Error('Downloads folder save is available on Android only.');
  }

  const { StorageAccessFramework } = LegacyFileSystem;
  const rootDownloadsUri = StorageAccessFramework.getUriForDirectoryInRoot('Download');

  const cached = await getDownloadsSafUri();
  if (cached) {
    try {
      await StorageAccessFramework.readDirectoryAsync(cached);
      return cached;
    } catch {
      await clearDownloadsSafUri();
    }
  }

  const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync(rootDownloadsUri);
  if (!permission.granted || !permission.directoryUri) {
    throw new Error('Downloads folder permission is required to save ZIP files.');
  }

  let downloadsUri = permission.directoryUri;
  const children = await StorageAccessFramework.readDirectoryAsync(downloadsUri);
  const existing = children.find((uri) => decodeURIComponent(uri).endsWith(`/${CAFA_DOWNLOADS_FOLDER}`));
  if (existing) {
    downloadsUri = existing;
  } else {
    downloadsUri = await StorageAccessFramework.makeDirectoryAsync(downloadsUri, CAFA_DOWNLOADS_FOLDER);
  }

  await setDownloadsSafUri(downloadsUri);
  return downloadsUri;
}

export async function saveFileToDownloadsCafaFolder(options: {
  localFileUri: string;
  fileName: string;
  mimeType: string;
}) {
  if (Platform.OS !== 'android') {
    throw new Error('Downloads folder save is available on Android only.');
  }

  const { StorageAccessFramework, EncodingType } = LegacyFileSystem;
  const folderUri = await resolveCafaDownloadsFolderUri();
  const safeFileName = sanitizeFileName(options.fileName);
  const mime = options.mimeType || 'application/octet-stream';
  const createdFileUri = await StorageAccessFramework.createFileAsync(folderUri, safeFileName, mime);
  const base64 = await LegacyFileSystem.readAsStringAsync(options.localFileUri, {
    encoding: EncodingType.Base64,
  });
  await StorageAccessFramework.writeAsStringAsync(createdFileUri, base64, {
    encoding: EncodingType.Base64,
  });

  return {
    safFileUri: createdFileUri,
    folderUri,
    readableFolderPath: '/Internal storage/Download/Cafa AI',
    readableFilePath: `/Internal storage/Download/Cafa AI/${safeFileName}`,
  };
}

export async function openDownloadsCafaFolder() {
  const folderUri = await resolveCafaDownloadsFolderUri();
  return folderUri;
}

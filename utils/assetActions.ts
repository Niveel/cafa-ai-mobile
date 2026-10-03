import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';

import CafaDownloads from '@/modules/cafa-downloads';
import { headersForAssetUrl } from './assetAuth';
import { resolveFileIdentity } from './fileType';

/**
 * Copy / share the ASSET itself (the image, video or document), not text about
 * it. This is what ChatGPT and Gemini do: copying a generated image puts the
 * image on the clipboard; a file can be pasted or sent on as a file.
 */
export type CopiedAsset = 'image' | 'file' | 'shared';

type AssetOptions = {
  url: string;
  headers?: Record<string, string>;
  fileName?: string | null;
  mimeType?: string | null;
  titleHint?: string | null;
};

async function prepareAssetFile(options: AssetOptions) {
  const directory = new Directory(Paths.cache, 'cafa-assets');
  if (directory.exists) {
    try {
      directory.delete();
    } catch {
      // stale files from an earlier copy; not important
    }
  }
  directory.create({ intermediates: true, idempotent: true });

  const downloaded = await File.downloadFileAsync(options.url, new File(directory, `download-${Date.now()}.tmp`), {
    idempotent: true,
    headers: headersForAssetUrl(options.url, options.headers),
  });
  const identity = resolveFileIdentity({
    localUri: downloaded.uri,
    fileName: options.fileName,
    mimeType: options.mimeType,
    titleHint: options.titleHint,
  });
  // A proper name, so the file keeps it when pasted or shared.
  const named = new File(directory, identity.fileName);
  if (named.exists) named.delete();
  downloaded.copy(named);
  try {
    downloaded.delete();
  } catch {
    // temp file cleanup is best effort
  }
  return { file: named, identity };
}

async function shareFileViaSheet(file: File, mimeType: string) {
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Send file' });
}

export async function copyAssetToClipboard(options: AssetOptions): Promise<CopiedAsset> {
  const { file, identity } = await prepareAssetFile(options);

  if (identity.kind === 'image') {
    await Clipboard.setImageAsync(await file.base64());
    return 'image';
  }

  if (Platform.OS === 'android' && CafaDownloads) {
    const contentUri = await LegacyFileSystem.getContentUriAsync(file.uri);
    await CafaDownloads.copyFileToClipboard(contentUri, identity.fileName);
    return 'file';
  }

  // Platforms that cannot hold a file on the clipboard: hand it to the share sheet.
  await shareFileViaSheet(file, identity.mimeType);
  return 'shared';
}

/** Sends the file itself (not its text) through the system share sheet. */
export async function shareAssetFile(options: AssetOptions): Promise<void> {
  const { file, identity } = await prepareAssetFile(options);
  await shareFileViaSheet(file, identity.mimeType);
}

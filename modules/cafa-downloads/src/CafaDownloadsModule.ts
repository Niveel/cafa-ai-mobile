import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { SavedFileResult } from './CafaDownloads.types';

declare class CafaDownloadsModule extends NativeModule {
  /**
   * Copies a local file into shared storage (Gallery / Downloads) and, when
   * `notify` is true, posts a tappable "Download complete" notification.
   */
  saveFile(sourceUri: string, fileName: string, mimeType: string, notify: boolean): Promise<SavedFileResult>;
  /** Opens a saved file in the app the user picks. Resolves false if nothing can open it. */
  openFile(contentUri: string, mimeType: string): Promise<boolean>;
  /** Whether a previously saved file is still there (the user may have deleted it). */
  fileExists(contentUri: string): Promise<boolean>;
  /** Copies a file (by content:// URI) to the system clipboard so it can be pasted as a file. */
  copyFileToClipboard(contentUri: string, label: string): Promise<boolean>;
  /** Opens the system Downloads screen. */
  openDownloadsFolder(): boolean;
}

// Android only; undefined on iOS and in Expo Go.
export default requireOptionalNativeModule<CafaDownloadsModule>('CafaDownloads');

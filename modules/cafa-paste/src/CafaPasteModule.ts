import { NativeModule, requireOptionalNativeModule } from 'expo';

export type PastedItem = {
  /** file:// URI of a copy in the app cache. */
  uri: string;
  fileName: string;
  mimeType: string;
};

type CafaPasteEvents = {
  onPaste: (event: { items: PastedItem[] }) => void;
};

declare class CafaPasteModule extends NativeModule<CafaPasteEvents> {
  /** Makes the text box with this view tag accept pasted images and files. */
  enablePaste(viewTag: number): Promise<boolean>;
}

// Android only; undefined on iOS and in Expo Go.
export default requireOptionalNativeModule<CafaPasteModule>('CafaPaste');

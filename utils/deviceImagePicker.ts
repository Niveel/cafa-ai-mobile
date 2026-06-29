import { Platform } from 'react-native';
import * as ExpoImagePicker from 'expo-image-picker';

type ImagePickerAsset = {
  fileName?: string | null;
  uri: string;
  mimeType?: string | null;
};

type ImagePickerPermissionResult = {
  granted: boolean;
  canAskAgain?: boolean;
};

type ImageLibraryResult = {
  canceled: boolean;
  assets?: ImagePickerAsset[];
};

export type ImagePickerLike = {
  requestMediaLibraryPermissionsAsync: () => Promise<ImagePickerPermissionResult>;
  launchImageLibraryAsync: typeof ExpoImagePicker.launchImageLibraryAsync;
};

export async function pickSingleImageFromLibrary(
  imagePicker: ImagePickerLike,
  options: {
    allowsEditing?: boolean;
    quality?: number;
    aspect?: [number, number];
  } = {},
) {
  if (Platform.OS !== 'android') {
    const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error(
        permission.canAskAgain === false
          ? 'Photo library access is disabled. Please enable Photos access for Cafa AI in Settings and try again.'
          : 'Photo library permission is required to choose an image from your device.',
      );
    }
  }

  try {
    const result = await imagePicker.launchImageLibraryAsync({
      allowsEditing: options.allowsEditing ?? false,
      quality: options.quality ?? 0.9,
      mediaTypes: ['images'] as ExpoImagePicker.MediaType[],
      ...(options.aspect ? { aspect: options.aspect } : {}),
    }) as ImageLibraryResult;

    if (result.canceled || !result.assets?.length) {
      return null;
    }

    return result.assets[0];
  } catch (error) {
    if (error instanceof Error && error.message) {
      throw error;
    }

    throw new Error('Unable to open the photo library right now. Please try again.');
  }
}

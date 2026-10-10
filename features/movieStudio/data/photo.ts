import * as ImagePicker from 'expo-image-picker';

import { uploadWidgetFile } from '@/features/chat/services/widgets';

export type StudioPhoto = { localUri: string; url: string };

/**
 * Pick a photo, crop it to 4:3 with the system cropper, and upload it through the app's public-URL upload (POST /chat/upload).
 * Movie Studio has no upload endpoint of its own yet; the URL is then sent as the character's referenceImageUrl.
 * Resolves null when the user cancels.
 */
export async function pickAndUploadStudioPhoto(): Promise<StudioPhoto | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.9,
    allowsMultipleSelection: false,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;
  const asset = picked.assets[0];
  const name = asset.fileName || `character-${Date.now()}.jpg`;
  const uploaded = await uploadWidgetFile(asset.uri, name, asset.mimeType ?? 'image/jpeg');
  return { localUri: asset.uri, url: uploaded.url };
}

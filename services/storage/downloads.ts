import AsyncStorage from '@react-native-async-storage/async-storage';

const CAFA_DOWNLOADS_SAF_URI_KEY = 'cafa_ai_downloads_saf_uri_v1';

export async function getDownloadsSafUri() {
  return AsyncStorage.getItem(CAFA_DOWNLOADS_SAF_URI_KEY);
}

export async function setDownloadsSafUri(uri: string) {
  await AsyncStorage.setItem(CAFA_DOWNLOADS_SAF_URI_KEY, uri);
}

export async function clearDownloadsSafUri() {
  await AsyncStorage.removeItem(CAFA_DOWNLOADS_SAF_URI_KEY);
}


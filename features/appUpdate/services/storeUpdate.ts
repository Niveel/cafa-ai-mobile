import { Platform } from 'react-native';
import * as Application from 'expo-application';
import VersionCheck from 'react-native-version-check';

type StoreUpdateCheckResult = {
  hasUpdate: boolean;
  latestVersion: string | null;
  storeUrl: string | null;
};

const IOS_APP_STORE_ID = '6753127753';
const IOS_STORE_URL = 'https://apps.apple.com/gh/app/cafa-ai/id6753127753';
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.shopwit.cafaai';

export async function checkStoreUpdate(): Promise<StoreUpdateCheckResult> {
  const packageName = Application.applicationId;
  const currentVersion = Application.nativeApplicationVersion;
  if (!packageName || !currentVersion) {
    return { hasUpdate: false, latestVersion: null, storeUrl: null };
  }

  try {
    const provider = Platform.OS === 'ios' ? 'appStore' : 'playStore';
    const fallbackStoreUrl = Platform.OS === 'ios' ? IOS_STORE_URL : ANDROID_STORE_URL;
    const latestVersion = await VersionCheck.getLatestVersion({
      provider,
      packageName,
      ignoreErrors: true,
    });

    if (!latestVersion) {
      return { hasUpdate: false, latestVersion: null, storeUrl: null };
    }

    const updateState = await VersionCheck.needUpdate({
      currentVersion,
      latestVersion,
      provider,
      packageName,
      ...(Platform.OS === 'ios' ? { appID: IOS_APP_STORE_ID } : {}),
      ignoreErrors: true,
    });

    if (!updateState?.isNeeded) {
      return { hasUpdate: false, latestVersion, storeUrl: null };
    }

    const storeUrl = updateState.storeUrl
      || await VersionCheck.getStoreUrl({
        packageName,
        ignoreErrors: true,
        provider,
        ...(Platform.OS === 'ios' ? { appID: IOS_APP_STORE_ID } : {}),
      });

    return {
      hasUpdate: true,
      latestVersion,
      storeUrl: storeUrl ?? fallbackStoreUrl,
    };
  } catch {
    return { hasUpdate: false, latestVersion: null, storeUrl: null };
  }
}

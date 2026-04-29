import { Platform } from 'react-native';
import * as Application from 'expo-application';
import VersionCheck from 'react-native-version-check';

type StoreUpdateCheckResult = {
  hasUpdate: boolean;
  latestVersion: string | null;
  storeUrl: string | null;
};

export async function checkStoreUpdate(): Promise<StoreUpdateCheckResult> {
  const packageName = Application.applicationId;
  const currentVersion = Application.nativeApplicationVersion;
  if (!packageName || !currentVersion) {
    return { hasUpdate: false, latestVersion: null, storeUrl: null };
  }

  try {
    const provider = Platform.OS === 'ios' ? 'appStore' : 'playStore';
    const latestVersion = await VersionCheck.getLatestVersion({
      provider,
      packageName,
      ignoreErrors: true,
    });

    if (!latestVersion) {
      return { hasUpdate: false, latestVersion: null, storeUrl: null };
    }

    const updateState = VersionCheck.needUpdate({
      currentVersion,
      latestVersion,
    });

    if (!updateState?.isNeeded) {
      return { hasUpdate: false, latestVersion, storeUrl: null };
    }

    const storeUrl = await VersionCheck.getStoreUrl({
      packageName,
      ignoreErrors: true,
      provider,
    });

    return {
      hasUpdate: true,
      latestVersion,
      storeUrl: storeUrl ?? null,
    };
  } catch {
    return { hasUpdate: false, latestVersion: null, storeUrl: null };
  }
}


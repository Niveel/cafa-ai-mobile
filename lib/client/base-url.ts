import Constants from 'expo-constants';

export const PROD_BASE_URL = 'https://cafaapi.niveel.com/api/v1';

function getExpoHost() {
  const expoConfigHostUri = (Constants.expoConfig as { hostUri?: string } | null)?.hostUri;
  const manifest2HostUri = (Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
    .manifest2?.extra?.expoClient?.hostUri;
  const legacyDebuggerHost = (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
  const rawHostUri = expoConfigHostUri ?? manifest2HostUri ?? legacyDebuggerHost ?? '';
  return rawHostUri.split(':')[0] ?? '';
}

const detectedHost = getExpoHost();
const FALLBACK_DEV_HOST = '10.20.254.23';

export const DEV_BASE_URL = `http://${detectedHost || FALLBACK_DEV_HOST}:5000/api/v1`;

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? DEV_BASE_URL;

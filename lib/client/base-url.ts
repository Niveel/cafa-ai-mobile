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
const FALLBACK_DEV_HOST = '10.233.113.23';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const EXPO_TUNNEL_HOST_SUFFIXES = ['.exp.direct', '.exp.host', '.expo.dev'];

function isExpoTunnelHost(host: string) {
  return EXPO_TUNNEL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

const shouldIgnoreDetectedHost =
  !detectedHost
  || LOOPBACK_HOSTS.has(detectedHost)
  || isExpoTunnelHost(detectedHost);

const resolvedHost = shouldIgnoreDetectedHost ? '' : detectedHost;

function normalizeConfiguredDevBaseUrl(value: string | undefined) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
}

const configuredDevBaseUrl = normalizeConfiguredDevBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

export const DEV_BASE_URL = configuredDevBaseUrl || `http://${resolvedHost || FALLBACK_DEV_HOST}:5000/api/v1`;

export const API_BASE_URL = __DEV__ ? DEV_BASE_URL : PROD_BASE_URL;

export const PROD_BASE_URL = 'https://cafaapi.niveel.com/api/v1';
const HARDCODED_DEV_BASE_URL = 'https://cafaapi.niveel.com/api/v1';
// const HARDCODED_DEV_BASE_URL = 'http://10.241.225.23:5000/api/v1';

// Prefer env override; otherwise resolve from Expo host or fallback LAN host.
export const DEV_BASE_URL = HARDCODED_DEV_BASE_URL;

// export const API_BASE_URL = __DEV__ ? DEV_BASE_URL : PROD_BASE_URL;
export const API_BASE_URL = __DEV__ ? DEV_BASE_URL : PROD_BASE_URL;

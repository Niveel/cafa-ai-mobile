export const PROD_BASE_URL = 'https://cafaapi.niveel.com/api/v1';
export const DEV_BASE_URL = 'http://10.172.64.23:5000/api/v1';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? DEV_BASE_URL;

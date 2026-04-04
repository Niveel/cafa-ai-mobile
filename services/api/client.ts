import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:5000',
  timeout: 20_000,
  headers: {
    Accept: 'application/json',
  },
  withCredentials: true,
});

import axios from 'axios';

import { API_BASE_URL } from './base-url';

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  headers: {
    Accept: 'application/json',
  },
  withCredentials: true,
});

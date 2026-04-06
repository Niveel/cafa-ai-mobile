export type ApiErrorPayload = {
  success?: false;
  error?: string;
  code?: string;
  message?: string;
  errors?: Array<{ field?: string; msg?: string }>;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

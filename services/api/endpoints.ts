export const API_BASE_PATH = '';

export const apiEndpoints = {
  health: `${API_BASE_PATH}/health`,

  auth: {
    register: `${API_BASE_PATH}/auth/register`,
    login: `${API_BASE_PATH}/auth/login`,
    verifyOtp: `${API_BASE_PATH}/auth/verify-otp`,
    resendOtp: `${API_BASE_PATH}/auth/resend-otp`,
    refreshToken: `${API_BASE_PATH}/auth/refresh-token`,
    logout: `${API_BASE_PATH}/auth/logout`,
    me: `${API_BASE_PATH}/auth/me`,
    forgotPassword: `${API_BASE_PATH}/auth/forgot-password`,
    resetPassword: `${API_BASE_PATH}/auth/reset-password`,
  },

  chat: {
    list: `${API_BASE_PATH}/chat`,
    detail: (conversationId: string) => `${API_BASE_PATH}/chat/${conversationId}`,
    messages: (conversationId: string) => `${API_BASE_PATH}/chat/${conversationId}/messages`,
    archive: (conversationId: string) => `${API_BASE_PATH}/chat/${conversationId}/archive`,
    export: (conversationId: string, format: 'markdown' | 'pdf') =>
      `${API_BASE_PATH}/chat/${conversationId}/export?format=${format}`,
  },

  images: {
    generate: `${API_BASE_PATH}/images/generate`,
    history: `${API_BASE_PATH}/images/history`,
    detail: (imageId: string) => `${API_BASE_PATH}/images/${imageId}`,
  },

  videos: {
    generate: `${API_BASE_PATH}/videos/generate`,
    job: (jobId: string) => `${API_BASE_PATH}/videos/generate/${jobId}`,
    history: `${API_BASE_PATH}/videos/history`,
    download: (videoId: string) => `${API_BASE_PATH}/videos/${videoId}/download`,
  },

  subscriptions: {
    plans: `${API_BASE_PATH}/subscriptions/plans`,
    status: `${API_BASE_PATH}/subscriptions/status`,
    checkout: `${API_BASE_PATH}/subscriptions/checkout`,
    portal: `${API_BASE_PATH}/subscriptions/portal`,
  },

  users: {
    me: `${API_BASE_PATH}/users/me`,
    usage: `${API_BASE_PATH}/users/me/usage`,
    personalization: `${API_BASE_PATH}/users/me/personalization`,
  },

  voice: {
    transcribe: `${API_BASE_PATH}/voice/transcribe`,
    synthesize: `${API_BASE_PATH}/voice/synthesize`,
    voices: `${API_BASE_PATH}/voice/voices`,
  },
};

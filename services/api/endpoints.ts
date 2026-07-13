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
    search: `${API_BASE_PATH}/chat/search`,
    detail: (conversationId: string) => `${API_BASE_PATH}/chat/${conversationId}`,
    messages: (conversationId: string) => `${API_BASE_PATH}/chat/${conversationId}/messages`,
    archive: (conversationId: string) => `${API_BASE_PATH}/chat/${conversationId}/archive`,
    export: (conversationId: string, format: 'markdown' | 'pdf') =>
      `${API_BASE_PATH}/chat/${conversationId}/export?format=${format}`,
  },

  prompts: {
    suggest: `${API_BASE_PATH}/prompts/suggest`,
  },

  images: {
    generate: `${API_BASE_PATH}/images/generate`,
    history: `${API_BASE_PATH}/images/history`,
    detail: (imageId: string) => `${API_BASE_PATH}/images/${imageId}`,
    remove: (imageId: string) => `${API_BASE_PATH}/images/${imageId}`,
    deleteBulk: `${API_BASE_PATH}/images/delete-bulk`,
    download: (imageId: string) => `${API_BASE_PATH}/images/${imageId}/download`,
    downloadZip: `${API_BASE_PATH}/images/download-zip`,
    downloadZipJob: (jobId: string) => `${API_BASE_PATH}/images/download-zip/${jobId}`,
  },

  videos: {
    generate: `${API_BASE_PATH}/videos/generate`,
    fromImage: `${API_BASE_PATH}/videos/from-image`,
    job: (jobId: string) => `${API_BASE_PATH}/videos/generate/${jobId}`,
    history: `${API_BASE_PATH}/videos/history`,
    remove: (videoId: string) => `${API_BASE_PATH}/videos/${videoId}`,
    deleteBulk: `${API_BASE_PATH}/videos/delete-bulk`,
    download: (videoId: string) => `${API_BASE_PATH}/videos/${videoId}/download`,
    downloadZip: `${API_BASE_PATH}/videos/download-zip`,
    downloadZipJob: (jobId: string) => `${API_BASE_PATH}/videos/download-zip/${jobId}`,
  },

  media: {
    imageEdit: `${API_BASE_PATH}/media/image/edit`,
    imageToVideo: `${API_BASE_PATH}/media/video/image-to-video`,
    promptRewrite: `${API_BASE_PATH}/media/prompts/rewrite`,
    conversation: (screen: 'edit-image' | 'image-to-video') => `${API_BASE_PATH}/media/conversations/${screen}`,
    conversationMessages: (screen: 'edit-image' | 'image-to-video') => `${API_BASE_PATH}/media/conversations/${screen}/messages`,
  },

  artifacts: {
    list: `${API_BASE_PATH}/artifacts`,
    download: (artifactId: string) => `${API_BASE_PATH}/artifacts/${encodeURIComponent(artifactId)}/download`,
  },

  subscriptions: {
    plans: `${API_BASE_PATH}/subscriptions/plans`,
    status: `${API_BASE_PATH}/subscriptions/status`,
    sync: `${API_BASE_PATH}/subscriptions/sync`,
    checkout: `${API_BASE_PATH}/subscriptions/checkout`,
    portal: `${API_BASE_PATH}/subscriptions/portal`,
  },

  users: {
    me: `${API_BASE_PATH}/users/me`,
    avatar: `${API_BASE_PATH}/users/me/avatar`,
    password: `${API_BASE_PATH}/users/me/password`,
    usage: `${API_BASE_PATH}/users/me/usage`,
    personalization: `${API_BASE_PATH}/users/me/personalization`,
  },

  voice: {
    transcribe: `${API_BASE_PATH}/voice/transcribe`,
    synthesize: `${API_BASE_PATH}/voice/synthesize`,
    voices: `${API_BASE_PATH}/voice/voices`,
  },

  support: {
    contact: `${API_BASE_PATH}/support/contact`,
  },

  cafaLife: {
    token: `${API_BASE_PATH}/cafa-life/token`,
    history: `${API_BASE_PATH}/cafa-life/history`,
    voices: `${API_BASE_PATH}/cafa-life/voices`,
    voicePreview: `${API_BASE_PATH}/cafa-life/voice-preview`,
  },

  tts: {
    convert: `${API_BASE_PATH}/tts/convert`,
    history: `${API_BASE_PATH}/tts/history`,
    voices: `${API_BASE_PATH}/tts/voices`,
    preview: `${API_BASE_PATH}/tts/preview`,
  },

  tools: {
    detectAi: `${API_BASE_PATH}/tools/detect-ai`,
    detectAiQuota: `${API_BASE_PATH}/tools/detect-ai/quota`,
    humanize: `${API_BASE_PATH}/tools/humanize`,
    humanizeQuota: `${API_BASE_PATH}/tools/humanize/quota`,
  },

  avatar: {
    gallery: `${API_BASE_PATH}/avatar/gallery`,
    upload: `${API_BASE_PATH}/avatar/upload`,
    voices: `${API_BASE_PATH}/avatar/voices`,
    voicePreview: `${API_BASE_PATH}/avatar/voices/preview`,
    voiceClone: `${API_BASE_PATH}/avatar/voices/clone`,
    voiceClones: `${API_BASE_PATH}/avatar/voices/clones`,
    scriptGenerate: `${API_BASE_PATH}/avatar/script/generate`,
    videoGenerate: `${API_BASE_PATH}/avatar/video/generate`,
    videoStatus: (id: string) => `${API_BASE_PATH}/avatar/video/${id}/status`,
    videoCancel: (id: string) => `${API_BASE_PATH}/avatar/video/${id}/cancel`,
    videoDelete: (id: string) => `${API_BASE_PATH}/avatar/video/${id}`,
    history: `${API_BASE_PATH}/avatar/history`,
  },
};

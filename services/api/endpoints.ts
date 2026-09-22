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
    logoutAll: `${API_BASE_PATH}/auth/logout-all`,
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
    resolveProductLink: `${API_BASE_PATH}/chat/products/resolve-link`,
    deleteArtifact: (conversationId: string, messageId: string, toolCallIndex: number) =>
      `${API_BASE_PATH}/chat/${conversationId}/messages/${messageId}/tool-calls/${toolCallIndex}`,
    upload: `${API_BASE_PATH}/chat/upload`,
    suggestedPrompts: `${API_BASE_PATH}/chat/suggested-prompts`,
  },

  prompts: {
    suggest: `${API_BASE_PATH}/prompts/suggest`,
  },

  notifications: {
    list: `${API_BASE_PATH}/notifications`,
    unreadCount: `${API_BASE_PATH}/notifications/unread-count`,
    stream: `${API_BASE_PATH}/notifications/stream`,
    read: (id: string) => `${API_BASE_PATH}/notifications/${id}/read`,
    readAll: `${API_BASE_PATH}/notifications/read-all`,
    // Real, new backend addition (mobile parity, 2026-09-12) -- parallel to
    // web's VAPID-based /notifications/push-subscriptions, but keyed by an
    // opaque Expo push token instead of a {endpoint, keys} Web Push object.
    pushTokens: `${API_BASE_PATH}/notifications/push-tokens`,
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
    cancel: `${API_BASE_PATH}/subscriptions/cancel`,
    resume: `${API_BASE_PATH}/subscriptions/resume`,
    paymentMethod: `${API_BASE_PATH}/subscriptions/payment-method`,
    paymentMethodSetupIntent: `${API_BASE_PATH}/subscriptions/payment-method/setup-intent`,
    paymentMethodConfirm: `${API_BASE_PATH}/subscriptions/payment-method/confirm`,
  },

  credits: {
    status: `${API_BASE_PATH}/credits/status`,
    packs: `${API_BASE_PATH}/credits/packs`,
    topupCheckout: `${API_BASE_PATH}/credits/topup/checkout`,
    topupPaymentIntent: `${API_BASE_PATH}/credits/topup/payment-intent`,
    invoices: `${API_BASE_PATH}/credits/invoices`,
  },

  users: {
    me: `${API_BASE_PATH}/users/me`,
    avatar: `${API_BASE_PATH}/users/me/avatar`,
    password: `${API_BASE_PATH}/users/me/password`,
    usage: `${API_BASE_PATH}/users/me/usage`,
    personalization: `${API_BASE_PATH}/users/me/personalization`,
    notificationPreferences: `${API_BASE_PATH}/users/me/notification-preferences`,
  },

  voice: {
    transcribe: `${API_BASE_PATH}/voice/transcribe`,
    synthesize: `${API_BASE_PATH}/voice/synthesize`,
    synthesizeStreamToken: `${API_BASE_PATH}/voice/synthesize/token`,
    synthesizeStream: `${API_BASE_PATH}/voice/synthesize/stream`,
    voices: `${API_BASE_PATH}/voice/voices`,
  },

  support: {
    contact: `${API_BASE_PATH}/support/contact`,
    quickHelp: `${API_BASE_PATH}/support/quick-help`,
  },

  charts: {
    generate: `${API_BASE_PATH}/charts/generate`,
  },

  ads: {
    rewardEligibility: `${API_BASE_PATH}/ads/rewards/eligibility`,
    rewardSessions: `${API_BASE_PATH}/ads/rewards/sessions`,
    rewardClaim: (sessionId: string) =>
      `${API_BASE_PATH}/ads/rewards/sessions/${encodeURIComponent(sessionId)}/claim`,
  },

  cafaLife: {
    // Real fix (2026-09-14): the backend renamed this route to
    // /livekit-token on 2026-09-07 (retiring the old Python LiveKit agent
    // for the native-agent transport); this client constant was never
    // updated, so every real Cafa Life session request 404'd silently --
    // confirmed via A100 log inspection (no request ever reached the
    // authenticated route handler) and git history on cafa-life.routes.ts.
    token: `${API_BASE_PATH}/cafa-life/livekit-token`,
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
    checkLanguage: `${API_BASE_PATH}/tools/check-language`,
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

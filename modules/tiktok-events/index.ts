// Re-export the native module. On web, it will be resolved to TikTokEventsModule.web.ts
// and on native platforms to TikTokEventsModule.ts
export { default } from './src/TikTokEventsModule';
export * from './src/TikTokEvents.types';

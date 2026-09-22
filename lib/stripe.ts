// Stripe publishable keys are safe to embed client-side (they can only
// create tokens/payment methods, never charge or read data). Fall back to
// the real production key when EAS builds don't have a local .env, mirroring
// the AdMob app-id pattern in app.config.ts.
const FALLBACK_STRIPE_PUBLISHABLE_KEY =
  'pk_live_51NGOehKTzLRgNtiqwDLyZu0InMlbaWyzMW6OHrA2u8psYfZRKQUgc7j1yPf3pQRi8za5z7DD0b1eIYYTCHxzVXlw00XtpSubX9';

export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || FALLBACK_STRIPE_PUBLISHABLE_KEY;

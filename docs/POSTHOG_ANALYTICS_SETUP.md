# PostHog Analytics Setup (Expo React Native)

## 1) Environment
Add these keys to `.env`:

```env
EXPO_PUBLIC_POSTHOG_API_KEY=phc_your_project_key_here
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
EXPO_PUBLIC_POSTHOG_SESSION_REPLAY_SAMPLE_RATE=1
```

## 2) Wizard note
The PostHog wizard needs an interactive terminal. If needed, run locally:

```bash
npx -y @posthog/wizard@latest
```

If you prefer CI mode:

```bash
npx @posthog/wizard --ci --region us --api-key <YOUR_POSTHOG_KEY>
```

## 3) What is instrumented

- Screen tracking via Expo Router path changes
- App lifecycle open event
- Auth: login/signup/OTP/reset/logout/profile/avatar
- Chat: list/detail/create conversation
- Image: generation start/success/failure, history load, delete/bulk delete
- Video: generation start, image-to-video start/success, job polls, history load, delete/bulk delete
- Voice: catalog load, transcription complete, synthesis complete
- Artifacts: list page load
- Billing: subscription sync, plans load, checkout start/ready, usage load

## 4) Files

- `app/_layout.tsx` (provider + screen tracking + PostHog bridge)
- `context/AppContext.tsx` (identify/reset/app-open capture)
- `lib/analytics/posthog.ts` (safe capture helpers)
- `lib/analytics/events.ts` (central event names)
- Feature service files under `features/*/services/*`

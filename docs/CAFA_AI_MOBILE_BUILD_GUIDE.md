# Cafa AI Mobile Build Guide

This document defines how to build the mobile app as the mobile equivalent of `cafa_ai_web`.

## Goal

Build the Cafa AI mobile app with feature parity to the web product:

- AI chat with streaming responses
- Auth and session management
- Image generation and history
- Video generation and history
- Voice transcription and text-to-speech
- Subscription, limits, and billing-aware UX
- Personalization and profile settings

## Source of Truth (Web App)

Use these files in `C:\Users\Good\Desktop\Klasique_projects\cafa_ai_web` as primary references:

- `features/chat/components/ChatShell.tsx` for core experience and interaction model
- `services/api/endpoints.ts` for endpoint naming and contracts
- `docs/API_DOCUMENTATION.md` for backend behavior and error handling
- `app/(root)/page.tsx`, `app/(root)/images/page.tsx`, `app/(root)/videos/page.tsx` for route-level behavior
- `features/*/services` for request/response patterns and feature boundaries

## Mobile Product Rules

- Brand text must always be exactly `Cafa AI`.
- Mobile is not a simplified demo. It should implement the same core capabilities as web.
- Keep strict feature boundaries: no mixing chat, billing, and auth logic in one file.
- Use strongly typed request/response models.
- Do not make direct network calls from presentational components.

## Mobile Architecture

Recommended structure:

```txt
app/
  (drawer)/
    _layout.tsx
    index.tsx            # Chat home
    images.tsx           # Image history / generation entry
    videos.tsx           # Video history / generation entry
    voice.tsx            # Voice tools
    settings.tsx         # Personalization + account
    plans.tsx            # Subscription plans/status
  (auth)/
    login.tsx
    signup.tsx
    verify-otp.tsx
    forgot-password.tsx
    reset-password.tsx
  _layout.tsx
  index.tsx

components/
  ui/
  chat/
  auth/

features/
  auth/
  chat/
  images/
  videos/
  voice/
  billing/
  settings/

services/
  api/
  adapters/
  storage/

state/
  auth.store.ts
  ui.store.ts
  featureFlags.store.ts

types/
  api.common.ts
  auth.types.ts
  chat.types.ts
  image.types.ts
  video.types.ts
  voice.types.ts
  billing.types.ts
  user.types.ts
```

## Navigation Standard

- Primary app navigation should be drawer-based (sidebar behavior on mobile).
- Drawer items should map to main product surfaces: chat, images, videos, voice, settings/plans.
- Chat remains the default entry route after auth.

## Feature Parity Mapping (Web -> Mobile)

1. Chat
- Web reference: `features/chat/components/ChatShell.tsx`
- Mobile requirement: conversation list, conversation detail, composer, model selection, attachments, streaming SSE, reactions/copy/share, archive flow.

2. Auth
- Web reference: auth service and auth routes
- Mobile requirement: login/signup/OTP/forgot/reset flows, token refresh, guarded routes.

3. Images
- Web reference: `features/images/services/images.ts` and `app/(root)/images/page.tsx`
- Mobile requirement: generate, history list, download/share, loading and error states.

4. Videos
- Web reference: `features/videos/services/videos.ts` and `app/(root)/videos/page.tsx`
- Mobile requirement: generation job start, polling status, history, individual/all downloads.

5. Voice
- Web reference: `features/voice/services/voice.ts` and API docs
- Mobile requirement: record/transcribe audio and play synthesized speech with selectable voices.

6. Billing and entitlements
- Web reference: `features/billing/services/subscriptions.ts` and `features/billing/utils/entitlements.ts`
- Mobile requirement: plan-aware feature gating (free/smart/pro/max), usage display, upgrade prompts.

7. Personalization/settings
- Web reference: settings/personalization services in chat/settings flow
- Mobile requirement: theme, language, tone, response length, memory toggles, and profile settings.

## API and Networking Rules

Use the same API surface as web (`services/api/endpoints.ts`), especially:

- `/api/v1/auth/*`
- `/api/v1/chat/*` (including SSE on `POST /chat/:id/messages`)
- `/api/v1/images/*`
- `/api/v1/videos/*`
- `/api/v1/subscriptions/*`
- `/api/v1/users/*`
- `/api/v1/voice/*`

Implementation requirements:

- Centralized API client with auth interceptor/refresh behavior.
- Typed error mapping for all API failures.
- SSE parser for chat streaming (`delta`, `done`, `error` events).
- Multipart upload support for attachments/audio where required.

## UI and UX Expectations

- Preserve Cafa AI behavior and information hierarchy from web, adapted for touch.
- Keep response streaming clearly visible and interruptible.
- Maintain accessibility basics: clear labels, focus order, readable contrast.
- Ensure theme consistency (light/dark), including status bar behavior.

## Delivery Plan

1. Foundation
- Establish feature folders, typed models, API client, auth/session storage.

2. Auth + Guarding
- Implement auth flows and protected drawer routes.

3. Chat Core
- Conversation list/detail, composer, SSE streaming, model/plan checks.

4. Media Features
- Add images, videos, and voice modules with shared loading/error patterns.

5. Settings + Billing
- Personalization settings, usage surfaces, plan management entry points.

6. Hardening
- Performance pass, edge-case handling, offline-aware messaging, QA.

## Definition of Done

- Mobile app supports the same major capabilities as web for authenticated users.
- Drawer navigation replaces tab navigation for primary app surfaces.
- API integration is typed, centralized, and resilient to token expiry/errors.
- Theme, status bar, and settings behaviors are consistent across screens.

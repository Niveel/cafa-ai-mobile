# Cafa AI Frontend Master Plan (ChatGPT-class UX)

## 1. Mission and Standards

Build a production-grade AI assistant web app with:
- Beautiful, intentional UI and motion.
- Strong accessibility (WCAG 2.2 AA target).
- Fast, reliable performance on mobile and desktop.
- Strict separation of concerns and clean file ownership.
- Frontend-first simulation now, backend integration later.

This plan is based on:
- Existing API contract in `docs/API_DOCUMENTATION.md`.
- Next.js 16 + React 19 setup in this repository.
- Industry standards for accessibility and performance.

## 2. Non-Functional Requirements (Definition of Done)

### Accessibility
- Target: WCAG 2.2 AA across all core flows.
- Full keyboard support for all interactive elements.
- Clear focus states with visible contrast.
- Proper semantics (`button`, `nav`, `main`, headings hierarchy).
- Screen-reader support for streaming responses via `aria-live` regions.
- Modal/dialog behavior follows WAI-ARIA dialog pattern.
- Respect reduced motion (`prefers-reduced-motion`) for all animations.

### Performance
- Core Web Vitals goals at p75:
  - LCP <= 2.5s
  - INP <= 200ms
  - CLS <= 0.1
- Initial JS payload budget for chat route: <= 220KB gzipped (target).
- Code splitting by route and heavy-feature boundaries.
- Virtualized message list for long conversations.
- Avoid unnecessary re-renders via memoized selectors and state slicing.

### Responsiveness
- Mobile-first layout.
- Works smoothly from 320px width up to ultra-wide desktop.
- Chat composer, sidebar, and content adapt to touch and keyboard.

### Quality
- Component files should stay focused and small (soft cap: ~200 lines).
- One component per file.
- One hook/service responsibility per file.
- Strong typing across API contracts and view models.

## 3. Architecture Blueprint

## 3.1 App Layers
- `app/`: routing, route layouts, page-level composition only.
- `features/`: vertical feature modules (auth, chat, images, billing, voice, profile).
- `components/ui/`: reusable UI primitives only.
- `services/`: API client, transport, adapters, and mocks.
- `state/`: global app state stores (auth/session/ui).
- `types/`: domain and API types (pure `.ts` files).
- `lib/`: pure utility helpers (formatting, guards, parsers).
- `styles/`: design tokens, animation tokens, shared utilities.

## 3.2 Proposed Folder Structure

```txt
app/
  (marketing)/
  (auth)/
    login/page.tsx
    register/page.tsx
    verify-otp/page.tsx
    forgot-password/page.tsx
    reset-password/page.tsx
  (chat)/
    chat/page.tsx
    chat/[conversationId]/page.tsx
  (settings)/
    settings/profile/page.tsx
    settings/billing/page.tsx
  (workspace)/
    images/page.tsx
    voice/page.tsx
  api/health/route.ts (optional frontend health probe)

components/
  ui/
    Button.tsx
    IconButton.tsx
    Input.tsx
    Textarea.tsx
    Modal.tsx
    Drawer.tsx
    Tooltip.tsx
    Toast.tsx
    Skeleton.tsx

features/
  auth/
    components/
    hooks/
    services/
    mappers/
  chat/
    components/
      ChatShell.tsx
      ChatSidebar.tsx
      ConversationList.tsx
      MessageList.tsx
      MessageBubble.tsx
      Composer.tsx
      AttachmentTray.tsx
      StreamStatus.tsx
    hooks/
      useChatSession.ts
      useConversationList.ts
      useSSEMessageStream.ts
    services/
      chat.repository.ts
      chat.stream.ts
    mappers/
      chat.mapper.ts
  images/
  billing/
  voice/
  profile/

services/
  api/
    client.ts
    auth.interceptor.ts
    error.mapper.ts
    endpoints.ts
  mock/
    server.ts
    handlers/
      auth.handlers.ts
      chat.handlers.ts
      images.handlers.ts
      billing.handlers.ts
      voice.handlers.ts
  adapters/
    gateway.interface.ts
    gateway.live.ts
    gateway.mock.ts

state/
  auth.store.ts
  ui.store.ts
  featureFlags.store.ts

types/
  api.common.ts
  auth.types.ts
  chat.types.ts
  image.types.ts
  billing.types.ts
  voice.types.ts
  user.types.ts
  ui.types.ts

lib/
  sse-parser.ts
  date.ts
  validation.ts
  storage.ts
  telemetry.ts
```

Note on type files: use `.ts` (not `.tsx`) for pure types/interfaces to keep compile overhead lower and intent clearer.

## 4. UI/UX Direction (Professional AI Product)

### Visual system
- Define a consistent token system (color, spacing, radius, elevation, motion).
- Maintain a strong brand look with high contrast and calm surfaces.
- Typography hierarchy optimized for reading long chat transcripts.

### Core screens
- Auth suite: login/register/otp/reset.
- Chat shell: sidebar + thread + composer.
- Message features: markdown rendering, code blocks, copy actions, reactions.
- Attachments: upload, preview, remove-before-send.
- Usage and plan limits visibility in context.
- Billing and subscription management screens.

### Animation strategy
- Enter animations: subtle opacity + translate.
- Streaming animation: cursor pulse and token reveal.
- Sidebar transitions and skeleton loading states.
- Motion-safe variants for reduced-motion users.

## 5. Data and State Strategy

### Query and mutation model
- Use repository pattern between UI and transport layer.
- Use a query/mutation library for caching, retries, background refresh.
- Keep transient UI state local; keep session and feature flags global.

### Streaming model (SSE)
- Parse `delta`, `done`, `error` events from `POST /chat/:id/messages` SSE stream.
- Maintain optimistic user message immediately.
- Incrementally append assistant content as deltas arrive.
- On `done`, persist final message metadata (`tokens`, `messageId`).

### Error strategy
- Standard API error normalization to typed error objects.
- Distinguish:
  - pre-stream validation errors (JSON)
  - in-stream errors (`type: error`)
- Graceful retry UX and reconnect strategy.

## 6. Frontend Simulation Before Backend Integration

Implement a strict adapter boundary:
- `gateway.interface.ts` defines all app-required methods.
- `gateway.mock.ts` powers development with realistic latency and SSE simulation.
- `gateway.live.ts` plugs into real API later with no UI rewrites.

Feature flag:
- `NEXT_PUBLIC_API_MODE=mock|live`

Mock requirements:
- Auth lifecycle simulation (including token refresh).
- Conversation list/history simulation.
- Streaming token simulation with delays and occasional controlled errors.
- Tier/usage limit simulation (free/smart/pro/max).

## 7. Endpoint Mapping From Current API Documentation

Covered by backend docs:
- Auth: register, verify-otp, resend-otp, login, logout, refresh-token, forgot/reset password, me.
- Chat: create/list/get/delete conversation, send message (SSE), react.
- Images: generate/history/delete.
- Subscription: checkout, portal, status.
- Users: me, update profile, update password, delete account, usage.
- Voice: transcribe, synthesize, voices.

## 8. Additional Backend Requests for ChatGPT-class UX

Create and share `docs/BACKEND_ENDPOINT_REQUESTS.md` (included in this plan package) for endpoints likely needed but not currently documented.

## 9. Security and Privacy Baseline

- Store access token in memory-first strategy; keep refresh token in HttpOnly cookie.
- Avoid exposing sensitive data in logs and error toasts.
- Sanitize markdown rendering to prevent XSS.
- Restrict file uploads by type and size on client before request.
- Add abuse controls UX (rate limiting feedback, temporary lock notices).

## 10. Testing and Validation Plan

### Automated tests
- Unit tests for parsers, mappers, utilities.
- Component tests for composer, message rendering, reactions, dialogs.
- Integration tests for auth + chat + streaming flows.
- E2E tests for core journeys (auth -> chat -> stream -> billing).
- A11y audits (axe) on critical routes.

### Manual QA matrix
- Browsers: Chrome, Edge, Safari, Firefox (latest stable).
- Mobile: iOS Safari + Android Chrome.
- Keyboard-only and screen-reader checks.
- Reduced motion and high zoom (200%) checks.

## 11. Delivery Milestones

### Milestone 0: Foundations
- Finalize architecture, folder structure, coding conventions.
- Introduce design tokens and base primitives.
- Set up lint, formatting, test harness, CI checks.

### Milestone 1: Auth and Session
- Build auth screens + validation.
- Implement token refresh flow and guarded routes.
- Mock/live adapter support.

### Milestone 2: Chat MVP (Core)
- Chat shell layout and responsive behavior.
- Conversation CRUD + message history.
- Composer + attachment tray + streaming SSE.

### Milestone 3: Chat Excellence
- Rich markdown/code blocks, reactions, regenerate/edit patterns.
- Polished animations and skeleton states.
- Robust error handling and reconnection behavior.

### Milestone 4: Premium Features
- Image generation + history.
- Voice transcribe/synthesize + playback UX.
- Usage meter and plan-aware feature gates.

### Milestone 5: Billing and Settings
- Checkout/portal integration.
- Profile/password/account deletion flows.

### Milestone 6: Hardening and Launch
- Performance optimization pass.
- A11y audit closure.
- E2E stabilization and release checklist.

## 12. Engineering Rules We Will Enforce

- One component per file.
- One hook per file.
- One service responsibility per file.
- Types centralized under `types/` (pure `.ts`).
- No API calls directly inside presentational components.
- Route pages compose feature containers; business logic lives in features/services.
- Shared UI primitives do not contain feature-specific logic.

## 13. References

- API source: `docs/API_DOCUMENTATION.md`
- WCAG 2.2: https://www.w3.org/TR/wcag/
- WAI modal dialog pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- Core Web Vitals (LCP, INP, CLS): https://web.dev/articles/vitals
- Reduced motion media query: https://developer.mozilla.org/docs/Web/CSS/%40media/prefers-reduced-motion

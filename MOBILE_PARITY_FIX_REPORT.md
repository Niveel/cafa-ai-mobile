# Mobile parity fix report

**Branch:** `mobile-parity-fixes` (nothing committed)
**Date:** 27 Sep 2026
**Spec used:** `KARIM_MOBILE_WORK_INSTRUCTIONS.md`: Reference A (live backend, highest authority), then B (endpoint map), then C (behaviour).
**Full inventory and findings:** `MOBILE_PARITY_AUDIT_REPORT.md` (Desktop). That report has the complete call-site table (method, path, body, auth, parsing) and every finding with `file:line`. This report covers what changed since.

**Checks:** `tsc` passes, locale validation passes, and there are no lint errors. Not yet tested on a device.

---

## Changed

| # | Area | File | Before | After | Why (spec) |
|---|---|---|---|---|---|
| 1 | Refresh token capture | `services/api/auth.interceptor.ts` (`extractRefreshTokenFromHeaders`), `features/auth/services/auth.ts` (`withRefreshTokenFromHeaders`, login + verify-otp) | Stored a refresh token only if the JSON body had one, which never happens | Reads `refreshToken` from `Set-Cookie` on login, verify-otp and every refresh, and stores it in SecureStore. If a refresh reply has no readable token, the stale one is cleared (tokens are single-use) | A §A1–A2 |
| 2 | Refresh body | `auth.interceptor.ts` | Sent `{}` because no token was ever stored | Sends `{ refreshToken }` in the body (already coded; now actually has a value) | A §A2 |
| 3 | Logout body | `context/AppContext.tsx` → `auth.ts logout` | Sent `{}` | Sends `{ refreshToken }` now that it's stored (no code change needed) | A §A3 |
| 4 | Refresh failure handling | `auth.interceptor.ts` | 400/401/403 from refresh ended the session | Only a 401 ends it | B §3.3 rule 5 |
| 5 | Refresh cooldown | `auth.interceptor.ts` | none | 5 s cooldown after a failed refresh | B §3.3 rule 4 |
| 6 | Login | `data/validationConstants.ts`, `app/(auth)/login.tsx` | Accepted "email or username" | Email only: label, validation and keyboard | A §C1 |
| 7 | `/chat/upload` | `features/chat/services/widgets.ts` | Required `{success, data}`, so every widget file upload failed | Reads top-level `{url, name}` (still accepts the wrapped shape) | A §C2, B §2 |
| 8 | Chat references | `features/chat/services/authenticated.ts` (`appendReferenceFields`), `app/(drawer)/index.tsx` (stream call) | Stream sent no reference; non-stream sent only `reference` / `reference[...]` | Both paths send `referenceUrl` + `referenceKind` (old fields kept alongside) | B §4.1, A §C9 |
| 9 | Checkout | `app/(drawer)/plans.tsx`, `features/billing/services/subscriptions.ts` | No branch for `subscription_payment_required` | Opens Stripe PaymentSheet with the `clientSecret`, then waits for the server to confirm the tier. Mobile already sends `platform:"mobile"`, which returns `checkout_started`, so this is a fallback | A §C3 |
| 10 | Limit card buttons | `components/chat/UpgradePromptCard.tsx`, locales ×4 | Out of credits → "Upgrade plan"; plan limit → no button | Plan limit → "Upgrade plan" (`/plans`); out of credits → "Buy credits" (`/billing/credits`) | B §2, C §7.3 |
| 11 | Notification taps | `utils/notificationRoute.ts`, `app/_layout.tsx`, `app/(drawer)/index.tsx` | `router.push(link)` with the web route | Maps web routes (`/repo/*`, `/tools/*`, `/c/:id`) to mobile screens; unknown links go to the home chat | A §C8 |

### Second round (same day)

| # | Area | File | Change | Why |
|---|---|---|---|---|
| 12 | Edit Image / Image to Video | `features/mediaConversations/services/mediaConversations.ts`, `services/api/endpoints.ts` (`chat.mode`), `app/(drawer)/index.tsx` | The conversation now comes from `GET /chat/mode/:screen`. Sends go through the normal `POST /chat/:id/messages` stream with the image in `files` (or `referenceUrl`). The old `/media/*` calls and `/media/prompts/rewrite` sit behind `USE_LEGACY_DEDICATED_MEDIA_CALLS` / `USE_MEDIA_PROMPT_REWRITE` (both `false`, kept for rollback). These screens can no longer fall into the old `/images/generate` / `/videos/*` / non-stream reference paths | A §C4, B §4.4 |
| 13 | Avatar gallery + Randomize | `app/(drawer)/avatar-video.tsx` | Hidden behind `SHOW_AVATAR_GALLERY` / `SHOW_RANDOMIZE_SETUP = false`, matching web | A §C6 |
| 14 | Avatar script budget | `app/(drawer)/avatar-video.tsx` | Scripts over 37 spoken words (`[tags]` not counted) block Next and Generate | C §10.2 |
| 15 | Timeouts | `features/images/services/images.ts`, `features/videos/services/videos.ts` | Image edit 45 s → 95 s; image-to-video 270 s → 10 min | B §11 row 10 |
| 16 | Rename | `features/chat/services/authenticated.ts` (`renameAuthenticatedConversation`), `components/ui/AppDrawerContent.tsx` | Renaming also sends `PATCH /chat/:id {title}` for backend ids (the on-device title still kept) | B §4 |
| 17 | Billing return | `app/billing/success.tsx` | Counts `trialing` as active; polls 2.5 s for 1 min, then 7 s, up to 3 min. Success only ever comes from `/subscriptions/status` | C §8.3 |
| 18 | No duplicate resend | `app/(drawer)/index.tsx` (stream-failure recovery) | A stream server error re-reads the conversation instead of re-POSTing the message | C §5.4 |
| 19 | Credit vs plan limit (non-stream) | `app/(drawer)/index.tsx` (limit notice) | `CREDIT_LIMIT_EXCEEDED` shows "Buy credits" → `/billing/credits`; other limits keep "Upgrade plan" | C §7.3 |
| 20 | 429 retry | `services/api/auth.interceptor.ts` | GET requests that get a 429 wait `Retry-After` (≤ 5 s, default 0.9 s) and retry once; plan/credit limit codes are never retried | B §12 |
| 21 | Guest send | `features/chat/services/guest.ts` | Sends `Idempotency-Key`, `content`, `model: gpt-4o-mini`, `language`; retries without `model` on 403 `GUEST_MODEL_NOT_ALLOWED`; one `Retry-After` retry on 429. Still non-streaming (see below) | B §3.4 |
| 22 | Quick replies | `features/chat/services/authenticated.ts` (`pollQuickReplies`), `services/api/endpoints.ts`, `components/chat/types.ts`, `app/(drawer)/index.tsx` | After each streamed reply, polls quick replies (1.5 s / 2.5 s / 3 s) and shows up to 4 chips under the latest reply; tapping one sends it | B §4, C §5.4 |

---

## Deliberately left unchanged (and why)

- **Checkout `platform: "mobile"`:** mobile already sends it (`app/(drawer)/plans.tsx`, `createCheckoutSession`).
- **Stream event handling:** already covers every event in B §4.3.
- **Mobile-only endpoints** (`/auth/me`, `/subscriptions/sync`, `/guest/upgrade/claim`, message reactions, `/notifications/unread-count`, `/voice/synthesize/token` + `/stream`, Expo `/notifications/push-tokens`): all confirmed live (Reference A appendix). They're kept because they back real mobile features, not parity targets.
- **Proactive refresh at `exp − 60 s`:** access tokens last 30 days (A §A4), so 401-driven refresh covers it. Low value; not added.

## Still open

1. **Guest streaming.** Guest replies still arrive in one piece (JSON). Streaming for guests needs the same XHR transport as signed-in chat; the request body and headers already match the spec.
2. **Checkout-session call.** `/billing/success` doesn't call `GET /subscriptions/checkout-session/:id`. It isn't needed for safety, because success is only shown once `/subscriptions/status` confirms the plan.
3. **Dedicated screen fallback.** If `GET /chat/mode/:screen` fails, a send creates an ordinary conversation, not the screen's one. The endpoint is find-or-create, so this should be rare.
4. **P2 items from the audit** (cache TTLs, TTS voices via `/avatar/voices`, preview error mapping by status, extra chat form fields, `defaultVoiceId`, SSE `data:` parsing, zip attempts) are unchanged.

## Needs a backend or human decision

The six questions are in `backend-questions.md` on the Desktop:
1. Checkout return mechanics.
2. Whether `/media/prompts/rewrite` is retired.
3. `reference` not persisted.
4. Whether the `platform` field is stable.
5. Refresh cookie on verify-otp.
6. `/subscriptions/sync` field naming.

**Device testing still needed:**
- log in, then force a refresh and confirm the rotated token is stored
- widget file upload
- a referenced-image chat
- the out-of-credits card button

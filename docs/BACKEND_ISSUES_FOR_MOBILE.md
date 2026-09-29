# Backend items for the mobile app

Written 2026-09-20, updated 2026-09-23 after a backend developer supplied
`API_INTEGRATION_GUIDE.md` (source-cited against the actual backend code — treat it as the
source of truth over anything else in this file, including earlier versions of this file).
Re-checked 2026-09-23 against mobile commit `c784a4d`, which replaced mobile's own guessed
versions of several of the items below with the real implementations.
Updated 2026-09-24 with a backend developer's answers (`FRONTEND_DEV_QUESTIONS.md`), checked
against the live deployed server rather than the git repo. Every previously open question is now
answered; see "Answered 2026-09-24" below.

---

## Resolved by API_INTEGRATION_GUIDE.md (no backend action needed)

- **Cafa Live token route.** `POST /cafa-life/token` was never a real route to begin with — only
  `POST /cafa-life/livekit-token` exists and always has. The older `docs/cafa-life-frontend-docs.md`
  was simply stale. As of `c784a4d` mobile calls only `livekit-token` and reads its confirmed
  response shape `{ token, url, room }`.
- **Suggested prompts** (`GET /chat/suggested-prompts`) — confirmed real, matches what mobile
  already called.
- **Notifications** (`GET /notifications`, `GET /notifications/unread-count`,
  `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`) — confirmed real and the
  response shapes match what mobile already expected.
- **Chat SSE event contract** — every event type mobile handles (`reasoning`, `tool_start`,
  `tool_end`, `widget`, `products`, `media`, `done`, `error`, etc.) matches the confirmed contract
  exactly.

## Previously guessed paths, now correct in the mobile code (no backend action needed)

Mobile had guessed two endpoint paths wrong. `c784a4d` uses the paths confirmed by the guide:
- Delete a generated file: `DELETE /chat/:id/messages/:messageId/tool-calls/:toolCallIndex`
  (mobile had guessed `.../artifacts/:toolCallIndex`).
- Read-aloud streaming token: `POST /voice/synthesize/token` (mobile had guessed
  `.../synthesize/stream-token`).

## Answered 2026-09-24 (`FRONTEND_DEV_QUESTIONS.md`)

### Native push tokens — real and live; keep the push prompt on

`POST /notifications/push-tokens` (`{ token, platform?, deviceId? }`, token must match
`ExponentPushToken[...]`, returns `201`) and `DELETE /notifications/push-tokens` (`{ token }`)
exist on the deployed backend. Expo pushes are really sent (via `expo-server-sdk`) for
`video_ready`, `avatar_video_ready`, `movie_studio_render_ready`, `image_ready` and
`subscription_payment_failed`, when the push preference is on and the user isn't connected over
SSE. Tokens that come back `DeviceNotRegistered` are deleted. `API_INTEGRATION_GUIDE.md`'s "out
of scope" note was stale.

Mobile impact: none; `pushRegistration.ts` is correct. Android builds need a real
`google-services.json` to get a push token at all (`app.config.ts` only references it when the
file is present).

### Cafa Life limit errors — mobile's mapping confirmed

`POST /cafa-life/livekit-token` returns `429` + `CREDIT_LIMIT_EXCEEDED` when credits run out and
`429` + `RATE_LIMIT_EXCEEDED` when the daily/hourly minute cap is hit. This matches
`useCafaLifeSession.ts` exactly. The response `message` is also safe to display as-is.

### SSE payload shapes

- `widget`: `{ type, spec: { title, description, submit_label, fields[] } }`. `title` and
  `description` default to `''`, `submit_label` to `'Submit'`. `fields` is passed through from
  the model's tool call and only checked to be a non-empty array — no server-side schema, so
  mobile should stay tolerant of odd fields. Matches `UiWidgetSpec` in `components/chat/types.ts`.
- `upgrade_prompt`: `{ type, reason: 'insufficient_credits' | 'rate_limit', feature: 'image' |
  'video' | 'document' }`. Those three are the only `feature` values any call site sends today.
- `products`: `{ type, query, items: ProductResult[] }`. The item fields weren't listed; the
  backend source of truth is `src/tool-chat/product-search.ts` (Serper Shopping). Mobile's loose
  field aliasing still covers this.
- `media`: `{ type, kind: 'image' | 'video' | 'file', url, name?, size? }` — the complete list.
  Mobile reads everything except the optional `size` (bytes).

### `sandbox_session` — reachable from mobile

`generate_website` has no platform gating, so a mobile chat turn ("build me a landing page") can
start a real sandbox build. Mobile previously ignored the event, so the user got no feedback.
**Changed 2026-09-24:** the `SandboxBuildNotice` is switched back on (handler and render in
`app/(drawer)/index.tsx`, `UiMessage.sandboxSessionId` restored). A real in-app build viewer
is still a separate, unscoped feature.

### Guide's own unverified items

- `R2_PUBLIC_URL` = `https://media.niveel.com` (from the live `.env.a100`, confirmed serving files).
- Stripe `apiVersion` = `2024-06-20`.
- `getCreditsStatus` returns `{ weekly: {used,total,resetAt}, monthly: {used,total,resetAt},
  topupBalance, byFeature: [{feature, credits, count}] }` (`byFeature` covers the current month).
- `getCreditsInvoices` returns `[{ id, type: 'subscription' | 'topup', amount, currency, status,
  created, url | null }]`.
- `revenuecat.service.ts` internals are still only traced by signature.

## Backend-side risks raised in the answers (not mobile work — for the backend owner)

- **Uncommitted production code.** The push-token controller/routes/service and parts of
  `src/tool-chat/stream.ts` / `executor.ts` exist only on the deployed server's filesystem and
  were never committed. A redeploy or disk failure could lose them.
- **`DELETE /notifications/push-tokens` isn't scoped to the user.** It deletes by `token` only,
  so any signed-in user who knows a token can unregister another device. Same gap as the Web
  Push delete endpoint (`AUDIT_FINDINGS.md` §4).

## Still open

- Exact `ProductResult` field list, only if the product cards need more precise rendering.

## Found in mobile testing, 2026-09-26 (need a backend fix)

Seen on the Android emulator against `https://cafatest.niveel.com/api/v1`, signed in as a Free-plan user.

1. **`POST /media/prompts/rewrite` returns 500** (`PROMPT_REWRITE_FAILED`, "Could not interpret the
   prompt right now") for `screen: "image-to-video"`. Mobile now falls back to the user's own prompt,
   so image-to-video still works, but the prompt improvement and wrong-screen routing are skipped
   until this is fixed. Same call is used by Edit Image.
2. **`GET /avatar/gallery` returns an empty list** (`{ avatars: [] }`), so the gallery avatar picker
   is empty and "Randomize setup" can't pick a face. Mobile now keeps a user-uploaded photo when
   randomizing and tells users to upload their own, but the gallery itself needs content.
3. ~~Text-to-speech timestamps 2 hours early~~ — **not reproduced on 2026-09-27** (a new
   conversion's `createdAt` matched real UTC). Seen once on 2026-09-26; no action for now.
4. **Chat `reference` not persisted.** `POST /chat/:id/messages` with `referenceUrl` +
   `referenceKind=image` works (the model's `analyze_image` uses that exact URL), but the stored
   user message has `reference: null`. Is it only set for media generated earlier in the same
   conversation, or is it a gap?
5. **Confirm `platform: "mobile"` on `POST /subscriptions/checkout`.** With it the backend returns
   `checkout_started` (hosted Stripe, `returnStrategy: "redirect_to_app"`); without it,
   `subscription_payment_required`. Is `platform` a stable field, and is `checkout_started`
   always returned for mobile, including brand-new accounts?

Confirmed on 2026-09-27 (see `MOBILE_BACKEND_CONFIRMATIONS.md`): the refresh token arrives only as
`Set-Cookie: refreshToken=…; Path=/api` (never in a body); `POST /auth/refresh-token` and
`/auth/logout` accept `{ refreshToken }` in the body; refresh tokens are single-use and rotate;
access tokens last 30 days; login rejects usernames (email only).

Working as expected in the same session: chat, image generation (daily cap enforced), image-to-video
(`/media/video/image-to-video`), image edit (`/media/image/edit`, reached; answered with the daily
cap), avatar photo upload and `/avatar/video/generate` (reached; answered with the 1-per-day cap),
TTS convert and history, credits/plans, images/videos history, notifications and Expo push.

## Found in mobile testing, 2026-09-28 (need a backend fix)

**`GET /artifacts` never returns anything generated through the native tool-calling chat flow, even
though the files themselves exist and download fine.** Reproduced on the Android emulator: generated
a PDF ("Create a PDF about dogs") and confirmed via logcat it completed successfully (`tool_end`,
`media`, `done`, all 200) and the file downloads and opens correctly from the chat message itself.
The Artifacts screen's "Artifacts" tab stayed empty for it (and for prior generated images) even
after pull-to-refresh.

**Confirmed 2026-09-28, not a routing/base-URL issue.** Checked whether the route even exists on
`https://cafatest.niveel.com`: `GET /api/v1/artifacts` with no/garbage auth returns the same
`401 TOKEN_INVALID` shape as a known-real route like `/chat`, not a 404 — the route is live and
behind the normal auth middleware. Then called it from the app with a real, valid session (same
account that just generated the dogs PDF above) and got back:

```json
{"success":true,"data":[],"pagination":{"page":1,"limit":20,"total":0,"pages":0}}
```

A well-formed `200` with zero items, for an account that has generated multiple images and at least
two PDFs minutes earlier in the same session. Mobile parses this correctly (an empty `data[]` is
correctly rendered as an empty screen) — the endpoint itself is returning nothing to find.

Root cause looks architectural, not a mobile bug: `FRONTEND_ARTIFACTS_API_GUIDE.md` documents
`kind: "generated"` as "sandbox-generated artifacts stored in message artifact metadata" — but since
the native tool-calling migration (mobile commit `7145cce`), every image/video/document generation
(`generate_image`, `generate_video`, `image_to_video`, `edit_image`, `generate_document`) is
persisted only on the message's real `toolCalls[].mediaRef.url` (confirmed in mobile's own
`backfillToolStateFromToolCalls`-equivalent, `app/(drawer)/index.tsx` around the `backfilledArtifacts`
reduce). If `GET /artifacts` is still reading whatever the old pre-migration "artifact metadata"
field was instead of scanning `toolCalls[].mediaRef`, it would explain exactly this: nothing new
ever shows up, regardless of how many images/documents a user generates, because generation no
longer writes to the field that endpoint reads.

Needs backend confirmation: does `GET /artifacts`'s `kind: "generated"` branch read `toolCalls[]`,
or only a separate/older artifact-metadata field? If the latter, it needs to also (or instead) scan
`toolCalls[].mediaRef` per message to surface post-migration generations. Test account/conversation
for repro: signed in as `karimnurudeen13@gmail.com`, conversation `6ab9f1cb68a918316c16b18a`
("Create a PDF about dogs", generated 2026-09-28 ~06:51 UTC) has a real `generate_document` tool
call with a working `mediaRef.url` that `GET /artifacts` still misses entirely.

Writing Tools (AI detection, humanize) are hidden in the mobile UI for now, so they're not tracked here.

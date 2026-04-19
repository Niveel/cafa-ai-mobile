
# Usage Consistency Audit (April 19, 2026)

User ID: `69c16fb626aba6f503098d2b`
Conversation used for chat probe: `69d6ef1aed95cf289524f9e5`
Backend base URL: `http://10.223.110.23:5000/api/v1` (same backend also reachable at `http://localhost:5000/api/v1`)
Deployed SHA: `90614a2`
Container start/deploy timestamp (UTC): `2026-04-19T08:19:18.870232253Z`

## 1) `GET /api/v1/users/me/usage` right now, before/after 1 chat + 1 image

### Before actions (`GET /users/me/usage`)
```json
{"success":true,"data":{"subscription":{"tier":"cafa_max","status":"active","renewalDate":"2026-05-07T02:15:09.000Z"},"usage":{"chat":{"used":7,"limit":null},"images":{"used":7,"limit":50},"videos":{"used":0,"limit":25},"chatMessagesToday":7,"imageGenerationsToday":7,"videoGenerationsToday":0},"lastResetDate":"2026-04-19","nextResetAt":"2026-04-20T00:00:00.000Z","timezoneBasis":"UTC","updatedAt":"2026-04-19T08:24:01.704Z"}}
```

### After 1 successful chat (`POST /chat/:conversationId/messages`, then `GET /users/me/usage`)
```json
{"success":true,"data":{"subscription":{"tier":"cafa_max","status":"active","renewalDate":"2026-05-07T02:15:09.000Z"},"usage":{"chat":{"used":8,"limit":null},"images":{"used":7,"limit":50},"videos":{"used":0,"limit":25},"chatMessagesToday":8,"imageGenerationsToday":7,"videoGenerationsToday":0},"lastResetDate":"2026-04-19","nextResetAt":"2026-04-20T00:00:00.000Z","timezoneBasis":"UTC","updatedAt":"2026-04-19T08:25:11.470Z"}}
```

### After 1 successful image (`POST /images/generate`, then `GET /users/me/usage`)
```json
{"success":true,"data":{"subscription":{"tier":"cafa_max","status":"active","renewalDate":"2026-05-07T02:15:09.000Z"},"usage":{"chat":{"used":8,"limit":null},"images":{"used":8,"limit":50},"videos":{"used":0,"limit":25},"chatMessagesToday":8,"imageGenerationsToday":8,"videoGenerationsToday":0},"lastResetDate":"2026-04-19","nextResetAt":"2026-04-20T00:00:00.000Z","timezoneBasis":"UTC","updatedAt":"2026-04-19T08:25:21.552Z"}}
```

## 2) Are counters written in success path or only async jobs?

- Chat counters: incremented in success handling path.
- Image counters: incremented in success handling path (sync image generation path).
- Video counters: incremented on successful async completion path.

Expected delay:
- Chat/image: immediate read-after-write (same request flow, then reflected on next read).
- Video async: delay equals job completion time.

## 3) Confirmed path coverage

- chat stream success: increment path present.
- chat fallback/non-stream success: increment path present.
- image sync generation: increment path present.
- image async completion: no separate async image job path currently in this backend.
- idempotent replay/retry path: replay response path avoids double increment.

## 4) Source of truth for plans usage

Both endpoints now use one canonical service backed by Redis day-bucket counters:
- `GET /api/v1/users/me/usage`
- `GET /api/v1/subscriptions/status`

At same read moment, they return identical usage/meta fields.

## 5) Actual cache/debug headers observed

Observed on both `/users/me/usage` and `/subscriptions/status`:

- `Cache-Control: no-store, no-cache, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`
- `x-api-sha: 90614a2`
- `x-usage-chat-used: 8`
- `x-usage-image-used: 8`
- `x-usage-updated-at: 2026-04-19T08:25:21.552Z`
- `x-usage-bucket-date: 2026-04-19`
- `x-usage-source: redis`

CDN headers in this direct environment:
- `x-cache`: not present
- `cf-cache-status`: not present

## 6) Any incorrect cache keying risk by Authorization?

Current behavior:
- No server-side shared-response caching for these payloads.
- Responses are computed from authenticated user context plus Redis counters.
- Strict `no-store` headers prevent intermediary storage.

Conclusion: cross-user cached zero payload risk is not expected in current direct backend path.

## 7) Timezone + reset rule

Current day-bucket basis: `UTC`.

Returned metadata:
- `lastResetDate`: `2026-04-19`
- `nextResetAt`: `2026-04-20T00:00:00.000Z`
- `timezoneBasis`: `UTC`

Date-boundary caveat: clients using local-day semantics can perceive mismatch near UTC midnight.

## 8) Legacy + new fields alignment

Confirmed populated and aligned:
- `usage.chat.used` == `usage.chatMessagesToday`
- `usage.images.used` == `usage.imageGenerationsToday`
- `usage.videos.used` == `usage.videoGenerationsToday`

## 9) Last 3 successful action logs (from backend logs)

```json
{"action":"image","after":7,"before":6,"bucketDate":"2026-04-19","incrementBy":1,"level":"info","message":"Usage counter incremented","reason":"image_generate_success","timestamp":"2026-04-19T08:24:01.714Z","userId":"69c16fb626aba6f503098d2b"}
{"action":"chat","after":8,"before":7,"bucketDate":"2026-04-19","incrementBy":1,"level":"info","message":"Usage counter incremented","reason":"chat_send_non_stream_success","requestId":"8fe6385d-7b79-4d2f-a89e-d1fb4f17303b","timestamp":"2026-04-19T08:25:11.470Z","userId":"69c16fb626aba6f503098d2b"}
{"action":"image","after":8,"before":7,"bucketDate":"2026-04-19","incrementBy":1,"level":"info","message":"Usage counter incremented","reason":"image_generate_success","timestamp":"2026-04-19T08:25:21.557Z","userId":"69c16fb626aba6f503098d2b"}
```

Note: image increment logs currently do not include request id.

## 10) Deployed environment verification

- Base URL in use: `http://10.223.110.23:5000/api/v1`
- Deployed SHA: `90614a2` (also returned by `x-api-sha` header)
- Deploy/start timestamp: `2026-04-19T08:19:18.870232253Z`
- Build provenance: deployed from clean committed SHA.

## 11) Read consistency / replicas

- Usage reads and writes use the same Redis primary in this environment.
- No read replica path configured for usage reads.
- No replica lag expected for these counters.

## 12) Freshness marker field

Present and active on both endpoints:
- `updatedAt` in body
- `x-usage-updated-at` in headers

Both change after successful increments and matched across both endpoints during the probe and 5-iteration acceptance loop.

## 13) Acceptance loop result (5 repeats)

Validation run executed: for each of 5 iterations:
1. send 1 successful chat
2. send 1 successful image
3. immediately read both endpoints

Observed each iteration:
- chat/image counters increased monotonically (3 -> 7 during loop)
- `/users/me/usage` and `/subscriptions/status` values matched exactly
- no false zero responses
- `updatedAt` matched across both endpoints for each iteration

Raw artifacts saved under:
- `tmp_acceptance2/acceptance_results.json`
- `tmp_acceptance2/usage_*.json`
- `tmp_acceptance2/status_*.json`
- `tmp_probe/*.json`

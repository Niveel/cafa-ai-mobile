# Usage/Status Audit (April 19, 2026)

User ID audited: `69c16fb626aba6f503098d2b` (resolved from conversation `69d6ef1aed95cf289524f9e5`).

Base URL used for live calls in this audit: `http://localhost:5000/api/v1` (same host also bound on `10.223.110.23:5000`).

## 1) What does `GET /api/v1/users/me/usage` return before/after 1 chat + 1 image?

### Before actions
```json
{"success":true,"data":{"subscription":{"tier":"cafa_max","status":"active","renewalDate":"2026-05-07T02:15:09.000Z"},"usage":{"chat":{"used":1,"limit":null},"images":{"used":1,"limit":50},"videos":{"used":0,"limit":25},"chatMessagesToday":1,"imageGenerationsToday":1,"videoGenerationsToday":0},"lastResetDate":"2026-04-19","nextResetAt":"2026-04-20T00:00:00.000Z","timezoneBasis":"UTC","updatedAt":"2026-04-19T07:57:33.634Z"}}
```

### Chat action response (`POST /chat/:id/messages`, non-stream)
```json
{"success":true,"data":{"conversationId":"69d6ef1aed95cf289524f9e5","requestId":"33985aa3-3a1f-4f0b-af0b-452e58612668","message":{"_id":"69e48aed665caabcb25708fa","role":"assistant","content":"It appears you're looking for information regarding the success of a usage probe chat conducted on April 19, 2026. However, I don't have access to specific metrics or data related to usage probes or chat performance. If you can provide more context about what aspects you're interested in, such as user engagement, feedback, or technical performance, I would be happy to help you analyze or discuss those topics further!","attachments":[],"reactions":{"liked":false,"disliked":false},"tokens":1979,"createdAt":"2026-04-19T07:57:33.737Z"}}}
```

### After chat (`GET /users/me/usage`)
```json
{"success":true,"data":{"subscription":{"tier":"cafa_max","status":"active","renewalDate":"2026-05-07T02:15:09.000Z"},"usage":{"chat":{"used":2,"limit":null},"images":{"used":1,"limit":50},"videos":{"used":0,"limit":25},"chatMessagesToday":2,"imageGenerationsToday":1,"videoGenerationsToday":0},"lastResetDate":"2026-04-19","nextResetAt":"2026-04-20T00:00:00.000Z","timezoneBasis":"UTC","updatedAt":"2026-04-19T07:57:36.254Z"}}
```

### Image action response (`POST /images/generate`)
```json
{"success":true,"data":{"id":"69e48afb665caabcb2570927","imageUrl":"https://v3b.fal.media/files/b/0a96dab3/xc-LefZbIeBvxVAeAdwF5_de342c8cc3bc4b0a939488da660830c9.jpg","prompt":"A simple blue square app icon","style":"realistic","width":2752,"height":1536,"generationTime":11206,"model":"fal-ai/flux-pro/v1.1-ultra","createdAt":"2026-04-19T07:57:47.568Z"},"message":"Image generated successfully"}
```

### After image (`GET /users/me/usage`)
```json
{"success":true,"data":{"subscription":{"tier":"cafa_max","status":"active","renewalDate":"2026-05-07T02:15:09.000Z"},"usage":{"chat":{"used":2,"limit":null},"images":{"used":2,"limit":50},"videos":{"used":0,"limit":25},"chatMessagesToday":2,"imageGenerationsToday":2,"videoGenerationsToday":0},"lastResetDate":"2026-04-19","nextResetAt":"2026-04-20T00:00:00.000Z","timezoneBasis":"UTC","updatedAt":"2026-04-19T07:57:47.642Z"}}
```

## 2) Are counters written in same success path or only async jobs?

- Chat non-stream: incremented in the success path after assistant message persistence.
- Chat stream: incremented in `onComplete` success path after persistence.
- Chat regenerate: incremented in `onComplete` success path after persistence.
- Image generate: incremented in synchronous success path after image record persistence.
- Video generate: incremented in async background completion path when job succeeds.

If async: expected delay is job runtime (for video, seconds to minutes depending on provider latency). For sync chat/image: effectively immediate (same request path).

## 3) Confirmed successful path coverage

- chat stream success: Yes.
- chat fallback/non-stream success: Yes.
- image sync generation: Yes.
- image async completion: N/A (no async image job path currently in this backend).
- idempotent replay/retry without double count: Yes for idempotent replay path; replay returns stored completion and does not run success mutation again.

## 4) Source of truth for plans screen usage

Both endpoints now use the same source:
- `GET /api/v1/users/me/usage`
- `GET /api/v1/subscriptions/status`

Both are built from the same live Redis day-bucket counters via shared usage payload builder.

Are values guaranteed identical at read time? If read at the same moment with no in-between successful action, yes. If an action completes between two calls, the later call will show newer values.

## 5) Actual cache headers on usage/status

Observed on both endpoints:
- `Cache-Control: no-store, no-cache, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`

Observed CDN/cache headers in this direct-call environment:
- `x-cache`: not present
- `cf-cache-status`: not present

## 6) Any incorrect server/CDN caching keying risk?

Server-side:
- No response caching layer is used for these endpoints.
- Responses are computed per authenticated user.
- No shared cache key by URL is used for usage/status payloads.

CDN/proxy:
- With `no-store`, shared caching should be bypassed.
- I did not observe CDN headers in this direct backend path.

Could one user receive another user's cached zero payload? Under current server behavior: not expected.

## 7) Timezone and reset rule

Current rule is UTC day buckets.

Returned fields:
- `lastResetDate`: `2026-04-19`
- `nextResetAt`: `2026-04-20T00:00:00.000Z`
- `timezoneBasis`: `UTC`

Could frontend expect a different day? Yes, if frontend interprets “today” in local timezone instead of UTC near day boundaries.

## 8) Legacy + new usage fields together

Yes, both are returned and aligned:
- `usage.chat.used` == `usage.chatMessagesToday`
- `usage.images.used` == `usage.imageGenerationsToday`

From after-image snapshot:
- chat: `2 == 2`
- images: `2 == 2`

## 9) Logs for last 3 successful actions (with before/after)

From backend JSON logs:

1. `2026-04-19T07:56:34.397Z`
```json
{"action":"image","after":1,"before":0,"bucketDate":"2026-04-19","incrementBy":1,"message":"Usage counter incremented","reason":"image_generate_success","userId":"69c16fb626aba6f503098d2b"}
```

2. `2026-04-19T07:57:36.190Z`
```json
{"action":"chat","after":2,"before":1,"bucketDate":"2026-04-19","incrementBy":1,"message":"Usage counter incremented","reason":"chat_send_non_stream_success","requestId":"33985aa3-3a1f-4f0b-af0b-452e58612668","userId":"69c16fb626aba6f503098d2b"}
```

3. `2026-04-19T07:57:47.579Z`
```json
{"action":"image","after":2,"before":1,"bucketDate":"2026-04-19","incrementBy":1,"message":"Usage counter incremented","reason":"image_generate_success","userId":"69c16fb626aba6f503098d2b"}
```

## 10) Deployed environment confirmation

- App-reported backend base URL: `http://10.223.110.23:5000/api/v1`
- This host has `10.223.110.23` assigned and backend is bound to `:5000`.
- Latest API rebuild/redeploy timestamp: `2026-04-19T08:00:01Z` (container restart sequence).
- Git commit at deploy base: `e678923` plus local uncommitted working-tree changes included in that Docker build.

## 11) Eventual consistency / read replicas

- Reads/writes for usage counters use the same Redis instance.
- No read replica layer is used for these usage reads.
- No replication lag expected in this single-node setup.

## 12) Temporary debug freshness field

Added and active:
- `updatedAt` in usage payload (changes on each fresh response and after mutations).

This is present on both `/users/me/usage` and `/subscriptions/status` responses.

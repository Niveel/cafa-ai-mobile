# CAFA AI Guest Mode Frontend Integration Guide

Version: `2026-04-06`  
Base URL: `http://<YOUR_BACKEND_IP>:5000/api/v1`

This is a frontend implementation guide for Web + Mobile with a safe default for platforms that do not reliably support response streaming from `fetch`.

## 1) What Is Available in Guest Mode

- Guest chat is available via `/api/v1/guest/*`.
- Image generation requires login.
- Video generation requires login.
- Voice features require login.
- Guest model: `gpt-4o-mini` only.

## 2) Endpoints You Should Use

1. `POST /api/v1/guest/session`
2. `POST /api/v1/guest/chat`
3. `GET /api/v1/guest/chat`
4. `GET /api/v1/guest/chat/:conversationId`
5. `POST /api/v1/guest/chat/:conversationId/messages`
6. `POST /api/v1/guest/upgrade/claim`

## 3) Required Headers

- Guest endpoints:
  - `Authorization: Bearer <guestSessionToken>`
- Optional but recommended for send-message retries:
  - `Idempotency-Key: <uuid>`
- Upgrade claim endpoint:
  - `Authorization: Bearer <userAccessToken>`
  - `X-Guest-Session: <guestSessionToken>`

## 4) Critical Streaming Rule (Important)

`POST /guest/chat/:id/messages` supports both streaming and non-stream modes.

Backend behavior:
1. If `stream` is explicitly present in JSON body, backend uses it.
2. If `stream` is omitted, backend streams only when `Accept: text/event-stream` is sent.
3. Otherwise backend returns JSON.

## 5) Mobile-Safe Default

Use non-stream mode on mobile unless you use an SSE-capable client.

Request:
```http
POST /api/v1/guest/chat/:conversationId/messages
Content-Type: application/json
Authorization: Bearer <guestSessionToken>
Idempotency-Key: <uuid>
```

Body:
```json
{
  "message": "Hello",
  "stream": false
}
```

Success response (`200`):
```json
{
  "success": true,
  "data": {
    "conversationId": "69d31902bf58c32fc040b862",
    "requestId": "fb5c5f79-e84b-4c0f-a730-1566aee5e7a3",
    "message": {
      "_id": "69d31902bf58c32fc040b866",
      "role": "assistant",
      "content": "Hello ...",
      "attachments": [],
      "reactions": { "liked": false, "disliked": false },
      "tokens": 216,
      "createdAt": "2026-04-06T02:22:58.578Z"
    }
  }
}
```

## 6) Web Streaming Mode

For web clients that support SSE response parsing:

Headers:
- `Accept: text/event-stream`
- `Authorization: Bearer <guestSessionToken>`
- `Content-Type: application/json`

Body:
```json
{
  "message": "Hello",
  "stream": true
}
```

SSE payload sequence (`data: <json>`):
1. `meta`
2. one or more `delta`
3. `done`

Error mid-stream:
- `error` event payload

## 7) Error Handling Contract

`401 GUEST_AUTH_REQUIRED`
```json
{
  "success": false,
  "error": "GUEST_AUTH_REQUIRED",
  "code": "GUEST_AUTH_REQUIRED",
  "message": "Missing or invalid guest Authorization header"
}
```

`401 GUEST_TOKEN_INVALID`
```json
{
  "success": false,
  "error": "GUEST_TOKEN_INVALID",
  "code": "GUEST_TOKEN_INVALID",
  "message": "Guest session token is invalid or expired"
}
```

`403 GUEST_MODEL_NOT_ALLOWED`
```json
{
  "success": false,
  "error": "GUEST_MODEL_NOT_ALLOWED",
  "code": "GUEST_MODEL_NOT_ALLOWED",
  "message": "Guest mode only supports model \"gpt-4o-mini\""
}
```

`409 IDEMPOTENCY_IN_PROGRESS`
```json
{
  "success": false,
  "error": "IDEMPOTENCY_IN_PROGRESS",
  "code": "IDEMPOTENCY_IN_PROGRESS",
  "message": "A request with this Idempotency-Key is already in progress"
}
```

`429 GUEST_DAILY_LIMIT_EXCEEDED`
```json
{
  "success": false,
  "error": "GUEST_DAILY_LIMIT_EXCEEDED",
  "code": "GUEST_DAILY_LIMIT_EXCEEDED",
  "message": "Guest message limit of 30 reached. Resets in X hour(s)."
}
```

## 8) Recommended Client Strategy

1. Create guest session once on app launch.
2. Reuse stored `guestSessionToken` until `401 GUEST_TOKEN_INVALID`.
3. On token invalid: call `/guest/session` again and retry once.
4. Default to `{ stream: false }` on mobile.
5. For web, use streaming only if your SSE parser is confirmed working.
6. Use `Idempotency-Key` on every send to prevent duplicates on retries.

## 9) Troubleshooting

If you see `Missing response stream from guest chat`:
1. You expected stream but got JSON.
2. Force non-stream with `"stream": false`.
3. Or send `Accept: text/event-stream` and use an SSE-capable client.

If you see `Network request failed`:
1. Verify phone and backend machine are on same LAN.
2. Use machine LAN IP (not localhost) in mobile base URL.
3. Confirm firewall allows inbound port `5000`.
4. For Android debug over HTTP, ensure cleartext traffic is allowed.


# CAFA AI Guest Mode API Guide (Web + Mobile)

Version: `v1`  
Base URL: `/api/v1`  
Status: implemented in backend

## 1) Product Behavior

### Authenticated chat endpoints (`/chat`) for unauthenticated callers
- Unauthenticated users **cannot** use real model via `/api/v1/chat*`.
- Behavior: `401` JSON error from auth middleware.

### Guest mode behavior
- Guest users **can** use real model via dedicated `/api/v1/guest/*` endpoints.
- Guest limits:
1. Max messages/day/session: `30` (rolling 24-hour window)
2. Max guest conversations/session: `20`
3. Model restriction: `gpt-4o-mini` only
4. Features disabled for guest: attachments, image generation, video generation, voice
- Streaming: supported (`SSE`) and non-stream supported (`"stream": false`).

---

## 2) Existing Chat Endpoint Contract (Unauthenticated)

These endpoints require authenticated user bearer token and are disallowed for guests:

1. `POST /api/v1/chat`
2. `POST /api/v1/chat/:conversationId/messages` (backend route param name is `:id`)
3. `GET /api/v1/chat`
4. `GET /api/v1/chat/:conversationId` (backend route param name is `:id`)

### Error response (missing/invalid auth header)
Status: `401`
```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "code": "UNAUTHORIZED",
  "message": "Missing or invalid Authorization header"
}
```

### Error response (expired/invalid user token)
Status: `401`
```json
{
  "success": false,
  "error": "TOKEN_EXPIRED",
  "code": "TOKEN_EXPIRED",
  "message": "Access token is invalid or expired"
}
```

---

## 3) Guest Architecture Pattern

Implemented pattern: **separate guest endpoints**.

### Session token
- Issue endpoint: `POST /api/v1/guest/session`
- Returns a signed guest session token (JWT-like bearer token).
- Guest endpoints require this token in `Authorization: Bearer <guestSessionToken>`.

### Persistence
- Guest conversations are stored in MongoDB collection `GuestConversation`.
- TTL policy: 24 hours (`expiresAt` with TTL index).
- TTL is refreshed on new message writes.

### Abuse protection
- HTTP rate limiters:
1. Session issuance: `20 req/min` per IP (`/guest/session`)
2. Guest message send: `30 req/min` per IP (`/guest/chat/:id/messages`)
- Usage limit: `30` guest messages per 24-hour window per guest session (Redis counter).

### Upgrade path
- Endpoint: `POST /api/v1/guest/upgrade/claim`
- Merges guest conversations into authenticated user account.
- On success, guest conversations are migrated then removed from guest store.

---

## 4) Guest Endpoints

## `POST /api/v1/guest/session`
Create guest session token.

Authentication: none

Success `201`:
```json
{
  "success": true,
  "data": {
    "guestSessionToken": "<token>",
    "sessionId": "<uuid>",
    "expiresAt": "2026-04-06T20:00:00.000Z",
    "limits": {
      "maxMessagesPerDay": 30,
      "maxConversations": 20,
      "maxMessageLength": 10000,
      "allowedModels": ["gpt-4o-mini"]
    },
    "features": {
      "streaming": true,
      "attachments": false,
      "imageGeneration": false,
      "videoGeneration": false,
      "voice": false
    }
  },
  "message": "Guest session created"
}
```

---

## `POST /api/v1/guest/chat`
Create a guest conversation.

Authentication: guest token in `Authorization`

Body:
```json
{
  "title": "Optional title"
}
```

Success `201`:
```json
{
  "success": true,
  "data": {
    "conversationId": "67f0b1a3b6c9f7a0d2b1f333",
    "title": "Optional title",
    "aiModel": "gpt-4o-mini",
    "expiresAt": "2026-04-06T20:00:00.000Z"
  },
  "message": "Guest conversation created"
}
```

Limit reached `429`:
```json
{
  "success": false,
  "error": "GUEST_CONVERSATION_LIMIT_REACHED",
  "code": "GUEST_CONVERSATION_LIMIT_REACHED",
  "message": "Guest conversation limit of 20 reached. Create an account to keep more conversations."
}
```

---

## `GET /api/v1/guest/chat`
List guest conversations for current guest session.

Authentication: guest token in `Authorization`

Success `200`:
```json
{
  "success": true,
  "data": [
    {
      "_id": "67f0b1a3b6c9f7a0d2b1f333",
      "title": "Trip plan",
      "aiModel": "gpt-4o-mini",
      "lastMessagePreview": "Here are 3 options...",
      "totalTokens": 228,
      "createdAt": "2026-04-05T20:00:00.000Z",
      "updatedAt": "2026-04-05T20:12:00.000Z",
      "expiresAt": "2026-04-06T20:12:00.000Z"
    }
  ]
}
```

---

## `GET /api/v1/guest/chat/:conversationId`
Get one guest conversation with messages.

Authentication: guest token in `Authorization`

Success `200`:
```json
{
  "success": true,
  "data": {
    "_id": "67f0b1a3b6c9f7a0d2b1f333",
    "title": "Trip plan",
    "aiModel": "gpt-4o-mini",
    "totalTokens": 228,
    "lastMessagePreview": "Here are 3 options...",
    "messages": [
      {
        "_id": "67f0b1a3b6c9f7a0d2b1f444",
        "role": "user",
        "content": "Plan 3 days in Lisbon",
        "attachments": [],
        "reactions": { "liked": false, "disliked": false },
        "createdAt": "2026-04-05T20:01:00.000Z"
      },
      {
        "_id": "67f0b1a3b6c9f7a0d2b1f445",
        "role": "assistant",
        "content": "Absolutely. Day 1...",
        "attachments": [],
        "reactions": { "liked": false, "disliked": false },
        "createdAt": "2026-04-05T20:01:05.000Z"
      }
    ],
    "createdAt": "2026-04-05T20:00:00.000Z",
    "updatedAt": "2026-04-05T20:12:00.000Z",
    "expiresAt": "2026-04-06T20:12:00.000Z"
  }
}
```

Not found `404`:
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "code": "NOT_FOUND",
  "message": "Conversation not found"
}
```

---

## `POST /api/v1/guest/chat/:conversationId/messages`
Send guest message.

Authentication: guest token in `Authorization`

Body:
```json
{
  "message": "Tell me about Iceland in summer",
  "stream": true,
  "model": "gpt-4o-mini"
}
```

Notes:
- `message` or `content` accepted.
- `stream` default is `true`.
- `model` optional; if provided must be `gpt-4o-mini`.
- `Idempotency-Key` header supported.

### Stream success (`stream: true`)
Status: `200`, content type: `text/event-stream`

SSE event payloads (`data: {...}`):
```json
{"type":"meta","model":"gpt-4o-mini","messageId":"<draftMessageId>","requestId":"<uuid>","timestamp":"2026-04-05T20:00:00.000Z"}
{"type":"delta","content":"Iceland in summer is","requestId":"<uuid>","timestamp":"2026-04-05T20:00:00.100Z"}
{"type":"done","tokens":123,"messageId":"<assistantMessageId>","requestId":"<uuid>","timestamp":"2026-04-05T20:00:01.200Z"}
```

### Non-stream success (`stream: false`)
Status: `200`
```json
{
  "success": true,
  "data": {
    "conversationId": "67f0b1a3b6c9f7a0d2b1f333",
    "requestId": "<uuid>",
    "message": {
      "_id": "67f0b1a3b6c9f7a0d2b1f445",
      "role": "assistant",
      "content": "Iceland in summer offers...",
      "attachments": [],
      "reactions": { "liked": false, "disliked": false },
      "tokens": 123,
      "createdAt": "2026-04-05T20:00:01.200Z"
    }
  }
}
```

### Rate limit reached (`guest daily limit`)
Status: `429`
```json
{
  "success": false,
  "error": "GUEST_DAILY_LIMIT_EXCEEDED",
  "code": "GUEST_DAILY_LIMIT_EXCEEDED",
  "message": "Guest message limit of 30 reached. Resets in 24 hour(s)."
}
```

### Feature/model not allowed
Status: `403`
```json
{
  "success": false,
  "error": "GUEST_MODEL_NOT_ALLOWED",
  "code": "GUEST_MODEL_NOT_ALLOWED",
  "message": "Guest mode only supports model \"gpt-4o-mini\""
}
```

### Idempotency in progress
Status: `409`
```json
{
  "success": false,
  "error": "IDEMPOTENCY_IN_PROGRESS",
  "code": "IDEMPOTENCY_IN_PROGRESS",
  "message": "A request with this Idempotency-Key is already in progress"
}
```

### Idempotent replay
Status: `200`
```json
{
  "success": true,
  "data": {
    "replayed": true,
    "messageId": "<assistantMessageId>",
    "requestId": "<uuid>"
  },
  "message": "Idempotent replay"
}
```

---

## `POST /api/v1/guest/upgrade/claim`
Merge guest conversations into authenticated account.

Authentication:
1. User auth token in `Authorization: Bearer <userAccessToken>`
2. Guest token in `X-Guest-Session: <guestSessionToken>`

Success `200`:
```json
{
  "success": true,
  "data": {
    "migratedConversations": 2,
    "migratedMessages": 14
  },
  "message": "Guest conversations migrated"
}
```

No guest data `200`:
```json
{
  "success": true,
  "data": {
    "migratedConversations": 0,
    "migratedMessages": 0
  },
  "message": "No guest conversations found"
}
```

---

## 5) Canonical Error Shapes

### Auth required (guest endpoint)
Status: `401`
```json
{
  "success": false,
  "error": "GUEST_AUTH_REQUIRED",
  "code": "GUEST_AUTH_REQUIRED",
  "message": "Missing or invalid guest Authorization header"
}
```

### Guest token invalid/expired
Status: `401`
```json
{
  "success": false,
  "error": "GUEST_TOKEN_INVALID",
  "code": "GUEST_TOKEN_INVALID",
  "message": "Guest session token is invalid or expired"
}
```

### Generic failure
Status: `500`
```json
{
  "success": false,
  "error": "INTERNAL_ERROR",
  "code": "INTERNAL_ERROR",
  "message": "Internal server error"
}
```

---

## 6) Frontend Integration Requirements

### Required headers

Authenticated `/chat*`:
- `Authorization: Bearer <userAccessToken>`

Guest `/guest/chat*`:
- `Authorization: Bearer <guestSessionToken>`

Guest upgrade claim:
- `Authorization: Bearer <userAccessToken>`
- `X-Guest-Session: <guestSessionToken>`

Optional for `POST /guest/chat/:id/messages`:
- `Idempotency-Key: <client-generated-uuid>`

### CORS
- Allowed headers include:
1. `Content-Type`
2. `Authorization`
3. `X-Requested-With`
4. `Idempotency-Key`
5. `X-Guest-Session`

### Retry guidance
1. `401 GUEST_TOKEN_INVALID` or expired: request new guest session token and retry once.
2. `401 UNAUTHORIZED` on authenticated endpoints: refresh auth token, retry once.
3. `429`: exponential backoff + jitter; respect `Retry-After` when present.
4. SSE disconnect before `done`: retry once with same `Idempotency-Key` to prevent duplicate assistant replies.

### Idempotency guidance
1. Scope key per `conversationId`.
2. Reuse same key only for retrying the exact same request.
3. Generate a new key for each new user intent.

### SSE event format
`data: <json>\n\n` where `<json>` is one of:
1. `meta`: `{ type, model, messageId, requestId, timestamp }`
2. `delta`: `{ type, content, requestId, timestamp }`
3. `done`: `{ type, tokens, messageId, requestId, timestamp }`
4. `error`: `{ type, code?, message, requestId, timestamp }`


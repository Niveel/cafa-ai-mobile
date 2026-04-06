# Frontend Guide: New Backend Endpoints

Base URL: `/api/v1`

All endpoints below require `Authorization: Bearer <accessToken>` unless marked otherwise.

## 1) Rename Conversation

`PATCH /chat/:id`

Request:
```json
{ "title": "Project Budget Draft" }
```

Success `200`:
```json
{
  "success": true,
  "data": {
    "_id": "conversationId",
    "title": "Project Budget Draft",
    "updatedAt": "2026-03-22T12:00:00.000Z"
  },
  "message": "Conversation updated"
}
```

Common errors:
- `404 NOT_FOUND`
- `409 CONVERSATION_ARCHIVED`
- `400 VALIDATION_ERROR`

## 2) Paginated Messages

`GET /chat/:id/messages?page=1&limit=50&before=<messageId>`

- `before` returns only messages older than that message.
- Messages are returned newest-first within each page.

Success `200`:
```json
{
  "success": true,
  "data": [
    {
      "_id": "msgId",
      "role": "assistant",
      "content": "Hello!",
      "attachments": [
        {
          "id": "msgId:0",
          "url": "https://api.example.com/uploads/a.png",
          "mimeType": "image/png",
          "size": 12345,
          "originalName": "a.png",
          "thumbnailUrl": "https://api.example.com/uploads/a.png"
        }
      ],
      "reactions": { "liked": false, "disliked": false },
      "createdAt": "2026-03-22T10:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 320, "pages": 7 }
}
```

Common errors:
- `404 NOT_FOUND` (conversation or `before` message not found)
- `400 VALIDATION_ERROR`

## 3) Cancel In-Progress Generation

`POST /chat/:id/messages/:messageId/cancel`

Success `200` (cancelled):
```json
{
  "success": true,
  "data": { "cancelled": true, "messageId": "assistantDraftId" },
  "message": "Generation cancelled"
}
```

Success `200` (nothing active):
```json
{
  "success": true,
  "data": { "cancelled": false, "messageId": "assistantDraftId" },
  "message": "No active generation found for this message"
}
```

## 4) Regenerate Assistant Message (SSE)

`POST /chat/:id/messages/:messageId/regenerate`

Request:
```json
{ "mode": "replace" }
```

`mode` values:
- `replace` (default): rewrites target assistant message
- `append`: inserts a new assistant message after the target

SSE events now follow a stable envelope:
```json
{ "type": "meta", "requestId": "uuid", "timestamp": "ISO", "model": "gpt-4o", "messageId": "assistantDraftId" }
{ "type": "delta", "requestId": "uuid", "timestamp": "ISO", "content": "..." }
{ "type": "done", "requestId": "uuid", "timestamp": "ISO", "tokens": 142, "messageId": "assistantDraftId" }
{ "type": "error", "requestId": "uuid", "timestamp": "ISO", "message": "Generation cancelled", "code": "GENERATION_CANCELLED" }
```

Common errors:
- `400 INVALID_TARGET`
- `404 NOT_FOUND`
- `409 CONVERSATION_ARCHIVED`

## 5) Edit User Message

`PATCH /chat/:id/messages/:messageId`

Request:
```json
{ "content": "Updated user prompt" }
```

Success `200`:
```json
{
  "success": true,
  "data": {
    "message": { "_id": "messageId", "role": "user", "content": "Updated user prompt" },
    "replacedAssistantMessageIds": ["oldAssistantMsgId"]
  },
  "message": "Message updated"
}
```

Behavior:
- Message must be a user message.
- Edit window is 30 minutes from message creation.
- All trailing assistant messages are removed from that point.

Common errors:
- `409 MESSAGE_EDIT_WINDOW_EXPIRED`
- `400 INVALID_TARGET`
- `404 NOT_FOUND`
- `409 CONVERSATION_ARCHIVED`

## 6) Archive / Unarchive Conversation

`PATCH /chat/:id/archive`

Request:
```json
{ "isArchived": true }
```

Success `200`:
```json
{
  "success": true,
  "data": { "_id": "conversationId", "isArchived": true, "updatedAt": "2026-03-22T12:00:00.000Z" },
  "message": "Conversation archived"
}
```

## 7) Conversation Search

`GET /chat/search?q=keyword&page=1&limit=20`

Success `200`: same conversation list shape as `GET /chat`, with pagination.

Common errors:
- `400 SEARCH_QUERY_TOO_SHORT` (`q` must be at least 2 characters)
- `400 VALIDATION_ERROR`

## 8) Model Metadata

`GET /models` (public)

Success `200`:
```json
{
  "success": true,
  "data": {
    "chat": [
      { "id": "gpt-4o-mini", "tiers": ["free", "cafa_smart"] },
      { "id": "gpt-4o", "tiers": ["cafa_pro", "cafa_max"] }
    ],
    "image": [
      { "id": "fal-ai/flux/schnell", "tiers": ["cafa_smart"] },
      { "id": "fal-ai/flux-pro", "tiers": ["cafa_pro", "cafa_max"] }
    ]
  }
}
```

## 9) Export Conversation

`GET /chat/:id/export?format=markdown|pdf`

- `format=markdown` returns downloadable `.md`
- `format=pdf` returns downloadable `.pdf`

Common errors:
- `404 NOT_FOUND`
- `400 VALIDATION_ERROR`

## 10) Usage Timeseries

`GET /users/me/usage/timeseries?window=30d`

`window` values: `7d`, `30d`, `90d`

Success `200`:
```json
{
  "success": true,
  "data": {
    "window": "30d",
    "startDate": "2026-02-21T00:00:00.000Z",
    "endDate": "2026-03-22T23:59:59.999Z",
    "series": [
      { "date": "2026-03-20", "chatMessages": 4, "imageGenerations": 1 },
      { "date": "2026-03-21", "chatMessages": 2, "imageGenerations": 0 }
    ]
  }
}
```

Common errors:
- `400 VALIDATION_ERROR`

## 11) Idempotency for Send Message

`POST /chat/:id/messages`

Optional header:
```http
Idempotency-Key: a-unique-client-key
```

Duplicate key behavior:
- If prior request completed:
```json
{
  "success": true,
  "data": { "replayed": true, "messageId": "assistantMessageId", "requestId": "uuid" },
  "message": "Idempotent replay"
}
```
- If prior request is still running:
```json
{
  "success": false,
  "error": "IDEMPOTENCY_IN_PROGRESS",
  "message": "A request with this Idempotency-Key is already in progress"
}
```

## 12) Rate Limit Headers

Rate-limited responses now include both:
- `RateLimit-*` headers
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`


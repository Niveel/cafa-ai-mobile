# Backend Endpoint Requests for ChatGPT-class Frontend

This file lists API additions and clarifications needed to support a production-grade chat UX with minimal frontend workarounds.

## 1. Priority Definitions
- P0: Needed for smooth core chat UX and reliability.
- P1: Strongly recommended for polished product behavior.
- P2: Nice-to-have for analytics and long-term optimization.

## 2. Existing Endpoints Already Covered

From `docs/API_DOCUMENTATION.md`, we already have:
- Auth lifecycle, session refresh, profile, usage.
- Conversation create/list/get/delete.
- Message send with SSE stream (`delta`/`done`/`error`).
- Message reactions.
- Image generation/history/delete.
- Subscription checkout/portal/status.
- Voice transcribe/synthesize/voices.

## 3. Requested Additional Endpoints

## P0 Requests

### 3.1 Rename Conversation
- Method: `PATCH /api/v1/chat/:id`
- Purpose: Rename title without creating new conversation.
- Request:
```json
{ "title": "Project Budget Draft" }
```
- Response:
```json
{
  "success": true,
  "data": {
    "_id": "conversationId",
    "title": "Project Budget Draft",
    "updatedAt": "2026-03-20T12:00:00.000Z"
  },
  "message": "Conversation updated"
}
```

### 3.2 Cancel In-progress Stream
- Method: `POST /api/v1/chat/:id/messages/:messageId/cancel`
- Purpose: Support a Stop button while assistant is generating.
- Request: empty body
- Response:
```json
{
  "success": true,
  "data": { "cancelled": true, "messageId": "assistantDraftId" },
  "message": "Generation cancelled"
}
```

### 3.3 Retry / Regenerate Assistant Response
- Method: `POST /api/v1/chat/:id/messages/:messageId/regenerate`
- Purpose: Regenerate an assistant message from same prior context.
- Request:
```json
{ "mode": "replace" }
```
- Response: SSE stream (same shape as message send) or a JSON job handle if async.

### 3.4 Paginated Conversation Messages
- Method: `GET /api/v1/chat/:id/messages?page=1&limit=50&before=<messageId>`
- Purpose: Efficient loading for very long chat histories.
- Response:
```json
{
  "success": true,
  "data": [
    {
      "_id": "msgId",
      "role": "assistant",
      "content": "...",
      "attachments": [],
      "reactions": { "liked": false, "disliked": false },
      "createdAt": "2026-03-20T10:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 320, "pages": 7 }
}
```

## P1 Requests

### 3.5 Edit User Message + Re-run
- Method: `PATCH /api/v1/chat/:id/messages/:messageId`
- Purpose: Enable "Edit and resend" workflow.
- Request:
```json
{ "content": "Updated user prompt" }
```
- Response:
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

### 3.6 Archive/Unarchive Conversations Explicitly
- Method: `PATCH /api/v1/chat/:id/archive`
- Request:
```json
{ "isArchived": true }
```
- Purpose: More explicit than delete-only semantics and enables restore UI.

### 3.7 Conversation Search Endpoint
- Method: `GET /api/v1/chat/search?q=keyword&page=1&limit=20`
- Purpose: Fast sidebar search over titles and previews.

### 3.8 Model Metadata Endpoint
- Method: `GET /api/v1/models`
- Purpose: Frontend can show current model capabilities by tier.
- Response:
```json
{
  "success": true,
  "data": {
    "chat": [
      { "id": "gpt-4o-mini", "tiers": ["free", "cafa_smart"] },
      { "id": "gpt-4o", "tiers": ["cafa_pro", "cafa_max"] }
    ],
    "image": [
      { "id": "fal-ai/flux-schnell", "tiers": ["cafa_smart"] },
      { "id": "fal-ai/flux-pro", "tiers": ["cafa_pro", "cafa_max"] }
    ]
  }
}
```

## P2 Requests

### 3.9 Export Conversation
- Method: `GET /api/v1/chat/:id/export?format=markdown|pdf`
- Purpose: User can export work for compliance/reporting.

### 3.10 Usage Analytics Timeseries
- Method: `GET /api/v1/users/me/usage/timeseries?window=30d`
- Purpose: Better subscription dashboard and growth insights.

### 3.11 Avatar Upload Endpoint
- Method: `POST /api/v1/users/me/avatar`
- Purpose: Support first-class profile avatar upload from frontend (file upload), then persist returned URL in user profile.
- Request: `multipart/form-data` with field `avatar` (single image file)
- Constraints:
  - Max size: 5 MB
  - Allowed mime types: `image/jpeg`, `image/png`, `image/webp`
- Success response:
```json
{
  "success": true,
  "data": {
    "avatar": "https://cdn.example.com/avatars/user-123.jpg"
  },
  "message": "Avatar uploaded successfully"
}
```
- Frontend follow-up:
  - Either endpoint directly updates user profile avatar,
  - or frontend calls `PATCH /api/v1/users/me` with returned `avatar` URL.

## 4. Contract Clarifications Needed

### 4.1 SSE Event Contract
Please confirm whether SSE may include additional event types in future.
Suggested stable envelope:
```json
{ "type": "delta|done|error|meta", "requestId": "uuid", "timestamp": "ISO" }
```

### 4.2 Attachments in Chat Messages
Please confirm exact response shape for message attachments in `GET /chat/:id` and paginated messages, including:
- file id
- url
- mimeType
- size
- originalName
- thumbnailUrl (optional)

### 4.3 Rate Limit Headers
Please include standard headers for better frontend UX:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

### 4.4 Idempotency for Message Send
For network retries, support optional `Idempotency-Key` header for `POST /chat/:id/messages`.

## 5. Error Codes to Add (If New Endpoints Are Added)
- `GENERATION_CANCELLED`
- `MESSAGE_EDIT_WINDOW_EXPIRED`
- `CONVERSATION_ARCHIVED`
- `SEARCH_QUERY_TOO_SHORT`

## 6. Success Criteria
Backend readiness for frontend launch is achieved when:
- P0 endpoints are implemented or explicitly declined with alternatives.
- SSE contract is finalized and versioned.
- Attachment schema and pagination schema are stable.
- Rate limit signaling is available for UI.

# Cafa AI — API Documentation

Complete reference for all backend endpoints. Intended for the frontend developer.

---

## Table of Contents

1. [Base URL & Versioning](#base-url--versioning)
2. [Authentication Overview](#authentication-overview)
3. [SSE Streaming](#sse-streaming)
4. [File Uploads](#file-uploads)
5. [Subscription Tiers](#subscription-tiers)
6. [Error Codes Reference](#error-codes-reference)
7. [Auth Endpoints](#auth-endpoints)
8. [Chat Endpoints](#chat-endpoints)
9. [Image Generation Endpoints](#image-generation-endpoints)
10. [Subscription Endpoints](#subscription-endpoints)
11. [User Profile Endpoints](#user-profile-endpoints)
12. [Voice Endpoints](#voice-endpoints)

---

## Base URL & Versioning

```
Development:  http://localhost:5000/api/v1
Production:   https://your-domain.com/api/v1
```

All endpoints are prefixed with `/api/v1`. The version is controlled by the `API_VERSION` environment variable.

A health check endpoint is available at:

```
GET /api/v1/health
```

Response:
```json
{
  "status": "ok",
  "service": "Cafa AI API",
  "version": "1.0.0",
  "timestamp": "2026-03-20T10:00:00.000Z",
  "uptime": 3600.5
}
```

---

## Authentication Overview

The API uses **JWT Bearer tokens** for authentication.

### How to authenticate

1. Register or login to receive an `accessToken`
2. Include it in the `Authorization` header on every protected request:

```
Authorization: Bearer <accessToken>
```

### Token lifetimes

| Token | Lifetime | Storage |
|-------|----------|---------|
| Access Token | 15 minutes | Memory / localStorage |
| Refresh Token | 7 days | HttpOnly cookie (`refreshToken`) |

### Refreshing the access token

When you receive a `401 TOKEN_EXPIRED` error, call `POST /api/v1/auth/refresh-token`. The refresh token is automatically sent via the HttpOnly cookie — no manual handling needed.

```javascript
// Axios interceptor example
axios.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && error.response?.data?.error === 'TOKEN_EXPIRED') {
      await axios.post('/api/v1/auth/refresh-token', {}, { withCredentials: true });
      // retry original request with new token from response
    }
    return Promise.reject(error);
  }
);
```

> **Important:** Always send requests with `withCredentials: true` (or `credentials: 'include'` in fetch) so the browser forwards the refresh token cookie.

---

## SSE Streaming

Chat message responses use **Server-Sent Events (SSE)**. The response streams tokens in real time.

### How it works

1. Send `POST /api/v1/chat/:id/messages` with `multipart/form-data`
2. The server responds with `Content-Type: text/event-stream`
3. Read events as they arrive — each `data:` line is a JSON object
4. The stream ends with a `done` event, then the connection closes

### Event shapes

```typescript
// A chunk of the AI response
{ "type": "delta", "content": "Hello" }

// Stream complete — includes token usage and the saved message ID
{ "type": "done", "tokens": 142, "messageId": "665f1a2b3c4d5e6f7a8b9c0d" }

// Unrecoverable error mid-stream
{ "type": "error", "message": "The AI response failed. Please try again." }
```

### JavaScript example

```javascript
async function sendMessage(conversationId, messageText, files = []) {
  const formData = new FormData();
  formData.append('message', messageText);
  files.forEach((file) => formData.append('files', file));

  const response = await fetch(`/api/v1/chat/${conversationId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
    credentials: 'include',
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete last line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const event = JSON.parse(line.slice(6));

      if (event.type === 'delta') {
        // append event.content to your message UI
      } else if (event.type === 'done') {
        // event.tokens = total tokens used
        // event.messageId = MongoDB ID of the saved assistant message
      } else if (event.type === 'error') {
        // show error.message to the user
      }
    }
  }
}
```

> **Note:** Tiers `free` and `cafa_smart` support streaming. The same SSE format is used for all tiers.

---

## File Uploads

The send message endpoint uses `multipart/form-data` for file attachments.

### Constraints

| Property | Limit |
|----------|-------|
| Max file size | 10 MB per file |
| Max files per message | 5 |
| Allowed image types | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Allowed document types | `application/pdf`, `text/plain`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Documents | Cafa Pro and Cafa Max only |

### JavaScript example

```javascript
const formData = new FormData();
formData.append('message', 'Please review this document');
formData.append('files', pdfFile);        // File object from <input type="file">
formData.append('files', screenshotFile); // multiple files OK

const response = await fetch(`/api/v1/chat/${conversationId}/messages`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
  // Do NOT set Content-Type manually — the browser sets it with the boundary
  body: formData,
  credentials: 'include',
});
```

---

## Subscription Tiers

| Tier | Chat / day | Images / day | Chat model | Image model | Documents | Streaming |
|------|-----------|-------------|-----------|-------------|-----------|-----------|
| `free` | 10 | — | gpt-4o-mini | — | No | Yes |
| `cafa_smart` | 100 | 5 | gpt-4o-mini | FLUX Schnell | No | Yes |
| `cafa_pro` | 500 | 20 | gpt-4o | FLUX Pro | Yes | Yes |
| `cafa_max` | Unlimited | 50 | gpt-4o | FLUX Pro | Yes | Yes |

Image generation is disabled on the `free` tier. Attempting to call image endpoints as a free user returns `403 UPGRADE_REQUIRED`.

---

## Error Codes Reference

All error responses follow this shape:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

Validation errors include an additional `errors` array:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "errors": [
    { "field": "email", "msg": "A valid email address is required" }
  ]
}
```

### Error code table

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | One or more request fields failed validation |
| `EMPTY_MESSAGE` | 400 | Chat message has no text and no files |
| `MESSAGE_TOO_LONG` | 400 | Chat message exceeds 10 000 characters |
| `ALREADY_VERIFIED` | 400 | Email is already verified |
| `OTP_EXPIRED` | 400 | OTP has expired (10-min window for verify, 15-min for reset) |
| `OTP_INVALID` | 400 | OTP is incorrect |
| `NO_SUBSCRIPTION` | 400 | User has no Stripe customer record |
| `UNAUTHORIZED` | 401 | Missing or invalid `Authorization` header |
| `TOKEN_EXPIRED` | 401 | Access token is expired — refresh it |
| `INVALID_TOKEN` | 401 | Refresh token is invalid or expired |
| `MISSING_TOKEN` | 401 | No refresh token provided |
| `INVALID_CREDENTIALS` | 401 | Email or password is wrong |
| `INVALID_PASSWORD` | 401 | Current password verification failed |
| `EMAIL_NOT_VERIFIED` | 403 | Login attempted on unverified account |
| `UPGRADE_REQUIRED` | 403 | Feature requires a higher subscription tier |
| `NOT_FOUND` | 404 | Resource does not exist or does not belong to this user |
| `USER_NOT_FOUND` | 404 | No account found with the given email |
| `EMAIL_EXISTS` | 409 | Registration attempted with an already-used email |
| `DUPLICATE_KEY` | 409 | Database unique constraint violation |
| `DAILY_LIMIT_EXCEEDED` | 429 | Daily chat or image quota exhausted |
| `MISSING_SIGNATURE` | 400 | Stripe webhook `stripe-signature` header missing |
| `INVALID_TARGET` | 400 | Reaction applied to a non-assistant message |
| `MISSING_FILE` | 400 | Audio file not attached to transcription request |
| `INVALID_FILE_TYPE` | 400 | Unsupported audio format |
| `VOICE_SERVICE_UNAVAILABLE` | 503 | Voice microservice is down or models not loaded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Auth Endpoints

Base path: `/api/v1/auth`

---

### POST /api/v1/auth/register

Creates a new unverified user account and sends a 6-digit OTP to their email. The user cannot log in until they verify their email via `/verify-otp`.

**Authentication required:** No

**Request body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | Max 100 characters |
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | Min 8 chars, must contain uppercase, lowercase, and a digit |

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "SecurePass1"
}
```

**Success — 201:**

```json
{
  "success": true,
  "data": { "userId": "665f1a2b3c4d5e6f7a8b9c0d" },
  "message": "Verification code sent to your email"
}
```

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `VALIDATION_ERROR` | 400 | Invalid fields |
| `EMAIL_EXISTS` | 409 | Email already registered |

---

### POST /api/v1/auth/verify-otp

Verifies the 6-digit OTP sent to the user's email. On success, marks the account as verified and issues tokens.

**Authentication required:** No

**Request body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string | Yes | Must match a registered account |
| `otp` | string | Yes | Exactly 6 digits |

```json
{
  "email": "jane@example.com",
  "otp": "482916"
}
```

**Success — 200:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "isVerified": true,
      "subscription": {
        "tier": "free",
        "status": "inactive"
      },
      "createdAt": "2026-03-20T10:00:00.000Z"
    }
  },
  "message": "Email verified successfully"
}
```

The refresh token is set as an HttpOnly cookie named `refreshToken`.

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `VALIDATION_ERROR` | 400 | Invalid fields |
| `ALREADY_VERIFIED` | 400 | Email already verified |
| `OTP_EXPIRED` | 400 | OTP window elapsed |
| `OTP_INVALID` | 400 | Wrong OTP submitted |
| `USER_NOT_FOUND` | 404 | No account with that email |

---

### POST /api/v1/auth/resend-otp

Issues a fresh OTP to an unverified user. Rate-limited (strictLimiter).

**Authentication required:** No

**Request body:**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |

```json
{ "email": "jane@example.com" }
```

**Success — 200:**

```json
{
  "success": true,
  "data": null,
  "message": "Verification code sent to your email"
}
```

> Returns the same response whether or not the email exists — prevents email enumeration.

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `ALREADY_VERIFIED` | 400 | Account is already verified |

---

### POST /api/v1/auth/login

Authenticates a verified user and issues tokens.

If the user exists but their email is unverified, a fresh OTP is automatically sent and a `403 EMAIL_NOT_VERIFIED` error is returned.

**Authentication required:** No

**Request body:**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |
| `password` | string | Yes |

```json
{
  "email": "jane@example.com",
  "password": "SecurePass1"
}
```

**Success — 200:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "isVerified": true,
      "subscription": {
        "tier": "cafa_pro",
        "status": "active",
        "currentPeriodEnd": "2026-04-20T10:00:00.000Z"
      },
      "lastLoginAt": "2026-03-20T10:00:00.000Z",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  },
  "message": "Login successful"
}
```

The refresh token is set as an HttpOnly cookie.

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `EMAIL_NOT_VERIFIED` | 403 | Account not yet verified (new OTP sent automatically) |

---

### POST /api/v1/auth/logout

Revokes the refresh token and clears the cookie.

**Authentication required:** No (works even without a valid access token)

**Request body:** None required. The refresh token is read from the HttpOnly cookie. Alternatively pass it in the body:

```json
{ "refreshToken": "uuid-token-here" }
```

**Success — 200:**

```json
{
  "success": true,
  "data": null,
  "message": "Logged out successfully"
}
```

---

### POST /api/v1/auth/refresh-token

Validates the current refresh token, issues a new access token, and rotates the refresh token (old one is immediately invalidated).

**Authentication required:** No

**Request body:** None required if the cookie is present. Alternatively:

```json
{ "refreshToken": "uuid-token-here" }
```

**Success — 200:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

A new refresh token cookie is set.

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `MISSING_TOKEN` | 401 | No refresh token provided |
| `INVALID_TOKEN` | 401 | Token is invalid, expired, or already used |

---

### POST /api/v1/auth/forgot-password

Sends a password-reset OTP to the user's email. Rate-limited (strictLimiter).

**Authentication required:** No

**Request body:**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |

```json
{ "email": "jane@example.com" }
```

**Success — 200:**

```json
{
  "success": true,
  "data": null,
  "message": "If that email is registered, a reset code has been sent"
}
```

> Always returns the same response regardless of whether the email is registered.

---

### POST /api/v1/auth/reset-password

Verifies the reset OTP and updates the password. Invalidates all existing sessions.

**Authentication required:** No

**Request body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string | Yes | |
| `otp` | string | Yes | 6 digits |
| `newPassword` | string | Yes | Min 8 chars, uppercase + lowercase + digit |

```json
{
  "email": "jane@example.com",
  "otp": "739204",
  "newPassword": "NewSecurePass1"
}
```

**Success — 200:**

```json
{
  "success": true,
  "data": null,
  "message": "Password reset successfully. Please log in with your new password."
}
```

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `OTP_EXPIRED` | 400 | Reset OTP has expired (15-min window) |
| `OTP_INVALID` | 400 | Wrong OTP or unknown email |

---

### GET /api/v1/auth/me

Returns the authenticated user's profile. (Also available at `GET /api/v1/users/me`.)

**Authentication required:** Yes

**Success — 200:**

```json
{
  "success": true,
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "avatar": "https://example.com/avatar.jpg",
    "isVerified": true,
    "subscription": {
      "tier": "cafa_pro",
      "status": "active",
      "stripeCustomerId": "cus_xxx",
      "stripeSubscriptionId": "sub_xxx",
      "currentPeriodEnd": "2026-04-20T10:00:00.000Z"
    },
    "lastLoginAt": "2026-03-20T10:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-03-20T10:00:00.000Z"
  }
}
```

---

## Chat Endpoints

Base path: `/api/v1/chat`

All chat endpoints require authentication.

---

### POST /api/v1/chat

Creates a new empty conversation. The model assigned is determined by the user's subscription tier.

**Authentication required:** Yes

**Request body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | No | Custom title, max 200 chars. Defaults to `"New Conversation"` |

```json
{ "title": "Weekend recipe ideas" }
```

**Success — 201:**

```json
{
  "success": true,
  "data": {
    "conversationId": "665f1a2b3c4d5e6f7a8b9c0d",
    "title": "Weekend recipe ideas"
  },
  "message": "Conversation created"
}
```

---

### GET /api/v1/chat

Returns a paginated list of the user's active (non-archived) conversations. Does not include messages — use `GET /api/v1/chat/:id` for full message history.

**Authentication required:** Yes

**Query parameters:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | integer | 1 | |
| `limit` | integer | 20 | Max 50 |

**Success — 200:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "title": "Weekend recipe ideas",
      "aiModel": "gpt-4o",
      "lastMessagePreview": "Here are five easy weeknight dinner ideas...",
      "totalTokens": 842,
      "createdAt": "2026-03-20T10:00:00.000Z",
      "updatedAt": "2026-03-20T10:15:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

---

### GET /api/v1/chat/:id

Returns a full conversation including all messages and attachments.

**Authentication required:** Yes

**Path parameters:**

| Param | Type | Notes |
|-------|------|-------|
| `id` | string | MongoDB ObjectId of the conversation |

**Success — 200:**

```json
{
  "success": true,
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "userId": "665f0000000000000000000a",
    "title": "Weekend recipe ideas",
    "aiModel": "gpt-4o",
    "totalTokens": 842,
    "lastMessagePreview": "Here are five easy weeknight dinner ideas...",
    "isArchived": false,
    "messages": [
      {
        "_id": "665f1b0000000000000000b1",
        "role": "user",
        "content": "Give me 5 easy weeknight dinners",
        "attachments": [],
        "reactions": { "liked": false, "disliked": false },
        "createdAt": "2026-03-20T10:00:00.000Z"
      },
      {
        "_id": "665f1b0000000000000000b2",
        "role": "assistant",
        "content": "Here are five easy weeknight dinner ideas...",
        "attachments": [],
        "reactions": { "liked": true, "disliked": false },
        "tokens": 842,
        "createdAt": "2026-03-20T10:00:05.000Z"
      }
    ],
    "createdAt": "2026-03-20T10:00:00.000Z",
    "updatedAt": "2026-03-20T10:00:05.000Z"
  }
}
```

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `NOT_FOUND` | 404 | Conversation does not exist or belongs to another user |

---

### DELETE /api/v1/chat/:id

Soft-deletes a conversation (sets `isArchived: true`). The conversation is excluded from list results but not permanently removed.

**Authentication required:** Yes

**Success — 200:**

```json
{
  "success": true,
  "data": null,
  "message": "Conversation deleted"
}
```

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `NOT_FOUND` | 404 | Conversation not found or not owned by user |

---

### POST /api/v1/chat/:id/messages

Sends a user message to a conversation and streams the AI response as SSE.

**Authentication required:** Yes

**Content-Type:** `multipart/form-data`

**Request fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `message` | string | Yes* | The user's message text. Max 10 000 chars. *Required if no files attached. |
| `files` | File[] | No | Up to 5 files. Images: jpeg/png/webp/gif. Documents: pdf/txt/docx (Pro/Max only). Max 10 MB each. |

**Response:** `text/event-stream` (SSE)

See the [SSE Streaming](#sse-streaming) section for event shapes and a JavaScript example.

**SSE Events:**

```
data: {"type":"delta","content":"Here "}

data: {"type":"delta","content":"are five "}

data: {"type":"done","tokens":142,"messageId":"665f1b0000000000000000b2"}
```

**Title generation:** On the first message of a conversation, the server automatically generates an AI-powered title using gpt-4o-mini and updates the conversation in the background. The title will be available on the next `GET /api/v1/chat` or `GET /api/v1/chat/:id` call.

**Errors (returned as JSON, not SSE, if validation fails before streaming starts):**

| Code | HTTP | Reason |
|------|------|--------|
| `EMPTY_MESSAGE` | 400 | No text and no files provided |
| `MESSAGE_TOO_LONG` | 400 | Message text exceeds 10 000 chars |
| `UPGRADE_REQUIRED` | 403 | Document uploaded on Smart/Free tier |
| `NOT_FOUND` | 404 | Conversation not found |
| `DAILY_LIMIT_EXCEEDED` | 429 | Daily chat limit reached |

If a streaming error occurs after the SSE connection is open, it is sent as:
```
data: {"type":"error","message":"The AI response failed. Please try again."}
```

---

### PATCH /api/v1/chat/:id/messages/:messageId/react

Toggles a like or dislike reaction on an assistant message. Sending the same action twice removes the reaction.

**Authentication required:** Yes

**Path parameters:**

| Param | Notes |
|-------|-------|
| `id` | Conversation ID |
| `messageId` | Message ID (must be an assistant message) |

**Request body:**

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `action` | string | Yes | `"like"` or `"dislike"` |

```json
{ "action": "like" }
```

**Success — 200:**

```json
{
  "success": true,
  "data": {
    "reactions": { "liked": true, "disliked": false }
  },
  "message": "Message liked"
}
```

Toggle off (same action again):

```json
{
  "success": true,
  "data": {
    "reactions": { "liked": false, "disliked": false }
  },
  "message": "Message like removed"
}
```

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `VALIDATION_ERROR` | 400 | Invalid `action` value |
| `INVALID_TARGET` | 400 | Tried to react to a user message |
| `NOT_FOUND` | 404 | Conversation or message not found |

---

## Image Generation Endpoints

Base path: `/api/v1/images`

All endpoints require authentication. The `free` tier cannot access image generation.

---

### POST /api/v1/images/generate

Generates an image using fal.ai. The model used is determined by the subscription tier:

- `cafa_smart` → FLUX Schnell (fast)
- `cafa_pro` / `cafa_max` → FLUX Pro (higher quality)

**Authentication required:** Yes

**Tiers allowed:** `cafa_smart`, `cafa_pro`, `cafa_max`

**Request body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `prompt` | string | Yes | 3–2000 characters. HTML tags stripped automatically. |
| `negative_prompt` | string | No | Max 1000 characters. (Noted in the request but FLUX models do not natively support it.) |
| `width` | integer | No | 512–2048. Snapped to nearest multiple of 64. Default: 1024 |
| `height` | integer | No | 512–2048. Snapped to nearest multiple of 64. Default: 1024 |
| `style` | string | No | See style values below |
| `seed` | integer | No | 0–2147483647. Omit for a random seed. |

**Style values:**

`realistic` · `anime` · `digital-art` · `oil-painting` · `sketch` · `cinematic` · `3d-render` · `watercolor`

```json
{
  "prompt": "A lone astronaut standing on a red alien planet at sunset",
  "width": 1024,
  "height": 1024,
  "style": "cinematic",
  "seed": 42
}
```

**Success — 201:**

```json
{
  "success": true,
  "data": {
    "id": "665f1a2b3c4d5e6f7a8b9c0d",
    "imageUrl": "https://fal.media/files/abc123/output.jpeg",
    "prompt": "A lone astronaut standing on a red alien planet at sunset",
    "style": "cinematic",
    "width": 1024,
    "height": 1024,
    "seed": 42,
    "generationTime": 3420,
    "model": "fal-ai/flux-pro",
    "createdAt": "2026-03-20T10:00:00.000Z"
  },
  "message": "Image generated successfully"
}
```

> `generationTime` is in milliseconds (wall-clock time for the fal.ai call).

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `VALIDATION_ERROR` | 400 | Invalid fields |
| `UPGRADE_REQUIRED` | 403 | Free tier user |
| `DAILY_LIMIT_EXCEEDED` | 429 | Daily image quota reached |

---

### GET /api/v1/images/history

Returns the user's image generation history, paginated, newest first.

**Authentication required:** Yes

**Query parameters:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | integer | 1 | |
| `limit` | integer | 20 | Max 50 |
| `style` | string | — | Filter by style (optional) |

**Success — 200:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "originalPrompt": "A lone astronaut standing on a red alien planet at sunset",
      "style": "cinematic",
      "aiModel": "fal-ai/flux-pro",
      "imageUrl": "https://fal.media/files/abc123/output.jpeg",
      "width": 1024,
      "height": 1024,
      "seed": 42,
      "generationTime": 3420,
      "createdAt": "2026-03-20T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "pages": 1
  }
}
```

---

### DELETE /api/v1/images/:id

Removes an image from the user's history. Does not delete the image from the fal.ai CDN.

**Authentication required:** Yes

**Path parameters:**

| Param | Type | Notes |
|-------|------|-------|
| `id` | string | MongoDB ObjectId |

**Success — 200:**

```json
{
  "success": true,
  "data": null,
  "message": "Image removed from history"
}
```

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `VALIDATION_ERROR` | 400 | `id` is not a valid MongoDB ObjectId |
| `NOT_FOUND` | 404 | Image not found or belongs to another user |

---

## Subscription Endpoints

Base path: `/api/v1/subscriptions`

---

### POST /api/v1/subscriptions/checkout

Creates a Stripe Checkout session for the selected tier. Returns a URL to redirect the user to Stripe's hosted payment page.

**Authentication required:** Yes

**Request body:**

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `tier` | string | Yes | `"cafa_smart"`, `"cafa_pro"`, `"cafa_max"` |

```json
{ "tier": "cafa_pro" }
```

**Success — 200:**

```json
{
  "success": true,
  "data": {
    "url": "https://checkout.stripe.com/pay/cs_test_...",
    "sessionId": "cs_test_..."
  }
}
```

**Flow:**
1. Redirect the user to `data.url`
2. On success, Stripe redirects to `{FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`
3. On cancel, Stripe redirects to `{FRONTEND_URL}/billing/cancel`
4. The webhook (`customer.subscription.created`) automatically activates the subscription

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `VALIDATION_ERROR` | 400 | Invalid tier |

---

### POST /api/v1/subscriptions/portal

Creates a Stripe Billing Portal session for the authenticated user. Use this to allow users to manage their subscription, update payment methods, view invoices, or cancel.

**Authentication required:** Yes

**Request body:** None

**Success — 200:**

```json
{
  "success": true,
  "data": {
    "url": "https://billing.stripe.com/session/..."
  }
}
```

**Flow:** Redirect the user to `data.url`. After they finish, Stripe redirects back to `{FRONTEND_URL}/settings/billing`.

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `NO_SUBSCRIPTION` | 400 | User has no Stripe customer record (never subscribed) |

---

### POST /api/v1/subscriptions/webhook

Handles incoming Stripe webhook events. **This endpoint is called by Stripe, not your frontend.**

**Authentication required:** No (verified via Stripe signature)

**Request headers:**

| Header | Notes |
|--------|-------|
| `stripe-signature` | Required. Stripe's HMAC signature for payload verification. |

**Content-Type:** `application/json` (raw body — do not parse as JSON before this handler)

**Handled events:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Stores the `stripeSubscriptionId` on the user immediately |
| `customer.subscription.created` | Sets tier, status, and `currentPeriodEnd` on the user |
| `customer.subscription.updated` | Updates tier, status, and `currentPeriodEnd` (plan changes, renewals) |
| `customer.subscription.deleted` | Downgrades user to `free` tier, clears subscription fields |
| `invoice.payment_failed` | Sets `subscription.status` to `past_due` (tier is preserved — grace period) |

**Success — 200:**

```json
{ "received": true }
```

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `MISSING_SIGNATURE` | 400 | `stripe-signature` header absent |
| `INTERNAL_ERROR` | 500 | Signature verification failed |

> Configure your Stripe webhook endpoint in the dashboard to point to `https://your-domain.com/api/v1/subscriptions/webhook` and enable the five events listed above.

---

### GET /api/v1/subscriptions/status

Returns the user's current subscription status, tier limits, and usage counters.

**Authentication required:** Yes

**Success — 200:**

```json
{
  "success": true,
  "data": {
    "subscription": {
      "tier": "cafa_pro",
      "status": "active",
      "stripeCustomerId": "cus_xxx",
      "stripeSubscriptionId": "sub_xxx",
      "currentPeriodEnd": "2026-04-20T10:00:00.000Z"
    },
    "limits": {
      "chatMessagesPerDay": 500,
      "imageGenerationsPerDay": 20,
      "chatModel": "gpt-4o",
      "imageModel": "fal-ai/flux-pro",
      "maxTokensPerRequest": 8192,
      "contextMessages": 30,
      "documentsEnabled": true
    },
    "usage": {
      "chatMessagesToday": 12,
      "imageGenerationsToday": 3,
      "lastResetDate": "2026-03-20T00:00:00.000Z"
    }
  }
}
```

---

## User Profile Endpoints

Base path: `/api/v1/users`

All endpoints require authentication.

---

### GET /api/v1/users/me

Returns the authenticated user's full profile.

**Authentication required:** Yes

**Success — 200:**

```json
{
  "success": true,
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "avatar": "https://example.com/avatar.jpg",
    "isVerified": true,
    "subscription": {
      "tier": "cafa_pro",
      "status": "active",
      "currentPeriodEnd": "2026-04-20T10:00:00.000Z"
    },
    "lastLoginAt": "2026-03-20T10:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-03-20T10:00:00.000Z"
  }
}
```

---

### PATCH /api/v1/users/me

Updates the user's name and/or avatar URL. Email, tier, and subscription fields cannot be changed via this endpoint.

**Authentication required:** Yes

**Request body** (all fields optional — send only what you want to update):

| Field | Type | Constraints |
|-------|------|-------------|
| `name` | string | 2–50 characters |
| `avatar` | string | Must be a valid URL |

```json
{
  "name": "Jane M. Smith",
  "avatar": "https://cdn.example.com/avatars/jane.jpg"
}
```

**Success — 200:**

```json
{
  "success": true,
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "name": "Jane M. Smith",
    "email": "jane@example.com",
    "avatar": "https://cdn.example.com/avatars/jane.jpg",
    "isVerified": true,
    "subscription": { "tier": "cafa_pro", "status": "active" },
    "updatedAt": "2026-03-20T11:00:00.000Z"
  },
  "message": "Profile updated"
}
```

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `VALIDATION_ERROR` | 400 | Name too short/long, or avatar not a URL |

---

### PATCH /api/v1/users/me/password

Changes the user's password. Requires the current password for verification. All active sessions (refresh tokens) are invalidated — the user must log in again.

**Authentication required:** Yes

**Request body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `currentPassword` | string | Yes | Must match the account's current password |
| `newPassword` | string | Yes | Min 8 chars, uppercase + lowercase + digit |

```json
{
  "currentPassword": "OldSecurePass1",
  "newPassword": "NewSecurePass2"
}
```

**Success — 200:**

```json
{
  "success": true,
  "data": null,
  "message": "Password changed successfully. Please log in again."
}
```

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `VALIDATION_ERROR` | 400 | `newPassword` does not meet requirements |
| `INVALID_PASSWORD` | 401 | `currentPassword` is incorrect |

> After a successful password change, the access token remains valid until it expires (max 15 min), but all refresh tokens are revoked. The frontend should clear stored tokens and redirect to login.

---

### DELETE /api/v1/users/me

Permanently deletes the user's account. This action is irreversible.

**What gets deleted:**
- User document
- All conversations and messages
- All image generation history
- All active sessions (refresh tokens)
- Stripe subscription is cancelled if active

**Authentication required:** Yes

**Request body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `password` | string | Yes | Password confirmation — required to prevent accidental deletion |

```json
{ "password": "SecurePass1" }
```

**Success — 200:**

```json
{
  "success": true,
  "data": null,
  "message": "Account deleted successfully"
}
```

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `VALIDATION_ERROR` | 400 | `password` field missing |
| `INVALID_PASSWORD` | 401 | Incorrect password |

---

### GET /api/v1/users/me/usage

Returns today's usage counters vs the tier limits. Use this to build usage indicators in the UI.

**Authentication required:** Yes

**Success — 200:**

```json
{
  "success": true,
  "data": {
    "subscription": {
      "tier": "cafa_pro",
      "status": "active",
      "renewalDate": "2026-04-20T10:00:00.000Z"
    },
    "usage": {
      "chat": {
        "used": 47,
        "limit": 500
      },
      "images": {
        "used": 8,
        "limit": 20
      }
    }
  }
}
```

**Special values:**
- `chat.limit: null` — unlimited (Cafa Max tier)
- `images.limit: null` — feature not available (free tier)

> Usage counters reset at midnight UTC daily. The counter is stored in Redis with a 24-hour TTL.

---

## Voice Endpoints

Base path: `/api/v1/voice`

All voice endpoints require authentication. Voice features are backed by a separate FastAPI microservice running on port 3002. Requests are proxied transparently — the frontend only ever calls the Node.js API.

**Architecture:**
```
Browser → Node.js API (:5000) → Voice Service FastAPI (:3002)
                                  ├── Vosk  (speech-to-text)
                                  └── Kokoro ONNX (text-to-speech)
```

---

### POST /api/v1/voice/transcribe

Upload an audio recording and receive the transcribed text.

**Authentication required:** Yes

**Content-Type:** `multipart/form-data`

**Form fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | File | Yes | Audio file. Max 10 MB. One file only. |

**Supported formats:** `wav` · `mp3` · `ogg` · `webm` · `mp4` · `aac` · `flac`

**Success — 200:**

```json
{
  "success": true,
  "data": { "text": "Hello, I would like to place an order for delivery" },
  "message": "Audio transcribed successfully"
}
```

**Errors:**

| Code | HTTP | Reason |
|------|------|--------|
| `MISSING_FILE` | 400 | No file attached |
| `INVALID_FILE_TYPE` | 400 | Audio format not supported |
| `FILE_TOO_LARGE` | 400 | File exceeds 10 MB |
| `VOICE_SERVICE_UNAVAILABLE` | 503 | Voice microservice not running or models not downloaded |

**Browser example — recording and sending audio with `MediaRecorder`:**

```javascript
async function recordAndTranscribe(durationMs = 5000) {
  // 1. Request microphone access
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // 2. Record for durationMs
  const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  const chunks = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);

  await new Promise((resolve) => {
    recorder.onstop = resolve;
    recorder.start();
    setTimeout(() => recorder.stop(), durationMs);
  });

  stream.getTracks().forEach((t) => t.stop()); // release microphone

  // 3. Send to API
  const audioBlob = new Blob(chunks, { type: 'audio/webm' });
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');

  const res = await fetch('/api/v1/voice/transcribe', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
    credentials: 'include',
  });

  const { data } = await res.json();
  return data.text; // "Hello, I would like to place an order..."
}
```

---

### POST /api/v1/voice/synthesize

Convert text to speech and receive an audio stream.

**Authentication required:** Yes

**Content-Type:** `application/json`

**Request body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `text` | string | Yes | 1–2000 characters |
| `voice` | string | No | Voice ID (see table below). Default: `af_heart` |
| `speed` | number | No | 0.5–2.0. Default: `1.0` |

**Available voices:**

| ID | Name | Gender | Accent | Description |
|----|------|--------|--------|-------------|
| `af_heart` | Heart | Female | American | Warm and expressive American female voice |
| `am_michael` | Michael | Male | American | Clear and confident American male voice |
| `bf_emma` | Emma | Female | British | Polished British female voice |
| `bm_george` | George | Male | British | Authoritative British male voice |

```json
{
  "text": "Welcome to Cafa AI. How can I help you today?",
  "voice": "af_heart",
  "speed": 1.0
}
```

**Success — 200:**

`Content-Type: audio/wav` — chunked WAV audio stream.

The response body is a raw WAV audio stream, not JSON. Play it directly in the browser.

**Errors (JSON, returned before streaming starts):**

| Code | HTTP | Reason |
|------|------|--------|
| `VALIDATION_ERROR` | 400 | Invalid `voice`, `speed` out of range, or `text` too long |
| `VOICE_SERVICE_UNAVAILABLE` | 503 | Voice microservice not running or models not downloaded |

**Browser example — requesting and playing synthesized audio:**

```javascript
async function speakText(text, voice = 'af_heart', speed = 1.0) {
  const res = await fetch('/api/v1/voice/synthesize', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text, voice, speed }),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message);
  }

  // Convert the WAV stream to a playable blob URL
  const audioBlob = await res.blob();
  const url = URL.createObjectURL(audioBlob);

  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url); // clean up memory
  await audio.play();
}

// Usage
await speakText("Your order has been confirmed.", "bf_emma", 0.95);
```

> **Tip:** For long texts, you may want to show a loading indicator while the audio is being fetched, as synthesis of a 2000-character text can take 1–3 seconds on CPU.

---

### GET /api/v1/voice/voices

Returns the full list of available TTS voices with metadata.

**Authentication required:** Yes

**Success — 200:**

```json
{
  "success": true,
  "data": [
    {
      "id":          "af_heart",
      "name":        "Heart",
      "gender":      "female",
      "accent":      "american",
      "description": "Warm and expressive American female voice"
    },
    {
      "id":          "am_michael",
      "name":        "Michael",
      "gender":      "male",
      "accent":      "american",
      "description": "Clear and confident American male voice"
    },
    {
      "id":          "bf_emma",
      "name":        "Emma",
      "gender":      "female",
      "accent":      "british",
      "description": "Polished British female voice"
    },
    {
      "id":          "bm_george",
      "name":        "George",
      "gender":      "male",
      "accent":      "british",
      "description": "Authoritative British male voice"
    }
  ]
}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `5000` | Node.js server port |
| `API_VERSION` | No | `v1` | API path prefix version |
| `FRONTEND_URL` | Yes | `http://localhost:3000` | Used for Stripe redirect URLs |
| `CORS_ORIGINS` | Yes | `http://localhost:3000` | Comma-separated allowed origins |
| `MONGODB_URI` | Yes | — | MongoDB connection string |
| `REDIS_HOST` | Yes | `localhost` | Redis hostname |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_PASSWORD` | No | — | Redis auth password |
| `REDIS_TLS` | No | `false` | Enable TLS for Redis |
| `JWT_ACCESS_SECRET` | Yes | — | Min 32 chars, random |
| `JWT_REFRESH_SECRET` | Yes | — | Min 32 chars, random |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token TTL |
| `EMAIL_FROM` | No | `Cafa AI <noreply@cafa.ai>` | Sender address |
| `SMTP_HOST` | Yes | — | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_SECURE` | No | `false` | TLS on port 465 |
| `SMTP_USER` | Yes | — | SMTP credentials |
| `SMTP_PASS` | Yes | — | SMTP credentials |
| `OPENAI_API_KEY` | Yes | — | OpenAI API key |
| `OPENAI_ORG_ID` | No | — | OpenAI organisation ID |
| `FAL_KEY` | Yes | — | fal.ai API key |
| `STRIPE_SECRET_KEY` | Yes | — | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | — | Stripe webhook signing secret |
| `STRIPE_SMART_PRICE_ID` | Yes | — | Stripe price ID for Cafa Smart |
| `STRIPE_PRO_PRICE_ID` | Yes | — | Stripe price ID for Cafa Pro |
| `STRIPE_MAX_PRICE_ID` | Yes | — | Stripe price ID for Cafa Max |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window |
| `VOICE_SERVICE_URL` | No | `http://voice-service:3002` | Internal URL of the voice microservice |

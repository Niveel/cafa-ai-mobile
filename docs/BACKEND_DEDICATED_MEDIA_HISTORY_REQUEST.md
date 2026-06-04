# Backend Request: Persistent Dedicated Media History

## Purpose

We need backend support so the two dedicated media screens keep their history permanently, just like main chat conversations do.

This is specifically for mobile:

- `image-to-video`
- `edit-image`

Current problem:

- if the app refreshes or restarts, these screens lose their local history
- users expect previous generations and follow-up edits on these screens to still be there
- dedicated media history should persist without the user needing to create a new chat

Important product behavior:

- main chat can have many user-created conversations
- dedicated media screens should **not** require manual "New chat"
- each user should have **one persistent conversation per screen**
- that conversation should continue growing over time until backend/user explicitly clears it

---

## Required Product Behavior

For each authenticated user:

1. backend maintains exactly one persistent thread for `image-to-video`
2. backend maintains exactly one persistent thread for `edit-image`
3. opening either screen returns the existing thread instead of an empty session
4. sending on either screen appends to that same thread
5. these threads should **not** appear in normal main-chat conversation list results
6. history should survive app refresh, app restart, logout/login, and device changes

This means mobile does **not** need to create a new conversation for these screens.

Important:

- frontend is **not** asking for a separate create endpoint
- frontend only needs a way to fetch existing dedicated history and have future sends preserved into that same history
- if backend needs to initialize internal storage for first-time users, that should remain an internal backend concern and not a separate frontend flow

---

## Recommended Model

Treat each dedicated screen as a special system-owned conversation:

- `kind: "dedicated-media"`
- `screen: "image-to-video" | "edit-image"`
- `visibleInChatList: false`
- `userCreatable: false`

This keeps the storage model close to existing chat while preventing these threads from polluting the main chat sidebar/list.

---

## Recommended Endpoints

### 1. Get Dedicated Screen History

#### Route

- `GET /api/v1/media/conversations/:screen`

Where `:screen` is one of:

- `image-to-video`
- `edit-image`

#### Auth

- authenticated only

#### Behavior

- returns the current user's persistent dedicated conversation for that screen
- includes a **paginated initial message slice** so frontend can render immediately after one request

If the user has no prior history yet:

- backend may return an empty dedicated thread object, or
- backend may internally initialize the dedicated thread before returning

In either case:

- frontend should still call only this single history endpoint
- frontend should never need a separate `create dedicated conversation` request

#### Query Parameters

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `cursor` | `string` | none | Optional cursor for older messages |
| `limit` | `number` | `20` | Max `50` |
| `direction` | `"before"` | `"before"` | Load older messages before `cursor` |

#### Success Response

```json
{
  "success": true,
  "data": {
    "_id": "686d10000000000000000001",
    "kind": "dedicated-media",
    "screen": "image-to-video",
    "userId": "686d0f0000000000000000aa",
    "title": "Image to video",
    "aiModel": "cafa_smart",
    "visibleInChatList": false,
    "isArchived": false,
    "messages": [
      {
        "_id": "686d10000000000000000011",
        "role": "user",
        "content": "Generate a cinematic video from this image with slow camera drift.",
        "reference": null,
        "attachments": [
          {
            "_id": "686d10000000000000000021",
            "type": "image",
            "url": "https://cdn.example.com/uploads/source-image.jpg",
            "mimeType": "image/jpeg",
            "fileName": "source-image.jpg",
            "size": 384122
          }
        ],
        "reactions": { "liked": false, "disliked": false },
        "createdAt": "2026-06-03T10:00:00.000Z"
      },
      {
        "_id": "686d10000000000000000012",
        "role": "assistant",
        "content": "",
        "attachments": [
          {
            "_id": "686d10000000000000000022",
            "type": "video",
            "url": "https://cdn.example.com/uploads/generated-video.mp4",
            "mimeType": "video/mp4",
            "fileName": "generated-video.mp4",
            "size": 4920182
          }
        ],
        "mediaMeta": {
          "screen": "image-to-video",
          "sourceAttachmentId": "686d10000000000000000021",
          "generationKind": "image-to-video"
        },
        "reactions": { "liked": false, "disliked": false },
        "createdAt": "2026-06-03T10:00:12.000Z"
      }
    ],
    "createdAt": "2026-06-01T09:00:00.000Z",
    "updatedAt": "2026-06-03T10:00:12.000Z"
  },
  "pagination": {
    "limit": 20,
    "returned": 2,
    "nextCursor": "686d10000000000000000011",
    "hasMore": true,
    "totalMessages": 48
  },
  "message": "Dedicated media conversation loaded"
}
```

---

### 2. Load Older Messages for Dedicated Screen

If backend prefers cleaner separation, this can be a second endpoint instead of overloading `GET /media/conversations/:screen`.

#### Route

- `GET /api/v1/media/conversations/:screen/messages`

#### Query Parameters

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `cursor` | `string` | required for older pages | Use oldest currently loaded message id |
| `limit` | `number` | `20` | Max `50` |
| `direction` | `"before"` | `"before"` | Only older history needed for now |

#### Success Response

```json
{
  "success": true,
  "data": [
    {
      "_id": "686d10000000000000000005",
      "role": "user",
      "content": "Make the motion more dramatic.",
      "attachments": [],
      "reactions": { "liked": false, "disliked": false },
      "createdAt": "2026-06-02T08:00:00.000Z"
    },
    {
      "_id": "686d10000000000000000006",
      "role": "assistant",
      "content": "",
      "attachments": [
        {
          "_id": "686d10000000000000000026",
          "type": "video",
          "url": "https://cdn.example.com/uploads/generated-video-v2.mp4",
          "mimeType": "video/mp4",
          "fileName": "generated-video-v2.mp4",
          "size": 5211199
        }
      ],
      "reactions": { "liked": false, "disliked": false },
      "createdAt": "2026-06-02T08:00:12.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "returned": 2,
    "nextCursor": "686d10000000000000000005",
    "hasMore": true,
    "totalMessages": 48
  }
}
```

---

### 3. Persist Dedicated Screen Sends Into The Same Thread

Existing dedicated media endpoints should append both user and assistant turns into the matching persistent screen conversation automatically.

Affected endpoints:

- `POST /api/v1/media/image/edit`
- `POST /api/v1/media/video/image-to-video`

#### Required Behavior

When request succeeds:

1. backend resolves the user's dedicated conversation for that screen
2. backend appends the user message with prompt and uploaded source image
3. backend appends the generated assistant result with output media
4. backend response includes the resolved `conversationId` and created message ids

This lets frontend refresh that same screen history immediately and keeps the thread durable.

---

## Expected Success Responses For Existing Media Endpoints

### A. Edit Image

#### Route

- `POST /api/v1/media/image/edit`

#### Expected Response

```json
{
  "success": true,
  "data": {
    "conversationId": "686d20000000000000000001",
    "screen": "edit-image",
    "userMessageId": "686d20000000000000000011",
    "assistantMessageId": "686d20000000000000000012",
    "imageId": "686d20000000000000000021",
    "imageUrl": "https://cdn.example.com/uploads/edited-image.jpg",
    "prompt": "Retouch this image to look sharper, brighter, and more polished.",
    "mimeType": "image/jpeg",
    "createdAt": "2026-06-03T11:00:06.000Z"
  },
  "message": "Image generated successfully"
}
```

### B. Image To Video

#### Route

- `POST /api/v1/media/video/image-to-video`

#### Expected Start Response

```json
{
  "success": true,
  "data": {
    "conversationId": "686d30000000000000000001",
    "screen": "image-to-video",
    "jobId": "3e7a9e69-81ea-4939-9ea7-52a9cdaa34fb",
    "userMessageId": "686d30000000000000000011",
    "assistantMessageId": "686d30000000000000000012",
    "status": "queued"
  },
  "message": "Video generation started"
}
```

#### Expected Poll Response

- `GET /api/v1/videos/generate/:jobId`

```json
{
  "success": true,
  "data": {
    "jobId": "3e7a9e69-81ea-4939-9ea7-52a9cdaa34fb",
    "conversationId": "686d30000000000000000001",
    "assistantMessageId": "686d30000000000000000012",
    "status": "completed",
    "result": {
      "videoId": "686d30000000000000000022",
      "videoUrl": "https://cdn.example.com/uploads/generated-video.mp4",
      "mimeType": "video/mp4",
      "prompt": "Generate a cinematic video from this image with slow camera drift."
    }
  }
}
```

Important:

- on completion, the assistant message in the dedicated conversation must already be updated with the generated video attachment
- frontend should not have to manually synthesize history entries

---

## Required Message Shape

To keep frontend mapping simple, dedicated media messages should stay as close as possible to normal chat messages.

### Message Object

```json
{
  "_id": "686d10000000000000000012",
  "role": "assistant",
  "content": "",
  "reference": null,
  "attachments": [
    {
      "_id": "686d10000000000000000022",
      "type": "video",
      "url": "https://cdn.example.com/uploads/generated-video.mp4",
      "mimeType": "video/mp4",
      "fileName": "generated-video.mp4",
      "size": 4920182
    }
  ],
  "mediaMeta": {
    "screen": "image-to-video",
    "generationKind": "image-to-video",
    "sourceAttachmentId": "686d10000000000000000021"
  },
  "reactions": {
    "liked": false,
    "disliked": false
  },
  "createdAt": "2026-06-03T10:00:12.000Z"
}
```

### Required Attachment Fields

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | `string` | Stable attachment id |
| `type` | `"image" \| "video" \| "document"` | Media type |
| `url` | `string` | Public or authorized asset URL |
| `mimeType` | `string` | For rendering |
| `fileName` | `string` | For share/download labels |
| `size` | `number` | Optional but strongly preferred |

### Optional `mediaMeta`

Useful for:

- jumping to referenced source image/video later
- follow-up editing/extending
- analytics/debugging

Recommended fields:

| Field | Type | Notes |
| --- | --- | --- |
| `screen` | `"edit-image" \| "image-to-video"` | Which dedicated screen generated this |
| `generationKind` | `"image-edit" \| "image-to-video"` | Media operation type |
| `sourceAttachmentId` | `string` | The uploaded source image attachment id |

---

## Pagination Requirements

For performance, backend should **not** force frontend to fetch the entire dedicated thread on every open.

### Required Pagination Behavior

1. return newest messages first from storage query
2. frontend may re-order to chronological display after receipt
3. support cursor-based pagination for older history
4. max `50` per request
5. default `20` per request
6. include `totalMessages` so frontend can decide whether to show "load older"

### Required Pagination Object

```json
{
  "limit": 20,
  "returned": 20,
  "nextCursor": "686d10000000000000000031",
  "hasMore": true,
  "totalMessages": 148
}
```

### Field Meaning

| Field | Type | Notes |
| --- | --- | --- |
| `limit` | `number` | Requested page size |
| `returned` | `number` | Number of messages returned |
| `nextCursor` | `string \| null` | Cursor for loading older messages |
| `hasMore` | `boolean` | Whether older messages still exist |
| `totalMessages` | `number` | Total stored messages in this dedicated thread |

Cursor-based pagination is preferred over page-number pagination because:

- message history grows over time
- new messages can arrive while older messages are being fetched
- cursors avoid page drift and duplicate windows

---

## Dedicated Conversations Must Be Excluded From Normal Chat List

`GET /api/v1/chat` should **not** return these dedicated threads.

If backend cannot exclude them immediately, then include these fields so frontend can filter them:

```json
{
  "_id": "686d30000000000000000001",
  "title": "Image to video",
  "kind": "dedicated-media",
  "screen": "image-to-video",
  "visibleInChatList": false
}
```

Preferred behavior:

- exclude them entirely from normal chat list responses

---

## Error Cases

### Unsupported Screen

```json
{
  "success": false,
  "error": "INVALID_SCREEN",
  "message": "Screen must be one of: image-to-video, edit-image"
}
```

### Unauthorized

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Authentication required"
}
```

### Conversation Fetch Failure

```json
{
  "success": false,
  "error": "DEDICATED_MEDIA_THREAD_LOAD_FAILED",
  "message": "Could not load dedicated media conversation right now."
}
```

---

## Frontend Expectations

Once backend supports this contract, mobile/frontend will do this:

### On Screen Open

1. call `GET /api/v1/media/conversations/:screen?limit=20`
2. render returned messages
3. keep `nextCursor` for older history fetch

### On Send

For `edit-image`:

1. send `POST /api/v1/media/image/edit`
2. backend persists into dedicated thread
3. frontend updates local thread using response ids and/or refreshes latest slice

For `image-to-video`:

1. send `POST /api/v1/media/video/image-to-video`
2. poll `GET /api/v1/videos/generate/:jobId`
3. backend updates the same dedicated thread when job completes
4. frontend can refresh latest conversation state if needed

### On Pull To Refresh / Reopen / App Restart

1. call `GET /api/v1/media/conversations/:screen?limit=20`
2. history should still be there

---

## Exact Backend Outcomes Needed

Backend implementation will be considered complete for frontend if:

1. `image-to-video` screen always restores its last saved history for that user
2. `edit-image` screen always restores its last saved history for that user
3. no explicit frontend create-conversation flow is required for those screens
4. dedicated threads are not mixed into main chat list
5. history fetch supports cursor pagination
6. media generate/edit responses return `conversationId` and created message ids
7. generated results are already saved in the dedicated thread when frontend reloads

---

## Summary

We are asking backend for **persistent, screen-scoped dedicated media conversations** with:

- one thread per user per screen
- no frontend-visible create endpoint
- hidden from normal chat list
- cursor-paginated history
- standard `success/data/pagination` response shape
- existing media generation endpoints automatically writing into these threads

This will make `image-to-video` and `edit-image` behave like durable first-class chat experiences instead of temporary local sessions.

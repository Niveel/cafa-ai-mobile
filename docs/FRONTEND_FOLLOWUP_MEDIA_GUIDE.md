# Frontend Guide: Follow-Up Media (Chat Continuations)

Base API prefix: `/api/v1`

This guide covers only the new follow-up behavior:
- continue/extend the latest video in a chat thread
- improve/edit the latest generated image from a follow-up prompt

## 1) Video Follow-Up Continuation

When the user sends chat prompts like:
- "add another scene"
- "continue this video"
- "make the ending different"

the backend can auto-extend the latest video in that same conversation.

### Endpoint
`POST /api/v1/chat/:conversationId/messages`

### Request
`multipart/form-data`

Fields:
- `message` (required, string)
- `stream` (optional, boolean; for this path use non-stream for easier handling)
- `model` (optional, string)

Example:
```ts
const formData = new FormData();
formData.append("message", "Add another scene where the camera moves into the city plaza.");

const res = await fetch(`/api/v1/chat/${conversationId}/messages`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
```

### Success Response (Video Extension Path)
HTTP `201`

```json
{
  "success": true,
  "data": {
    "id": "68124f7f5a1a7a2d0d1f9abc",
    "videoUrl": "https://fal.media/files/.../extended.mp4",
    "prompt": "Add another scene where the camera moves into the city plaza.",
    "durationSeconds": 16,
    "resolution": "720p",
    "generationTime": 23145,
    "model": "fal-ai/veo3.1/fast/extend-video",
    "createdAt": "2026-04-30T18:52:10.000Z"
  },
  "message": "Video extended successfully"
}
```

### Chat Persistence
On success, chat history stores:
- user follow-up message
- assistant message with `fileType: "video"` attachment for the new extended video URL

## 2) Image Follow-Up Improvement

When the user sends prompts like:
- "make this brighter"
- "improve the details"
- "change this to watercolor style"

the backend detects edit intent and edits the latest image in conversation context.

### Endpoint
`POST /api/v1/chat/:conversationId/messages`

### Request
`multipart/form-data`

Fields:
- `message` (required, string)
- `stream` (optional, boolean)
- `model` (optional, string)

Example:
```ts
const formData = new FormData();
formData.append("message", "Make the same image more cinematic and add warm sunset lighting.");

const res = await fetch(`/api/v1/chat/${conversationId}/messages`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
```

### Success Response (Image Edit Path)
HTTP `201`

```json
{
  "success": true,
  "data": {
    "id": "681250455a1a7a2d0d1f9bcd",
    "imageUrl": "https://fal.media/files/.../edited.jpg",
    "prompt": "Make the same image more cinematic and add warm sunset lighting.",
    "style": null,
    "width": 1024,
    "height": 1024,
    "seed": null,
    "generationTime": 12876,
    "model": "fal-ai/flux-pro/kontext",
    "createdAt": "2026-04-30T18:55:12.000Z"
  },
  "message": "Image generated successfully"
}
```

### Chat Persistence
On success, chat history stores:
- user follow-up message
- assistant message with `fileType: "image"` attachment for the edited image URL

## 3) About "Merge 2 Images Into 1"

Current backend support in this repo:
- supports follow-up edits of the latest generated image
- does not yet expose a dedicated two-source image merge API contract

Frontend recommendation right now:
- treat "merge two images" as a feature flag / pending capability in UI
- keep follow-up improve/edit UX enabled for single-image continuation

If you want, we can add a dedicated merge endpoint next (for example `POST /images/merge`) with this contract:
- input: two image files/URLs + prompt
- output: one blended image + stored chat attachment

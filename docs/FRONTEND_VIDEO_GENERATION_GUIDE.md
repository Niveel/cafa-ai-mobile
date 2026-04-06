# Frontend Video Generation + History Guide

This guide covers:
- generating videos from prompts ("generate a video of...", "give me a video...")
- chat persistence after refresh
- video history page
- single video download
- download all videos as ZIP
- showing per-plan video usage/limits in UI

Base API prefix: `/api/v1`

## 1) Generate Video from Prompt Intent

### Endpoint
`POST /api/v1/videos/generate`

### Request body
```json
{
  "conversationId": "66fabc1234...",
  "prompt": "Generate a video of a futuristic city at night",
  "durationSeconds": 8,
  "aspectRatio": "16:9"
}
```

Fields:
- `conversationId` (recommended): makes video persist in chat thread after refresh.
- `prompt` (required)
- `durationSeconds` (optional): backend clamps by plan max.
- `aspectRatio` (optional): `16:9 | 9:16 | 1:1`

### Intent detection in chat input
Use prompt intent routing before deciding endpoint.

Starter regex:
```ts
const VIDEO_INTENT_REGEX =
  /\b(generate|create|make|give me)\s+(me\s+)?(a\s+)?video\b|\bvideo\s+of\b/i;
```

Flow:
1. If `VIDEO_INTENT_REGEX.test(prompt)` is true -> call `/videos/generate`.
2. Else continue with normal chat/image flow.

## 2) Chat Persistence Requirement

To keep videos visible after page refresh:
- always send `conversationId` when calling `/videos/generate`
- on chat load/refresh, always rehydrate from backend conversation API

Backend appends:
- user message (prompt)
- assistant message with `fileType: "video"` attachment

## 3) Render Video in Chat

Video attachments come as:
- `attachment.fileType === "video"`
- `attachment.fileUrl`
- `attachment.mimeType` (usually `video/mp4`)

Render:
```tsx
<video controls preload="metadata" src={attachment.url} />
```

## 4) Build Video History Page

### Endpoint
`GET /api/v1/videos/history?page=1&limit=20&sort=newest`

`sort`: `newest | oldest`

### Response shape
```json
{
  "success": true,
  "data": {
    "videos": [
      {
        "id": "66fab...",
        "prompt": "Generate a video of...",
        "videoUrl": "https://...",
        "durationSeconds": 8,
        "resolution": "720p",
        "model": "fal-ai/minimax/video-01-live",
        "createdAt": "2026-03-25T21:00:00.000Z",
        "mimeType": "video/mp4",
        "fileName": "futuristic-city-123.mp4",
        "byteSize": 1234567,
        "downloadUrl": "http://localhost:5000/api/v1/videos/:id/download"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 55,
      "pages": 3
    }
  }
}
```

## 5) Download Single Video

### Endpoint
`GET /api/v1/videos/:id/download`

Use this for "Download" button per history card.

## 6) Download All Videos as ZIP

### Endpoint
`POST /api/v1/videos/download-zip`

### Option A: selected videos
```json
{
  "videoIds": ["id1", "id2", "id3"]
}
```

### Option B: all videos for user
```json
{
  "all": true,
  "sort": "newest"
}
```

### Response modes
- `200`: ZIP binary (small-medium batches)
- `202`: async job (large batches on higher tiers)

`202` body:
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "processing",
    "pollUrl": "/api/v1/videos/download-zip/uuid"
  },
  "message": "Video ZIP job accepted"
}
```

### Poll async ZIP
`GET /api/v1/videos/download-zip/:id`
- `202`: still processing
- `200`: ZIP binary ready

## 7) Show Plan + Usage in UI (Required)

To make users aware of plan limits and usage:

### Current limits
Call: `GET /api/v1/subscriptions/status`

Read:
- `data.limits.videoGenerationsPerDay`
- `data.limits.maxVideoDurationSeconds`

### Plan comparisons
Call: `GET /api/v1/subscriptions/plans`

Read each plan:
- `limits.videoGenerationsPerDay`
- `limits.maxVideoDurationSeconds`
- `benefits`

### Recommended UI copy
- "Plan: Cafa Pro"
- "Video usage today: 3 / 10"
- "Max video length on your plan: 8s"
- On limit hit: "You reached today’s video limit. Upgrade for more videos and longer clips."

## 8) Backend-Enforced Plan Caps

Current defaults:
- `free`: 1 video/day, max 3s
- `cafa_smart`: 3 videos/day, max 5s
- `cafa_pro`: 10 videos/day, max 8s
- `cafa_max`: 25 videos/day, max 12s

Even if frontend sends higher duration, backend clamps to plan max.

## 9) Error Handling

Common errors:
- `429 DAILY_LIMIT_EXCEEDED` -> daily video cap reached
- `403 UPGRADE_REQUIRED` -> video feature unavailable for plan
- `403 PLAN_LIMIT_EXCEEDED` -> too many videos requested in ZIP
- `500/502` -> provider/downstream failure

Error shape:
```json
{
  "success": false,
  "error": "CODE",
  "message": "Human-readable message"
}
```

## 10) Quick Implementation Checklist

1. Add video intent detection in chat send flow.
2. Call `/videos/generate` with `conversationId`.
3. Rehydrate chat from backend on refresh.
4. Render video attachments via `<video>`.
5. Add `/videos/history` page with pagination.
6. Add per-item download (`/videos/:id/download`).
7. Add "Download selected" + "Download all" ZIP action (`/videos/download-zip`).
8. If ZIP returns `202`, poll `pollUrl` until `200`.
9. Show plan video usage/limits from subscription endpoints in UI.

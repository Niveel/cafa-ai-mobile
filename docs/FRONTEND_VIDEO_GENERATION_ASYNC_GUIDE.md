# Frontend Async Video Generation Guide

Base API prefix: `/api/v1`

## 1) New Flow Summary

Video generation is now async:
1. `POST /videos/generate` starts a job and returns `202`.
2. Frontend polls `GET /videos/generate/:jobId`.
3. When status is `completed`, render/store returned video and refresh chat/history.

This removes hard timeout failures on long renders.

## 2) Start Video Generation

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

### Response (`202 Accepted`)
```json
{
  "success": true,
  "data": {
    "jobId": "0d581274-8af6-4bf6-8a32-4c4e2fb56d52",
    "status": "queued",
    "pollUrl": "/api/v1/videos/generate/0d581274-8af6-4bf6-8a32-4c4e2fb56d52",
    "queuedAt": "2026-03-25T22:10:00.000Z",
    "durationSeconds": 8,
    "maxDurationForPlan": 8
  },
  "message": "Video generation started"
}
```

## 3) Poll Job Status

### Endpoint
`GET /api/v1/videos/generate/:jobId`

### In progress (`202`)
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "processing",
    "prompt": "Generate a video of ...",
    "durationSeconds": 8,
    "resolution": "720p",
    "createdAt": "2026-03-25T22:10:00.000Z",
    "updatedAt": "2026-03-25T22:10:12.000Z"
  }
}
```

### Completed (`200`)
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "completed",
    "result": {
      "id": "66fab...",
      "prompt": "Generate a video of ...",
      "videoUrl": "https://...",
      "durationSeconds": 8,
      "resolution": "720p",
      "model": "fal-ai/minimax/video-01-live",
      "createdAt": "2026-03-25T22:11:08.000Z",
      "maxDurationForPlan": 8
    },
    "createdAt": "2026-03-25T22:10:00.000Z",
    "updatedAt": "2026-03-25T22:11:08.000Z"
  },
  "message": "Video generation completed"
}
```

### Failed (`200`)
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "failed",
    "error": "Provider timeout or downstream failure",
    "createdAt": "2026-03-25T22:10:00.000Z",
    "updatedAt": "2026-03-25T22:11:08.000Z"
  }
}
```

## 4) Frontend Integration Pattern

1. Detect video intent (`generate a video`, `give me a video`, `video of`).
2. Call `POST /videos/generate`.
3. Save `jobId`.
4. Poll every 2-3 seconds:
   - `202`: show `Queued...` or `Generating...`
   - `200 completed`: stop polling, render video, then refetch:
     - `GET /api/v1/chat/:conversationId`
     - `GET /api/v1/videos/history`
   - `200 failed`: stop polling, show error toast/message.
5. Add max poll timeout in UI (for example 8-10 minutes), then show "Still processing, check history later."

## 5) Chat Persistence

If `conversationId` is included in generate request, backend appends:
- user message (prompt)
- assistant message with `fileType: "video"` attachment

After job completes, refresh conversation to display the video message.

## 6) Existing Endpoints Still Valid

- `GET /api/v1/videos/history`
- `GET /api/v1/videos/:id/download`
- `POST /api/v1/videos/download-zip`
- `GET /api/v1/videos/download-zip/:id`

## 7) Limits Awareness in UI

Use subscription endpoints to display plan-based usage and caps:
- `GET /api/v1/subscriptions/status`
- `GET /api/v1/subscriptions/plans`

Show:
- videos used today / allowed
- max duration per video for current plan
- upgrade prompt when capped


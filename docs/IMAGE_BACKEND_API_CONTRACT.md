# Image Backend API Contract (Implemented)

Base path: `/api/v1/images`  
Auth: required (`Bearer` access token)

## 1) Image History API

### Endpoint
`GET /api/v1/images/history`

### Query params
- `page` (number, optional, default `1`)
- `limit` (number, optional, default `20`, max `100`)
- `cursor` (string, optional, base64 cursor pagination)
- `sort` (`newest|oldest`, optional, default `newest`)
- `search` (string, optional, prompt text search)
- `from` (ISO 8601 datetime, optional)
- `to` (ISO 8601 datetime, optional)

Supports both page/limit and cursor.  
If `cursor` is provided, cursor mode is used.

### Response shape
```json
{
  "success": true,
  "data": {
    "images": [
      {
        "id": "66f...",
        "imageUrl": "/api/v1/images/66f.../download",
        "sourceImageUrl": "https://...",
        "prompt": "Generate image of ...",
        "createdAt": "2026-03-25T19:20:10.123Z",
        "model": "fal-ai/flux-pro",
        "size": "1024x1024",
        "mimeType": "image/jpeg",
        "fileName": "cafa-image-....jpg",
        "byteSize": 234567,
        "downloadExpiresInMinutes": 60,
        "downloadUrl": "http://localhost:5000/api/v1/images/66f.../download"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 120,
      "pages": 6,
      "hasNextPage": true,
      "nextCursor": null
    }
  }
}
```

Notes:
- `imageUrl` is now a stable authenticated backend download URL.
- `model`, `size`, `mimeType`, `fileName`, `byteSize` are included (nullable where unknown).

## 2) Single Image Download Reliability

### Metadata endpoint
`GET /api/v1/images/:id`
- Returns metadata for a single image owned by current user.
- Ownership enforced (`userId` scope).

### Endpoint
`GET /api/v1/images/:id/download`

### Behavior
- User-scoped authorization enforced (cannot download other users' images).
- Fetches original source image and returns binary download.
- Sets:
  - `Content-Type`
  - `Content-Length`
  - `Content-Disposition: attachment; filename="..."`
  - `Access-Control-Expose-Headers: Content-Disposition, Content-Type, Content-Length`

## 3) Bulk Download (ZIP)

### Endpoint
`POST /api/v1/images/download-zip`

### Request body (option A)
```json
{
  "imageIds": ["66f...", "66g..."]
}
```

### Request body (option B)
```json
{
  "all": true,
  "sort": "newest",
  "search": "futuristic",
  "from": "2026-03-01T00:00:00.000Z",
  "to": "2026-03-25T23:59:59.999Z"
}
```

### Response modes
- Sync ZIP stream (`200`) for smaller requests.
- Async job (`202`) for large requests (tier permitting), returns:
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "processing",
    "pollUrl": "/api/v1/images/download-zip/uuid"
  },
  "message": "ZIP job accepted"
}
```

### Poll endpoint
`GET /api/v1/images/download-zip/:jobId`
- `202` while processing with progress JSON.
- `200` with ZIP binary when completed.
- `500` with standard error if failed.

## 4) Authorization Rules

Confirmed:
- All image endpoints are authenticated.
- All read/write/download queries include `userId` scoping.
- Users only access their own image records and ZIP jobs.

## 5) Plan + Limit Behavior

### Image generation/day (already enforced)
- `free`: 5/day
- `cafa_smart`: 10/day
- `cafa_pro`: 30/day
- `cafa_max`: 50/day

### ZIP download policy (implemented)
- `free`: max 20 images/request, sync only
- `cafa_smart`: max 50 images/request, sync only
- `cafa_pro`: max 200 images/request, async allowed
- `cafa_max`: max 500 images/request, async allowed

If exceeded: `403 PLAN_LIMIT_EXCEEDED`.

## 6) URL Lifetime + CORS

- Stable backend download route is used (no short-lived signed URL required by client).
- Download metadata includes `downloadExpiresInMinutes: 60` contract value.
- Cross-origin downloads are supported with exposed headers for browser file save UX.

## 7) Delete Support

### Single delete (existing)
`DELETE /api/v1/images/:id`

### Bulk delete (added)
`POST /api/v1/images/delete-bulk`
```json
{
  "imageIds": ["66f...", "66g..."]
}
```

## 8) Metadata Consistency Contract

Guaranteed in history item:
- `id`: string
- `imageUrl`: string (download route)
- `prompt`: string (never null; empty string fallback if missing)
- `createdAt`: ISO 8601 UTC string

Optional/nullable:
- `model`: string
- `size`: string (`<width>x<height>`)
- `mimeType`: string | null
- `fileName`: string | null
- `byteSize`: number | null

Image format:
- Not hard-limited to one format; returned `Content-Type` drives actual format.

## 9) Rate Limits + Error Contract

Per-endpoint limiter (implemented):
- History: 120 req/min/user-IP
- Single download: 60 req/min/user-IP
- ZIP endpoints: 20 req/min/user-IP

Standard error envelope:
```json
{
  "success": false,
  "error": "CODE",
  "code": "CODE",
  "message": "Human-readable message",
  "details": {}
}
```

Validation errors include express-validator details in `errors` where applicable.

## 10) Existing Endpoint Confirmation

Backend routes (implemented/confirmed):
- `GET /api/v1/images/history`
- `GET /api/v1/images/:id`
- `GET /api/v1/images/:id/download`
- `POST /api/v1/images/download-zip`
- `GET /api/v1/images/download-zip/:jobId`
- `DELETE /api/v1/images/:id`
- `POST /api/v1/images/delete-bulk`

If your Next routes are `/api/images/history` and `/api/images/[imageId]`, they should proxy/map to the backend paths above (`/api/v1/images/...`).

## 11) Auth, URL Expiry, Retention

- Auth mechanism: same existing backend auth middleware (`authenticate`) is used.
- Accepts existing frontend auth flow:
  - Bearer access token
  - refresh-cookie/session flow already in your app
- URL expiry behavior:
  - `imageUrl` points to stable authenticated backend route (`/images/:id/download`)
  - no external signed URL required by frontend
  - contract field `downloadExpiresInMinutes` is set to `60`
- History size / retention:
  - current implementation has no hard retention TTL purge
  - practical fetch limits are controlled by pagination (`limit` max 100 per request)
  - ZIP download limits are plan-based as documented above

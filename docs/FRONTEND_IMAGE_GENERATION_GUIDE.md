# Frontend Guide: Image Generation From User Prompt

Base URL: `/api/v1`

All endpoints below require `Authorization: Bearer <accessToken>`.

## 1) Core Endpoint

`POST /images/generate`

Use this endpoint when the user asks for an image (for example, messages like "generate image of...").

Request body:
```json
{
  "prompt": "A cinematic portrait of a software engineer at night",
  "style": "cinematic",
  "width": 1024,
  "height": 1024
}
```

Optional fields:
- `negative_prompt`: `string` (max 1000)
- `style`: `realistic | anime | digital-art | oil-painting | sketch | cinematic | 3d-render | watercolor`
- `width`: `number` (512 to 2048)
- `height`: `number` (512 to 2048)
- `seed`: `number` (0 to 2147483647)

Validation notes:
- `prompt` is required
- `prompt` length: 3 to 2000 chars

## 2) Success Response

Success `201`:
```json
{
  "success": true,
  "data": {
    "id": "67f...",
    "imageUrl": "https://...",
    "prompt": "A cinematic portrait of a software engineer at night",
    "style": "cinematic",
    "width": 1024,
    "height": 1024,
    "seed": 12345,
    "generationTime": 4.8,
    "model": "fal-ai/flux/schnell",
    "createdAt": "2026-03-24T23:00:00.000Z"
  },
  "message": "Image generated successfully"
}
```

Frontend behavior:
- Render the returned `imageUrl` immediately.
- Save `id` for deletion/history actions.

## 3) Image History

`GET /images/history?page=1&limit=20&style=cinematic`

Use this to load generated images for gallery/history screens.

## 4) Delete Image History Item

`DELETE /images/:id`

Removes an image record from user history.

## 5) Plan and Limits (Enforced by Backend)

Current daily image limits:
- `free`: 5/day
- `cafa_smart`: 10/day
- `cafa_pro`: 30/day
- `cafa_max`: 50/day

## 6) Common Errors to Handle

- `401 UNAUTHORIZED`: user token missing/expired
- `400 VALIDATION_ERROR`: bad payload (prompt/style/size etc.)
- `429 DAILY_LIMIT_EXCEEDED`: user reached plan limit
- `403 UPGRADE_REQUIRED`: feature unavailable for current tier (future-proof handling)

Example error envelope:
```json
{
  "success": false,
  "error": "DAILY_LIMIT_EXCEEDED",
  "message": "Daily image limit of 5 reached. Resets in 7 hour(s)."
}
```

## 7) Chat UX: Generate Image From Prompt Text

Recommended frontend routing:
1. User sends message text.
2. Detect image intent (`generate image`, `create an image`, `draw`, etc.).
3. If image intent: call `POST /images/generate`.
4. If not image intent: call normal chat endpoint.

Suggested fallback:
- If `/images/generate` fails with validation/limit/auth, show toast and keep message in chat thread as normal text.

## 8) Minimal Frontend Example (TypeScript)

```ts
type GenerateImagePayload = {
  prompt: string;
  negative_prompt?: string;
  style?: "realistic" | "anime" | "digital-art" | "oil-painting" | "sketch" | "cinematic" | "3d-render" | "watercolor";
  width?: number;
  height?: number;
  seed?: number;
};

export async function generateImage(token: string, payload: GenerateImagePayload) {
  const res = await fetch("/api/v1/images/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Image generation failed");
  }

  return json.data as {
    id: string;
    imageUrl: string;
    prompt: string;
    style?: string;
    width: number;
    height: number;
    seed?: number;
    generationTime?: number;
    model: string;
    createdAt: string;
  };
}
```

## 9) Pre-Release Checklist

- Prompt with image intent calls `/images/generate`
- Non-image prompt still calls normal chat flow
- 429 limit error UX is clear
- History page loads from `/images/history`
- Image cards render `imageUrl` and metadata
- Delete action uses `/images/:id`

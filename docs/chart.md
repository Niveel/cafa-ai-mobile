# Chart generation

Charts, graphs, plots, and labeled/technical diagrams (bar charts, pie
charts, line graphs, flowcharts, wireframes, labeled anatomy diagrams, math
plots) don't render well through the image-generation model — axes, labels,
and precise geometry are exactly what it gets wrong. These are generated
through real plotting code (matplotlib) instead, via a dedicated endpoint.

## 1. Classify the message first

Same flow as image/video/artifact — call `/chat/classify` once, dispatch on
`responseType`:

```http
POST /api/v1/chat/classify
Authorization: Bearer <token>
Content-Type: application/json

{ "message": "bar chart of quarterly revenue: Q1 12k, Q2 18k, Q3 15k, Q4 22k" }
```

```json
{
  "success": true,
  "data": {
    "responseType": "chart",
    "confidence": 0.95,
    "subIntent": "chart",
    "label": "Generating chart",
    "description": "Building your chart or diagram"
  }
}
```

If `responseType === "chart"`, call `/charts/generate` below. (`"image"` still
goes to `/images/generate` as before — only chart/graph/diagram requests get
the new category.)

## 2. Generate

```http
POST /api/v1/charts/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "conversationId": "6a7b41bccbcd828dc8e4c547",
  "prompt": "bar chart of quarterly revenue: Q1 12k, Q2 18k, Q3 15k, Q4 22k"
}
```

| Field | Required | Notes |
|---|---|---|
| `prompt` | yes | 3–2000 chars |
| `conversationId` | no | Mongo ID. If supplied, both the user's message and the finished chart get threaded into that conversation automatically — you don't build those messages client-side. Omit it and generation still works standalone. |

**Response (`201`):**
```json
{
  "success": true,
  "message": "Chart generated successfully",
  "data": {
    "id": "...",
    "imageUrl": "https://...",
    "prompt": "bar chart of quarterly revenue: Q1 12k, Q2 18k, Q3 15k, Q4 22k",
    "generationTime": 3100,
    "model": "...",
    "createdAt": "2026-08-13T..."
  }
}
```

Render `imageUrl` like any other chat image attachment — there's no
separate chart viewer needed.

## Errors

- `502` — sandbox execution failed or produced no image (bad/ambiguous
  prompt, sandbox timeout). Message is safe to show as-is: *"Chart
  generation failed. Please try rephrasing your request."*
- `403` `UPGRADE_REQUIRED` / limit responses — same monthly **image** quota
  as `/images/generate`. Charts aren't a separate entitlement; handle this
  the same way you already handle image-limit errors.
- `401` — unauthenticated, same as every other endpoint.

## Notes

- No `style`/`width`/`height`/`seed` fields — layout comes entirely from the
  generated plotting code, not generation params.
- No edit/follow-up flow (unlike `/images/generate`'s "make it more
  vibrant" behavior) — a new chart request is always a fresh generation.
- Synchronous, not a job/poll flow — same as `/images/generate`, unlike
  `/videos/generate`.

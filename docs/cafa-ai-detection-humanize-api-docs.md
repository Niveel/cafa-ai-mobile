# Cafa AI — AI Detection & Humanize API Integration Guide

This document covers the two new tool endpoints: **AI Detection** and **Humanize**. Both are tier-gated with monthly word quotas tied to the user's subscription plan.

Base URL: `https://cafaapi.niveel.com/api/v1`

All endpoints below require authentication. Include the user's access token in every request:

```
Authorization: Bearer <accessToken>
```

---

## 1. AI Detection

### `POST /tools/detect-ai`

Checks whether submitted text reads as AI-generated.

**Request body**

```json
{
  "text": "The text to analyze, minimum 50 characters."
}
```

**Success response — `200`**

```json
{
  "success": true,
  "data": {
    "aiProbability": 100,
    "humanProbability": 0,
    "isAiGenerated": true,
    "confidence": "high",
    "details": {
      "averageGeneratedProb": 1,
      "completelyGeneratedProb": 0.9998091292412178
    },
    "usage": {
      "used": 25,
      "limit": 75000,
      "tier": "cafa_max"
    }
  }
}
```

- `aiProbability` / `humanProbability`: percentages, 0–100.
- `confidence`: `"high"` | `"medium"` | `"low"`.
- `usage.limit`: the user's monthly word quota for this feature, based on their tier.
- `usage.used`: cumulative words checked this month, **after** this request is counted.

**Validation error — `400`**

```json
{ "error": "text is required" }
```
or
```json
{ "error": "text must be at least 50 characters for accurate detection" }
```

**Quota exceeded — `403`**

```json
{
  "error": "AI detection word limit reached for your plan this month",
  "data": {
    "used": 75000,
    "limit": 75000,
    "tier": "cafa_max",
    "remaining": 0
  }
}
```

When you receive this, show an upgrade prompt rather than a generic error — this is the moment a free/smart/pro user is most likely to upgrade.

> Note: the detection check is never run if the user is already over quota, so no request is wasted.

---

### `GET /tools/detect-ai/quota`

Check remaining quota without consuming it. Use this to show "X words remaining this month" in the UI before the user submits text.

**Success response — `200`**

```json
{
  "success": true,
  "data": {
    "used": 25,
    "limit": 75000,
    "tier": "cafa_max",
    "remaining": 74975
  }
}
```

---

## 2. Humanize

### `POST /tools/humanize`

Rewrites text for more natural flow. Standalone tool — **not** automatically chained to AI detection results. The user chooses to invoke this independently.

**Request body**

```json
{
  "text": "The text to rewrite.",
  "style": "professional",
  "intensity": "medium"
}
```

| Field | Required | Options | Default |
|---|---|---|---|
| `text` | Yes | any string | — |
| `style` | No | `casual` \| `academic` \| `professional` | `professional` |
| `intensity` | No | `light` \| `medium` \| `heavy` | `medium` |

- `light`: minimal changes, smooths awkward phrasing only.
- `medium`: moderate sentence restructuring and vocabulary variation.
- `heavy`: substantial restructuring while preserving every fact.

**Success response — `200`**

```json
{
  "success": true,
  "data": {
    "result": "The rewritten text goes here.",
    "modelTier": "standard",
    "factCheckPassed": true,
    "style": "professional",
    "intensity": "medium",
    "usage": {
      "used": 1200,
      "limit": 40000,
      "tier": "cafa_max"
    }
  }
}
```

- `modelTier`: will be `"standard"` or `"enhanced"` — `"enhanced"` indicates an automatic upgrade was used internally when the standard pass's output failed a quality check (e.g. too short, too similar to the input, or missing key facts/numbers/names from the original). No action needed on the frontend beyond optionally surfacing this for debugging.
- `factCheckPassed`: whether the final result preserved enough of the original's key facts (numbers, names, dates). If `false`, consider showing a subtle "please double-check this rewrite" note in the UI.

**Quota exceeded — `403`**

```json
{
  "error": "Humanize word limit reached for your plan this month",
  "data": {
    "used": 40000,
    "limit": 40000,
    "tier": "cafa_max",
    "remaining": 0
  }
}
```

---

### `GET /tools/humanize/quota`

Same shape as the detect-ai quota endpoint.

```json
{
  "success": true,
  "data": {
    "used": 1200,
    "limit": 40000,
    "tier": "cafa_max",
    "remaining": 38800
  }
}
```

---

## 3. Monthly Word Limits by Tier

| Tier | AI Detection | Humanize |
|---|---|---|
| `free` | 1,000 words/month | 500 words/month |
| `cafa_smart` | 10,000 words/month | 5,000 words/month |
| `cafa_pro` | 30,000 words/month | 15,000 words/month |
| `cafa_max` | 75,000 words/month | 40,000 words/month |

Limits reset on the 1st of each month, same cycle as chat/image/video usage.

---

## 4. Surfaced on the Plans & Billing Screen

`GET /users/me/usage` now also includes AI detection and humanize usage alongside the existing chat/image/video fields, so both can be shown on the same billing screen without a separate call:

```json
{
  "success": true,
  "data": {
    "usage": {
      "chat": { "used": 42, "limit": null },
      "images": { "used": 3, "limit": 150 },
      "videos": { "used": 1, "limit": 20 },
      "aiDetectionWords": { "used": 25, "limit": 75000 },
      "humanizeWords": { "used": 1200, "limit": 40000 }
    }
  }
}
```

(`humanizeWords` is being added in the same pattern as `aiDetectionWords` — confirm with backend before relying on it if integrating immediately.)

---

## 5. UI/Copy Guidance

- Frame the humanize feature around **"improve natural flow"** or **"make your writing sound more like you"** — avoid copy that references "beating" or "evading" AI detectors. This isn't just a tone preference; it keeps the feature positioned as an honest editing tool rather than something that could be seen as enabling academic dishonesty.
- Do **not** auto-chain detect-ai → humanize. Each is a deliberate, separate user action.
- Show quota remaining proactively (via the `/quota` endpoints) before the user pastes a large block of text, so they're not surprised by a 403 after typing.

---

## 6. Error Handling Summary

| Status | Meaning | Action |
|---|---|---|
| `400` | Missing/invalid input | Show inline validation message |
| `403` | Quota exceeded | Show upgrade prompt with `remaining: 0` |
| `500` | Server/provider error | Show generic retry message |

Both endpoints can fail upstream (provider outage) — handle `500` gracefully with a "please try again" message rather than a raw error dump.

# Cafa AI — Billing & Usage Update

## What Changed

Two new billing additions — TTS conversion limits and a usage endpoint update.

---

## 1. TTS Conversion Limits

The `POST /api/v1/tts/convert` endpoint now enforces monthly limits per tier.

| Tier | TTS Conversions/month |
|---|---|
| Free | 5 |
| Cafa Smart | 50 |
| Cafa Pro | 200 |
| Cafa Max | Unlimited |

**When limit is exceeded, the API returns:**
```json
{
  "success": false,
  "error": "USAGE_LIMIT_EXCEEDED",
  "code": "USAGE_LIMIT_EXCEEDED",
  "message": "You've reached your monthly TTS limit. Please upgrade your plan"
}
```
HTTP status: `429`

**When feature is disabled for tier:**
```json
{
  "success": false,
  "error": "UPGRADE_REQUIRED",
  "code": "UPGRADE_REQUIRED",
  "message": "TTS is not available on your current plan"
}
```
HTTP status: `403`

**UI guidance:**
- Show remaining TTS conversions on the TTS screen
- Show upgrade prompt when limit is reached
- Free tier users: show "5 conversions remaining this month"

---

## 2. Avatar Video Limits

Avatar video generation shares the same monthly video quota as regular video generation.

| Tier | Videos/month (regular + avatar combined) |
|---|---|
| Free | 3 |
| Cafa Smart | 8 |
| Cafa Pro | 12 |
| Cafa Max | 20 |

Same `429 USAGE_LIMIT_EXCEEDED` response when exceeded.

---

## 3. Usage Endpoint Now Includes TTS

`GET /api/v1/users/me/usage` and `GET /api/v1/subscription` now both return TTS usage:

```json
{
  "usage": {
    "chat": { "used": 45, "limit": 200 },
    "image": { "used": 3, "limit": 5 },
    "video": { "used": 1, "limit": 3 },
    "tts": { "used": 2, "limit": 5 }
  }
}
```

Use `usage.tts.used` and `usage.tts.limit` to show TTS usage in the UI.

A `-1` limit means unlimited.

---

## 4. TTS Character Limits (Existing — reminder)

These are per-request character limits, separate from the monthly conversion count:

| Tier | Max characters per TTS request |
|---|---|
| Free | 500 |
| Cafa Smart / Pro / Max | 3000 |

Error when exceeded:
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Text too long for your current plan"
}
```
HTTP status: `400`

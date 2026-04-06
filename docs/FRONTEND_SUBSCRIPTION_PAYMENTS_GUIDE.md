# Frontend Guide: Subscription Payments

Base URL: `/api/v1`

All endpoints below require `Authorization: Bearer <accessToken>`, except Stripe webhook handling (backend-only).

## 1) Plans API (Pricing + Features)

`GET /subscriptions/plans`

Use this to render your pricing cards.

Success `200`:
```json
{
  "success": true,
  "data": {
    "currentTier": "free",
    "plans": [
      {
        "tier": "free",
        "name": "Free",
        "price": { "amount": 0, "currency": "USD", "interval": "month", "priceId": null },
        "description": "For generous everyday chat and basic prompts.",
        "benefits": [
          "500 chat messages per reset window",
          "Model switch enabled",
          "Access to Cafa chat models",
          "5 image generations per day",
          "Streaming responses"
        ],
        "limits": {
          "chatMessagesPerDay": 500,
          "imageGenerationsPerDay": 5,
          "chatModelIds": ["gpt-4o-mini"],
          "imageModelIds": [],
          "documentsEnabled": false,
          "streamingEnabled": true,
          "maxTokensPerRequest": 1024,
          "contextMessages": 10
        },
        "recommended": false,
        "isActive": true
      },
      {
        "tier": "cafa_smart",
        "name": "Cafa Smart",
        "price": { "amount": 9, "currency": "USD", "interval": "month", "priceId": "price_..." },
        "description": "For growing teams that need faster, smarter responses.",
        "benefits": [
          "1,500 chat messages per reset window",
          "10 image generations per day",
          "FLUX Schnell images"
        ],
        "recommended": true,
        "isActive": true
      },
      {
        "tier": "cafa_pro",
        "name": "Cafa Pro",
        "price": { "amount": 19, "currency": "USD", "interval": "month", "priceId": "price_..." },
        "description": "For professional workloads with advanced capability.",
        "benefits": [
          "5,000 chat messages per reset window",
          "30 image generations per day",
          "Documents enabled",
          "Advanced models"
        ],
        "recommended": false,
        "isActive": true
      },
      {
        "tier": "cafa_max",
        "name": "Cafa Max",
        "price": { "amount": 39, "currency": "USD", "interval": "month", "priceId": "price_..." },
        "description": "For mission-critical workloads at maximum capacity.",
        "benefits": [
          "Unlimited chat messages",
          "50 image generations per day",
          "Top-tier performance and priority"
        ],
        "recommended": false,
        "isActive": true
      }
    ]
  },
  "message": "Plans fetched"
}
```

Frontend notes:
- Render prices from this API (`9`, `19`, `39`) rather than hardcoding.
- If `isActive` is `false`, disable CTA and show “Temporarily unavailable”.

## 2) Start Checkout

`POST /subscriptions/checkout`

Request:
```json
{ "tier": "cafa_smart" }
```

Allowed values:
- `cafa_smart`
- `cafa_pro`
- `cafa_max`

Success `200`:
```json
{
  "success": true,
  "data": {
    "url": "https://checkout.stripe.com/c/pay/cs_test_...",
    "sessionId": "cs_test_..."
  }
}
```

Frontend action:
- Redirect immediately:
```ts
window.location.href = data.url;
```

Common errors:
- `400 VALIDATION_ERROR` (bad tier)
- `401 UNAUTHORIZED`

## 3) Checkout Return Pages

Backend uses:
- success: `/billing/success?session_id={CHECKOUT_SESSION_ID}`
- cancel: `/billing/cancel`

Suggested `/billing/success` flow:
1. Show “Payment received, finalizing subscription...”
2. Poll `GET /subscriptions/status` every 2-3s for up to 30s
3. Stop when `subscription.tier` matches purchased tier and status is `active` or `trialing`
4. Show success UI and link back to app

If timeout:
- Show “Payment completed, still syncing. Please refresh shortly.”

## 4) Subscription Status

`GET /subscriptions/status`

Use this for:
- current plan label
- renewal date
- feature gating

Success `200`:
```json
{
  "success": true,
  "data": {
    "subscription": {
      "tier": "cafa_smart",
      "status": "active",
      "stripeCustomerId": "cus_...",
      "stripeSubscriptionId": "sub_...",
      "currentPeriodEnd": "2026-04-24T00:00:00.000Z"
    },
    "limits": {
      "chatMessagesPerDay": 1500,
      "imageGenerationsPerDay": 10,
      "chatModel": "gpt-4o-mini",
      "imageModel": "fal-ai/flux/schnell",
      "maxTokensPerRequest": 4096,
      "contextMessages": 20,
      "documentsEnabled": false
    },
    "usage": {
      "chatMessagesToday": 0,
      "imageGenerationsToday": 0,
      "lastResetDate": "2026-03-24T00:00:00.000Z"
    }
  }
}
```

## 5) Billing Portal (Manage Existing Subscription)

`POST /subscriptions/portal`

Success `200`:
```json
{
  "success": true,
  "data": { "url": "https://billing.stripe.com/p/session/..." }
}
```

Frontend action:
```ts
window.location.href = data.url;
```

Common errors:
- `400 NO_SUBSCRIPTION`
- `401 UNAUTHORIZED`

## 6) Webhook Dependency (Critical)

Your frontend checkout success does **not** upgrade tier by itself.
Tier/status updates happen only when Stripe webhooks are processed by backend.

For local dev:
```bash
stripe listen --forward-to http://localhost:5000/api/v1/subscriptions/webhook
```

Then set `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

Keep that `stripe listen` terminal running while testing.

## 7) Test Cards

Use Stripe test card:
- `4242 4242 4242 4242`
- Any future expiry, any CVC, any postal code

## 8) Recommended Frontend States

- `loadingPlans`
- `startingCheckout`
- `checkoutCancelled`
- `syncingSubscription` (success page polling)
- `subscriptionActive`
- `portalRedirecting`

## 9) Minimal Frontend Pseudocode

```ts
async function startCheckout(tier: "cafa_smart" | "cafa_pro" | "cafa_max") {
  const res = await api.post("/subscriptions/checkout", { tier });
  if (!res.data.success) throw new Error(res.data.error || "Checkout failed");
  window.location.href = res.data.data.url;
}

async function pollSubscriptionStatus(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await api.get("/subscriptions/status");
    const sub = res.data?.data?.subscription;
    if (sub?.tier !== "free" && ["active", "trialing"].includes(sub?.status)) return sub;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return null;
}
```

## 10) Final Checklist

- `GET /subscriptions/plans` renders 9 / 19 / 39 correctly
- Clicking upgrade redirects to Stripe Checkout
- After payment, `/billing/success` polls and confirms upgraded tier
- Billing Portal opens from `/subscriptions/portal`
- Local webhook forwarding active during tests

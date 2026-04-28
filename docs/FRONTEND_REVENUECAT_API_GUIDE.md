# RevenueCat Frontend API Guide (React Native)

## Purpose
This guide defines the frontend-to-backend API contract for subscription state sync using RevenueCat-backed backend endpoints.

This document intentionally focuses on:
- Endpoints
- Payloads
- Response shapes
- Integration sequence

This document intentionally does not include code implementation details.

## Base URL
- Development example: `http://localhost:5000/api/v1`
- Production example: `https://cafaapi.niveel.com/api/v1`

All authenticated endpoints require:
- `Authorization: Bearer <access_token>`

## Canonical Subscription Tier/Status (Frontend)
- `tier`: `free | smart | pro | max`
- `status`: `active | trialing | expired | cancelled | billing_issue | inactive | past_due | canceled | unknown`

Notes:
- Backend may also expose `internal_tier` as `free | cafa_smart | cafa_pro | cafa_max`.
- For UI decisions, use `tier` from `/subscriptions/sync` response when available.

## 1) Sync Subscription State
Endpoint:
- `POST /subscriptions/sync`

Auth:
- Required

Request body:
- Empty JSON object `{}` is accepted.

Behavior:
- Backend resolves current authenticated user ID.
- Backend fetches latest RevenueCat subscriber state from `GET /v1/subscribers/{app_user_id}`.
- Backend computes final tier/status and updates DB.
- Backend returns fresh subscription state for frontend.

Success response example:
```json
{
  "success": true,
  "data": {
    "tier": "pro",
    "status": "active",
    "product_id": "com.cafaai.pro.monthly",
    "current_period_end": "2026-05-27T00:00:00.000Z",
    "scheduled_tier": null,
    "scheduled_change_at": null,
    "internal_tier": "cafa_pro"
  }
}
```

Scheduled downgrade response example:
```json
{
  "success": true,
  "data": {
    "tier": "max",
    "status": "active",
    "product_id": "com.cafaai.pro.monthly",
    "current_period_end": "2026-05-27T00:00:00.000Z",
    "scheduled_tier": "pro",
    "scheduled_change_at": "2026-05-27T00:00:00.000Z",
    "internal_tier": "cafa_max"
  }
}
```

Error examples:
- `401` unauthorized / missing token
- `404` user not found
- `500` backend sync failure

Recommended frontend trigger points:
- After purchase success
- After restore purchases
- On app foreground
- On login success

## 2) Read Current Subscription Snapshot
Endpoint:
- `GET /subscriptions/status`

Auth:
- Required

Behavior:
- Returns current DB snapshot plus lifecycle metadata and limits.
- Does not guarantee fresh RevenueCat reconciliation unless sync was called recently.

Success response shape:
```json
{
  "success": true,
  "data": {
    "subscription": {
      "tier": "cafa_pro",
      "status": "active",
      "store": "app_store",
      "productId": "com.cafaai.pro.monthly",
      "currentPeriodEnd": "2026-05-27T00:00:00.000Z",
      "scheduledTier": null,
      "scheduledChangeAt": null
    },
    "subscriptionLifecycle": {
      "willCancelAtPeriodEnd": false,
      "scheduledCancelAt": null,
      "scheduledTier": null,
      "scheduledChangeAt": null,
      "changeType": null,
      "canceledAt": null
    },
    "limits": {},
    "usage": {},
    "lastResetDate": "2026-04-27T00:00:00.000Z",
    "nextResetAt": "2026-04-28T00:00:00.000Z",
    "timezoneBasis": "UTC",
    "updatedAt": "2026-04-27T21:00:00.000Z"
  }
}
```

## 3) List Plans for Paywall
Endpoint:
- `GET /subscriptions/plans`

Auth:
- Required

Behavior:
- Returns available plans and current tier.
- Use for paywall rendering and plan comparison.

Response highlights:
- `currentTier`
- `plans[]` with:
  - `tier`
  - `name`
  - `price.amount`
  - `price.currency`
  - `benefits[]`
  - `limits`
  - `recommended`
  - `isActive`

## RevenueCat Product-to-Tier Mapping (Backend-Owned)
- `com.cafaai.smart.monthly` -> `smart`
- `com.cafaai.pro.monthly` -> `pro`
- `com.cafaai.max.monthly` -> `max`

Frontend should treat backend response as source of truth for effective tier.

## Upgrade and Downgrade Outcome Semantics
- Upgrade (`smart -> pro`, `pro -> max`, `smart -> max`):
  - Effective tier updates immediately.
  - Response `tier` reflects upgraded value.
- Downgrade (`max -> pro`, `pro -> smart`, etc.):
  - If paid access remains valid, backend keeps current tier active and sets:
    - `scheduled_tier`
    - `scheduled_change_at`
  - Frontend should display current entitlement plus scheduled change notice.

## Frontend Integration Sequence (API-Only)
1. Authenticate user and obtain access token.
2. On app open/login/purchase/restore, call `POST /subscriptions/sync`.
3. Use sync response `data` as immediate entitlement state.
4. Optionally call `GET /subscriptions/status` for expanded lifecycle/limits/usage.
5. Render paywall/options from `GET /subscriptions/plans`.

## Failure Handling Contract
- If `POST /subscriptions/sync` fails:
  - Keep last known subscription state in UI.
  - Retry on next lifecycle trigger.
- If `GET /subscriptions/status` returns `401`:
  - Treat as auth-expired flow.
- If `429` appears on frequent polling:
  - Reduce refresh frequency and rely on lifecycle-based sync triggers.

## Webhook Endpoint (Backend-Only, not called by frontend)
- `POST /revenuecat/webhook`
- Used by RevenueCat servers.
- Not used directly by mobile client.

## Data Fields to Consume in UI
Primary:
- `tier`
- `status`
- `product_id`
- `current_period_end`

Lifecycle:
- `scheduled_tier`
- `scheduled_change_at`

Debug/support:
- `internal_tier`


# Rewarded ads: backend and admin contract

## Scope

Free users may request a rewarded ad only immediately after the corresponding chat, image, or video operation returns a usage-limit error. Rewards are independent: watching an ad for one resource never grants either of the other resources.

| `rewardType` | Grant per verified ad | Maximum verified grants per UTC day |
| --- | ---: | ---: |
| `chat` | 10 chat prompts | 3 |
| `image` | 1 image generation | 3 |
| `video` | 1 video generation | 1 |

Each grant is bound to its `rewardType` and the UTC reward day on which it was earned. Unused bonus usage expires at the next UTC reset and must not roll over. The backend is authoritative for eligibility, each resource's daily cap, completion verification, idempotency, expiry, and credit balances. The client must never grant credits locally.

## Authentication and errors

All user endpoints require the normal bearer access token. Use the existing API error envelope and these suggested codes:

- `AD_REWARD_NOT_ELIGIBLE` (403): the underlying product limit has not been reached.
- `AD_REWARD_PAID_TIER` (403): only free users qualify.
- `AD_REWARD_DAILY_CAP_REACHED` (429): that reward type's daily cap has been reached.
- `AD_REWARD_SESSION_EXPIRED` (410).
- `AD_REWARD_NOT_VERIFIED` (409): Google SSV has not been received or validated yet.
- `AD_REWARD_ALREADY_GRANTED` should return HTTP 200 with `status: "already_granted"` for idempotent retries.

## User endpoints

### `GET /ads/rewards/eligibility?rewardType=chat|image|video`

Response:

```json
{
  "eligible": true,
  "rewardType": "chat",
  "grantAmount": 10,
  "usedToday": 1,
  "remainingToday": 2,
  "dailyLimit": 3,
  "resetsAt": "2026-08-09T00:00:00.000Z",
  "reason": "eligible"
}
```

Eligibility requires an authenticated free user whose corresponding usable allowance is currently exhausted: both the base allowance and any unexpired bonus for that resource must be zero. This prevents users from stacking rewards in advance; they must consume a grant and hit that same limit again before watching another ad. A user cannot open an image reward session because chat or video is exhausted, for example. `usedToday`, `remainingToday`, and `dailyLimit` are scoped to the requested `rewardType`, not shared globally.

### `POST /ads/rewards/sessions`

Request:

```json
{
  "rewardType": "image",
  "placement": "limit_notice",
  "requestedGrant": 1
}
```

The server must ignore or validate `requestedGrant` against its own reward table. Atomically reserve one attempt from the requested reward type's daily cap so concurrent devices cannot exceed it. A reservation should expire after 10–15 minutes and become reusable if no verified grant is issued.

Response:

```json
{
  "eligible": true,
  "rewardType": "image",
  "grantAmount": 1,
  "usedToday": 1,
  "remainingToday": 1,
  "dailyLimit": 3,
  "resetsAt": "2026-08-09T00:00:00.000Z",
  "reason": "eligible",
  "sessionId": "ars_01J...",
  "ssvUserId": "usr_123",
  "ssvCustomData": "signed-or-opaque-session-token",
  "expiresAt": "2026-08-08T21:15:00.000Z"
}
```

`ssvCustomData` should be opaque, URL-safe, bound to the session/user/reward, and tamper-evident. Do not put private user data in it.

### Google AdMob server-side verification callback

Configure the rewarded ad unit’s SSV callback URL to a public backend endpoint such as:

`GET /webhooks/admob/rewarded`

Validate Google’s `signature` with the published AdMob verifier keys and validate `key_id`, `timestamp`, `ad_unit`, `reward_item`, `reward_amount`, `user_id`, `custom_data`, and `transaction_id`. Persist the raw callback and make `transaction_id` unique. Never trust the client completion event as proof of reward.

The callback should mark the matching session `verified`. It may atomically grant credit immediately, or leave it verified for the claim endpoint to grant. Return success for duplicate valid callbacks.

### `POST /ads/rewards/sessions/:sessionId/claim`

Request:

```json
{
  "completionSource": "google_mobile_ads_client_event",
  "adReward": {
    "type": "coins",
    "amount": 1
  }
}
```

The client event only prompts reconciliation. Grant only after valid Google SSV. If SSV can arrive slightly later, return `pending_verification`; the endpoint must remain safe to retry.

Granted response:

```json
{
  "sessionId": "ars_01J...",
  "status": "granted",
  "rewardType": "image",
  "grantAmount": 1,
  "remainingToday": 1,
  "dailyLimit": 3,
  "expiresAt": "2026-08-09T00:00:00.000Z",
  "usage": {
    "image": {
      "used": 5,
      "limit": 5,
      "bonusRemaining": 1,
      "bonusExpiresAt": "2026-08-09T00:00:00.000Z"
    }
  }
}
```

Pending response (HTTP 200 or 202):

```json
{
  "sessionId": "ars_01J...",
  "status": "pending_verification",
  "rewardType": "image",
  "grantAmount": 1,
  "remainingToday": 1,
  "dailyLimit": 3,
  "expiresAt": "2026-08-09T00:00:00.000Z"
}
```

Generation/chat endpoints should consume only their matching bonus credits and only after the matching normal free allowance is exhausted. Credit consumption must be atomic and should expose `bonusRemaining` and `bonusExpiresAt` in usage responses. At the UTC reset, expire all unused bonus balances from the previous reward day before evaluating usage. Never carry an unused reward into the next day.

## Persistence model

Recommended `ad_reward_sessions` fields:

- `id`, `user_id`, `reward_type`, `grant_amount`, `placement`
- `status`: `reserved`, `started`, `verified`, `granted`, `cancelled`, `expired`, `rejected`
- `ad_network`, `ad_unit_id`, `transaction_id` (unique), `ssv_custom_data_hash`
- `created_at`, `started_at`, `verified_at`, `granted_at`, `cancelled_at`, `expires_at`
- `reward_day_utc`, `reward_expires_at`, `client_platform`, `app_version`, `error_code`
- SSV value/currency/precision fields when available

Maintain an immutable credit ledger with a unique reference to the reward session. Never update balances without a ledger entry and transaction.

## Analytics events

The frontend emits these PostHog events:

- `ad_banner_viewed`
- `ad_banner_clicked`
- `rewarded_ad_started`
- `rewarded_ad_completed`
- `rewarded_reward_granted`
- `rewarded_ad_cancelled`
- `ad_revenue_generated`

It also emits load/failure/close diagnostics. Common properties include `format`, `placement`, `pathname`, `rewardType`, and `sessionId`. Revenue events include `value`, `currency`, and `precision` as supplied by Google Mobile Ads. Treat the SDK value according to the SDK’s documented units; do not assume dollars.

The backend should mirror canonical events for session creation, SSV verification, grant, rejection, expiration, and credit consumption. Use `sessionId` as the join key between product analytics and the reward ledger.

## Admin ad tracking

Protect all endpoints with an admin analytics permission and audit access.

### `GET /admin/ads/summary`

Parameters: `from`, `to`, `timezone`, optional `platform`, `country`, `appVersion`, `rewardType`, and `placement`.

Return impressions, clicks, CTR, rewarded starts/completions/cancellations, completion rate, verified grants, verification failures, credits issued/consumed, unique viewers, daily-cap hits, estimated revenue by currency, and revenue per completed reward.

### `GET /admin/ads/timeseries`

Same filters plus `interval=hour|day|week`. Return funnel and revenue metrics per bucket.

### `GET /admin/ads/reward-sessions`

Paginated/filterable by user, session, transaction, status, reward type, platform, and date. Include lifecycle timestamps and failure reasons. Mask user data unless the administrator has support-level access.

### `GET /admin/ads/reward-sessions/:sessionId`

Return the full audit trail: reservation, client lifecycle events, sanitized SSV payload, signature-verification result, ledger entry, and any credit consumption.

### `GET /admin/ads/cohorts`

Report engagement and monetization impact: D1/D7 retention, sessions, generation conversion, upgrade conversion, and churn for users exposed/not exposed to ads and users who accepted/cancelled rewards. This is necessary to determine whether ads help revenue while damaging product engagement.

### Optional controls

`GET/PATCH /admin/ads/config` may expose kill switches, daily cap, grants, placements, and minimum app versions. Changes must be validated, versioned, and audit logged. The client should eventually consume a read-only public eligibility/config response rather than hard-code remotely adjustable policy.

## Security and operational requirements

- Enforce independent caps transactionally across devices: three chat grants, three image grants, and one video grant per UTC day.
- Require the matching usable resource allowance (base plus unexpired bonus) to be exhausted when creating a session; a limit in one resource must never unlock another reward type.
- Expire unconsumed reward credits at the next UTC reset and never roll them into another reward day.
- Verify AdMob SSV signatures and reject stale or mismatched callbacks.
- Make session creation, SSV handling, claims, and ledger grants idempotent.
- Rate-limit all reward and admin endpoints.
- Never accept client analytics as proof of completion or revenue.
- Retain enough audit data for fraud investigation while following privacy retention rules.
- Alert on verification-failure spikes, abnormal completion rates, repeated devices/accounts, and grant/ledger mismatches.

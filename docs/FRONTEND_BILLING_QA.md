# Frontend Billing Q&A (Backend Reality Check)

Date: 2026-04-17

Source of truth for this file is code under `src/controllers/subscription.controller.ts` and `src/services/stripe.service.ts`.

## Answers

1. **Can checkout accept `successUrl`/`cancelUrl` from mobile and pass unchanged?**
- **No (current code).** Request fields exist, but checkout URLs are always rebuilt by backend and request values are ignored.
- Evidence: `resolveCheckoutReturnUrls(...)` returns fixed URLs, and `createCheckout(...)` uses those values (subscription.controller.ts:58-69, 339-350).

2. **Do you validate/whitelist URL schemes? Can you whitelist `cafa-ai://billing/success` and `cafa-ai://billing/cancel`?**
- **Checkout:** No scheme whitelist path is used because custom checkout URLs are not used.
- **Portal:** Yes. Mobile `returnUrl` must start with `MOBILE_APP_SCHEME` (default `cafa-ai://`).
- Evidence: portal validation in `resolvePortalReturnUrl(...)` (subscription.controller.ts:71-91), scheme from config (config/index.ts:14).

3. **Does backend currently reject non-HTTPS `success_url` / `cancel_url`? (real response/code)**
- **Code confirmation:** checkout does not forward custom URLs; it generates web URLs only.
- In production it uses `https://www.cafaai.com/...`; in non-production it uses `http://localhost:3000/...`.
- Evidence: subscription.controller.ts:48-52, 63-68.
- **Runtime Stripe rejection for custom schemes cannot occur in current flow** because custom checkout URLs never reach Stripe.

4. **If Stripe rejects custom schemes, can backend provide HTTPS 302 redirect endpoint to `cafa-ai://...`?**
- **Not implemented currently.** No such redirect endpoint exists.

5. **If using redirect endpoint, what exact URLs should mobile send?**
- **N/A currently** (no redirect endpoint today).

6. **Will backend include `{CHECKOUT_SESSION_ID}` in success URL?**
- **Yes.** Success URL includes `?session_id={CHECKOUT_SESSION_ID}`.
- Evidence: subscription.controller.ts:66.

7. **After checkout return, what endpoint should mobile call for source-of-truth?**
- `GET /api/v1/subscriptions/status`.
- Evidence: subscription routes/controller (subscription.routes.ts:22, subscription.controller.ts:401-427).

8. **Guaranteed webhook event that marks subscription active in DB?**
- **`customer.subscription.created` and `customer.subscription.updated`** set tier/status in DB.
- `checkout.session.completed` only captures `stripeSubscriptionId`.
- Evidence: stripe.service.ts:71-82, 98-131.

9. **Activation synchronous at redirect time or eventually consistent?**
- **Eventually consistent (webhook-driven).**

10. **Recommended polling strategy after return?**
- **No hard backend contract in code.**
- Repo guide suggests polling status every 2-3s for up to 30s (`FRONTEND_SUBSCRIPTION_PAYMENTS_GUIDE.md`).

11. **Explicit pending status for "finalizing subscription"?**
- **No explicit `pending` status currently.**
- Existing status model is limited to predefined values.

12. **Canonical status model?**
- `active`, `inactive`, `past_due`, `canceled`, `trialing`.
- Evidence: types/index.ts:3-8 and User model enum (User.model.ts:72-76).

13. **Upgrades/downgrades flow: checkout or different flow?**
- **Different flow if already subscribed.** Backend updates existing Stripe subscription in place and returns `mode: "subscription_updated"` (no new checkout).
- Evidence: subscription.controller.ts:263-336.

14. **Can backend always return normalized payload (`checkoutUrl`, `mode`, `requiresCheckout`, etc.)?**
- **Not currently.**
- Current responses differ by path:
  - New checkout: `mode: "checkout_started"`, `url`, `sessionId`, `successUrl`, `cancelUrl`.
  - Existing subscription update: `mode: "subscription_updated"`, `tier`, `subscriptionId`, `status`, `currentPeriodEnd`.
- Evidence: subscription.controller.ts:329-368.

15. **If user closes browser before redirect, how should app recover state?**
- On next app open, call `GET /api/v1/subscriptions/status` and reconcile UI from backend state.

16. **Does backend enforce one active subscription per user? Exact error code?**
- **Partially enforced.** It checks Stripe active/trialing/past_due subscriptions, updates one primary subscription, and attempts to cancel duplicates.
- Same-tier duplicate request returns `400 ALREADY_SUBSCRIBED`.
- Evidence: subscription.controller.ts:17, 253-261, 270-276, 292-309.

17. **Exact error codes/messages mobile should map**
- already subscribed: `400 ALREADY_SUBSCRIBED` with message `You are already on the {tier} plan`.
- manage existing subscription: **No current `MANAGE_EXISTING_SUBSCRIPTION` response in code** (docs mentioning it appear stale).
- invalid return URL: `400 INVALID_MOBILE_RETURN_URL` (portal only).
- webhook not yet processed: **No dedicated code/message today**.

18. **Idempotency key support for checkout creation?**
- **No.** Checkout endpoint does not consume `Idempotency-Key`.

19. **Auth context required for checkout creation?**
- **Bearer token required** (`Authorization: Bearer ...`).
- No cookie auth required by subscription endpoints.
- Evidence: auth.middleware.ts:8-16 and subscription.routes.ts:19.

20. **Need app platform flag + app version in request?**
- `platform` is optional (`web`/`mobile`) and used for URL behavior.
- `app version` is not used currently.
- Evidence: validators and usage in subscription.controller.ts:23-26, 37-41, 233-238.

21. **Environment differences (dev/staging/prod) in return URLs and Stripe config?**
- **Yes.**
- Checkout/portal web base uses production fixed domain or localhost depending on `NODE_ENV`.
- Stripe keys/price IDs come from env vars.
- Evidence: subscription.controller.ts:48-52; config/index.ts:57-64.

22. **Exact allowed mobile return URLs in production?**
- **Checkout (current):** fixed to web URLs only:
  - `https://www.cafaai.com/billing/success?session_id={CHECKOUT_SESSION_ID}`
  - `https://www.cafaai.com/billing/cancel`
- **Portal (mobile):** any URL starting with `MOBILE_APP_SCHEME` (default `cafa-ai://`), e.g. `cafa-ai://billing/return`.

23. **Deep-link-safe fallback page if app not installed?**
- **Not implemented in backend currently.**

24. **Should mobile pass `returnUrl` for billing portal, and should portal return to app?**
- **Supported.** Mobile may pass `returnUrl`; backend validates scheme and forwards to Stripe Portal.
- Evidence: subscription.controller.ts:384-393 and stripe.service.ts:52-56.

25. **What logs can backend expose to trace checkout by user ID + session ID quickly?**
- Checkout creation log includes: `userId`, `sessionId`, `tier`, `successUrl`, `cancelUrl`, `checkoutUrl`.
- Webhook logs include event type; checkout completion logs include `customerId` + `subscriptionId`.
- Logs are written by Winston to rotating files in `logs/combined-YYYY-MM-DD.log` and `logs/error-YYYY-MM-DD.log`.
- Evidence: subscription.controller.ts:352-360; stripe.service.ts:69, 108-111; utils/logger.ts.

## Important mismatch to note

`FRONTEND_SUBSCRIPTION_PAYMENTS_GUIDE.md` mentions behaviors (for example custom checkout deep links and `MANAGE_EXISTING_SUBSCRIPTION` 409) that do not match current backend code paths.

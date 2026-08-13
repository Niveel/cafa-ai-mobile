# New change: `preClassifiedAs` on `POST /chat/:id/messages`

## What changed

`POST /api/v1/chat/:id/messages` now accepts one new optional field in the
request body:

```json
{
  "message": "What's the capital of France?",
  "preClassifiedAs": "text"
}
```

`preClassifiedAs` accepts exactly two values: `"text"` or `"search"` — the
same two values `/chat/classify`'s `responseType` returns for messages that
belong on this endpoint (see `docs/FRONTEND_ROUTING_MIGRATION.md` for the
full routing table; every other `responseType` already goes to its own
dedicated endpoint and was never affected by this).

## What to do

**Whenever you call `/chat/:id/messages` right after already calling
`/chat/classify` and getting `"text"` or `"search"` back, pass that same
value through as `preClassifiedAs`.**

```json
// 1. POST /chat/classify
{ "message": "What's the capital of France?" }
// -> { "data": { "responseType": "text", ... } }

// 2. POST /chat/:id/messages
{ "message": "What's the capital of France?", "preClassifiedAs": "text" }
```

That's the entire integration change. Nothing else about the request or
response shape is different — same fields in, same fields out.

## Why

Previously, `/chat/:id/messages` re-classified every message internally
from scratch (2–3 separate LLM calls) even when you had already classified
it one call earlier via `/chat/classify`. Measured directly: **~5–7 seconds
of pure redundant classification overhead per message**, on top of the
actual reply generation.

Sending `preClassifiedAs` tells the endpoint "this has already been
classified, don't redo it" — it skips the internal reclassification
entirely and uses your `/chat/classify` result directly instead. If you
don't send it, behavior is exactly what it was before this change (slower,
but unchanged) — so this is safe to roll out gradually if you need to.

## One behavior note

When you send `preClassifiedAs: "search"`, that now directly controls
whether the reply is generated with web search enabled — it used to be
re-derived internally and could, rarely, disagree with what `/chat/classify`
told you. After this change, whatever `/chat/classify` said *is* what
happens. In practice this should just make search-triggering more
consistent, not less.

## Nothing else changed

No other endpoint, request field, or response shape changed. If you've
already implemented the routing flow in
`docs/FRONTEND_ROUTING_MIGRATION.md`, this is a one-field addition to the
`text`/`search` branch (Step 3a) of that flow — everything else in that
document is unaffected.

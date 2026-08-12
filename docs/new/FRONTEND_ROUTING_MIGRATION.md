# Frontend routing migration: classify once, dispatch directly

## Why this exists

Today, sending a message in the main chat screen goes to one endpoint —
`POST /api/v1/chat/:id/messages` — which internally classifies the message
(twice: once via `request-pipeline.service.ts`'s own classifiers, and
implicitly overlapping with whatever `/chat/classify` already told you) and
routes to image generation, video generation, document generation, or a
plain text reply, all inside that single request. Measured from real
production logs, this costs **~7+ seconds of pure classification overhead**
per message before generation even starts, because the same message gets
intent-classified by more than one independent LLM call, all before the
actual work even begins.

**The fix: classify the message once, on the frontend, then call the right
endpoint directly.** Every generation capability already has its own
dedicated endpoint — `/chat/classify` already exists specifically to tell
you which one to use; it was previously only used to pick a UI label, while
the actual routing decision was re-computed from scratch deeper in the
stack. This document makes that first classification authoritative.

**`POST /chat/:id/messages` is being kept temporarily, unmodified, for
backward compatibility only.** Do not build new integrations against its
auto-routing behavior — use the explicit flow below instead. Once this new
flow is confirmed working end-to-end, the auto-routing logic inside
`sendMessage` will be removed by hand.

This document is scoped to the routing decision itself and the request/
response shapes you need to implement it — not a full API reference for
every field every destination endpoint accepts (e.g. image style presets,
zip-download or history endpoints, edit-image-specific flows). See
`docs/API_DOCUMENTATION.md` for that.

---

## The dispatch decision, step by step

```
New message from the user
│
├─ 1. Has a file attached (image or document)?
│      → YES: skip classification entirely, go straight to
│              POST /chat/:id/messages (plain chat with the attachment).
│              This is a free, client-side, zero-network-call decision --
│              you already know the file's MIME type locally.
│
└─ 2. No attachment: call POST /chat/classify ONCE with the message text.
       Use its `responseType` to dispatch:

       "text" | "search"  → POST /chat/:id/messages   (plain chat, unchanged)
       "image"            → POST /images/generate
       "video"            → POST /videos/generate      (async job + poll)
       "artifact"         → POST /documents/wizard/detect, then:
                               needsForm: true  → /documents/wizard/start → render form → /documents/wizard/generate
                               needsForm: false → /documents/wizard/generate-direct
```

Show the UI state from `/chat/classify`'s `label`/`description` fields
immediately (e.g. "Generating image..."), then make the dispatch call —
that response arrives fast enough (~1-2s) to feel like an instant reaction,
not a second wait on top of the real generation call.

---

## Step 1: the free attachment shortcut

If the user attaches a file, check its MIME type client-side before doing
anything else:

- Image (`image/*`) → this is an **image analysis** request, not
  generation — the user wants the AI to look at and discuss the image.
- Document (pdf/docx/csv/xlsx/etc — see `ALLOWED_DOCUMENT_MIMES` in
  `src/services/upload.service.ts` for the exact list) → **document
  analysis**, same idea.

Either way, send it straight to `POST /chat/:id/messages` as today,
attachment included. Don't call `/chat/classify` first for this case — it
would only re-derive the exact same answer from the MIME type on the
backend, at the cost of a network round trip you don't need. (The backend's
own copy of this same MIME-type check inside `classify.controller.ts` still
exists — it's a safety net if some caller skips this step, not something
you should rely on as your primary path.)

---

## Step 2: classify (text-only messages, no attachment)

**Request:**
```http
POST /api/v1/chat/classify
Authorization: Bearer <token>
Content-Type: application/json

{ "message": "generate an image of a lion in the savanna" }
```

**Response** (always `200` — a failure degrades to a safe `text` default,
it never surfaces as an error to the caller):
```json
{
  "success": true,
  "data": {
    "responseType": "image",
    "confidence": 0.95,
    "subIntent": "image",
    "label": "Generating image",
    "description": "Creating your image with AI"
  }
}
```

`responseType` is one of `text`, `search`, `image`, `video`, `artifact` for
a text-only call (the `image_analysis`/`document_analysis` values only ever
come back from the attachment shortcut in Step 1, never from this call).
`label`/`description` are ready-made UI copy for a "please wait" state —
use them directly rather than hardcoding your own per-type strings.

Dispatch on `responseType` per the branches below.

---

## Step 3a: `text` / `search` → plain chat

No change from today: call `POST /chat/:id/messages` with the message as
usual. Search-augmented answers are still handled inside that same call
(the model decides per-question whether to search); classify's `search`
result is informational for your UI label, not a signal you need to act on
differently — a search-augmented reply is still just a normal chat message
in the same conversation, not a different resource, so it does not get its
own endpoint the way image/video/document generation do.

> **Known follow-up, deliberately not done yet:** `sendMessage` still
> re-derives "does this need a web search" itself internally (via
> `classifyNeedsCurrentInfo` and the pipeline's own `requiresWebSearch`
> field) instead of trusting `/chat/classify`'s `responseType: "search"`
> result — a real but comparatively small redundancy (~550ms measured),
> since `sendMessage` is the file being kept untouched for backward
> compatibility right now. When the old routing pipeline inside it is
> manually removed, that's the point to also replace this internal
> re-classification with a simple `forceWebSearch` flag read directly from
> the request body (set by the frontend from `/chat/classify`'s result) —
> a much smaller change at that point, since the image/video/document
> branches will already be gone from the handler by then too.

---

## Step 3b: `image` → `POST /images/generate`

**Request:**
```http
POST /api/v1/images/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "conversationId": "6a7b41bccbcd828dc8e4c547",
  "prompt": "a lion in the savanna at golden hour"
}
```

`conversationId` is optional but is what threads the result into the
ongoing chat — supply it and the backend pushes both a new user message and
a new assistant message (carrying the image as an attachment) into that
conversation for you; you don't build these messages client-side. Omit it
and generation still works standalone, just without landing in any
conversation.

**Response** (`201`):
```json
{
  "success": true,
  "message": "Image generated successfully",
  "data": {
    "id": "...",
    "imageUrl": "https://...",
    "prompt": "a lion in the savanna at golden hour",
    "style": "realistic",
    "width": 1024,
    "height": 1024,
    "seed": 48213,
    "generationTime": 4200,
    "model": "...",
    "createdAt": "2026-08-11T..."
  }
}
```

A content-safety block comes back as `200` (not an error status) with
`{ "success": true, "data": { "message": "<safety message>" } }` shaped
differently from a real result — check for `data.imageUrl` to distinguish
a real generation from a block.

**Follow-up edits work automatically, within the same `conversationId`** —
send "make it more vibrant" through this exact same endpoint, same
`conversationId`, and it's detected as an edit of the most recent image in
that conversation rather than a brand-new unrelated generation. There's no
separate "edit" call needed for this in-chat case.

(Optional extra fields this endpoint accepts — `negative_prompt`, `width`,
`height`, `style`, `seed` — are unchanged from before and not required for
the routing flow; see `docs/API_DOCUMENTATION.md` if you need the full set.)

---

## Step 3c: `video` → `POST /videos/generate` (async — job + poll)

This is the one genuine client-flow change versus the old chat-embedded
video branch: **it's asynchronous**, not a single awaited response, because
video rendering takes real time and this app runs multiple server
processes behind the same port.

**Request:**
```http
POST /api/v1/videos/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "conversationId": "6a7b41bccbcd828dc8e4c547",
  "prompt": "waves crashing on a rocky coastline at sunset"
}
```

**Response** (`202` — the job has been queued, not completed):
```json
{
  "success": true,
  "message": "Video generation started",
  "data": {
    "jobId": "a702b952-9751-49d5-9878-55123561013f",
    "status": "queued",
    "pollUrl": "/api/v1/videos/generate/a702b952-9751-49d5-9878-55123561013f",
    "queuedAt": "2026-08-11T...",
    "durationSeconds": 8,
    "maxDurationForPlan": 20
  }
}
```

Poll `GET <pollUrl>` every few seconds:

```json
// while in progress
{ "success": true, "data": { "jobId": "...", "status": "processing" } }

// once done
{
  "success": true,
  "data": {
    "jobId": "...",
    "status": "completed",
    "result": {
      "id": "...",
      "videoUrl": "https://...",
      "durationSeconds": 8,
      "resolution": "720p",
      "model": "...",
      "createdAt": "..."
    }
  }
}

// on failure
{ "success": true, "data": { "jobId": "...", "status": "failed", "code": "VIDEO_GENERATION_FAILED", "error": "..." } }
```

**If `conversationId` was supplied on the original request, the completed
result is threaded into the conversation automatically once the job
finishes** — same server-side pattern as images, nothing for you to build.

### Video follow-ups

**Image-to-video** — same async job/poll shape as above:
```http
POST /api/v1/videos/from-image
Content-Type: multipart/form-data

imageUrl=https://... (or an uploaded file field)
prompt=make it come alive
conversationId=6a7b41bccbcd828dc8e4c547
```
Response shape is identical to `/videos/generate`'s (`jobId`/`pollUrl`,
same polling contract). **This is a fix, not new behavior**: previously,
this endpoint created the video record and billed usage correctly but never
pushed anything into the conversation even when `conversationId` was
supplied — it now threads its result into the conversation on completion,
matching `/videos/generate`.

**Extend an existing video** — synchronous, not job-based:
```json
POST /api/v1/videos/extend
{ "conversationId": "6a7b41bccbcd828dc8e4c547", "prompt": "make it longer" }
```
```json
{ "success": true, "message": "Video extension completed", "data": { "videoUrl": "https://...", "durationSeconds": 16, "...": "..." } }
```
**This is also a fix**: `videoUrl` used to be the *only* way to say which
video to extend, and the result never got threaded anywhere. `videoUrl` is
now **optional** — omit it and supply `conversationId` instead, and the
backend resolves "the current video" by scanning that conversation for the
most recent generated video automatically (the same "current video" concept
the old chat pipeline supported as a natural follow-up). Supply `videoUrl`
explicitly if you already have it client-side and don't need the lookup.
With `conversationId`, the extended result now threads into the
conversation the same way.

---

## Step 3d: `artifact` → document flow

### First, detect

**Request:**
```http
POST /api/v1/documents/wizard/detect
Authorization: Bearer <token>
Content-Type: application/json

{ "message": "write me a resume" }
```

**Response** (always `200`, safe fallback on any internal failure):
```json
{
  "success": true,
  "data": {
    "isDocumentRequest": true,
    "documentType": "resume",
    "format": "pdf",
    "confidence": 0.95,
    "expectedResponseType": "artifact",
    "needsForm": true,
    "formReason": "This document needs your personal details to complete"
  }
}
```

Branch on `needsForm`. Pass `documentType`/`format` through to whichever
next call you make — don't re-derive them.

### `needsForm: true` — form flow

**Request:**
```http
POST /api/v1/documents/wizard/start
Content-Type: application/json

{
  "userRequest": "write me a resume",
  "documentType": "resume",
  "format": "pdf",
  "conversationId": "6a7b41bccbcd828dc8e4c547"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "html": "<!DOCTYPE html><html>...</html>",
    "conversationId": "6a7b41bccbcd828dc8e4c547",
    "userMessageId": "6a7b41f8cbcd828dc8e4c54d",
    "assistantMessageId": "6a7b41f8cbcd828dc8e4c54e"
  }
}
```

**This is a fix**: `userMessageId`/`assistantMessageId` used to have to be
invented by the frontend *before* calling this endpoint (arbitrary Mongo
ObjectIds you generated client-side) — that's gone. The server now
generates both and returns them; if `conversationId` was supplied, a user
message and an assistant message (carrying the form `html`) are already
persisted into that conversation by the time this response arrives.

Render `html` in a WebView/iframe. On submit, it `postMessage`s
`{ type: 'WIZARD_SUBMIT', data: { ...fields } }` — collect that into
`formData` and call:

```http
POST /api/v1/documents/wizard/generate
Content-Type: application/json

{
  "formData": { "fullName": "Alex Kim", "details": "5 years ICU nursing experience..." },
  "documentType": "resume",
  "format": "pdf",
  "conversationId": "6a7b41bccbcd828dc8e4c547",
  "assistantMessageId": "6a7b41f8cbcd828dc8e4c54e"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "artifacts": [
      { "url": "https://...", "fileName": "resume.pdf", "mimeType": "application/pdf" }
    ]
  }
}
```

Pass through the *exact* `assistantMessageId` `/start` returned — this call
updates that same message in place (content becomes "Your document is
ready. Download it below.", attachments become the generated artifacts)
rather than creating a new one, so the "please fill in the form" placeholder
message turns into the finished result.

### `needsForm: false` — direct flow (new endpoint)

**This case previously had no dedicated endpoint at all.** The old
documented advice was to fall back to `sendMessage`, which defeated the
entire point of classifying up front (it silently re-classifies the message
from scratch internally) and even billed/recorded the generation
inconsistently compared to the form flow above. This is now closed:

**Request:**
```http
POST /api/v1/documents/wizard/generate-direct
Content-Type: application/json

{
  "message": "write a short thank-you note to my team for finishing the Q3 project, export as PDF",
  "documentType": "letter",
  "format": "pdf",
  "conversationId": "6a7b41bccbcd828dc8e4c547"
}
```

`documentType`/`format` should be passed through from `/detect`'s response,
but both are optional here (they default to a heuristic guess and `pdf`
respectively if omitted).

**Response:**
```json
{
  "success": true,
  "data": {
    "artifacts": [
      { "url": "https://...", "fileName": "letter.pdf", "mimeType": "application/pdf" }
    ],
    "userMessageId": "6a7b4210cbcd828dc8e4c560",
    "assistantMessageId": "6a7b4210cbcd828dc8e4c561"
  }
}
```

One call, no form step, no ID coordination across requests — both the
user's original message and the finished-document assistant reply are
created and threaded into the conversation atomically in this single
response, since (unlike the form flow) there's no intermediate "show a
form and wait for the user" step in between.

---

## Summary table

| Classify result | Endpoint | Sync/async | New or changed? |
|---|---|---|---|
| Attachment present | `POST /chat/:id/messages` | sync | no |
| `text` / `search` | `POST /chat/:id/messages` | sync | no |
| `image` | `POST /images/generate` | sync | no (minor: history row now also records `conversationId`) |
| `video` | `POST /videos/generate` | async, job+poll | no |
| `video` (from an image) | `POST /videos/from-image` | async, job+poll | **fixed** — now threads into conversation |
| `video` (extend) | `POST /videos/extend` | sync | **fixed** — now conversation-aware, `videoUrl` optional |
| `artifact`, `needsForm: true` | `/documents/wizard/start` → render form → `/documents/wizard/generate` | sync (2 calls) | **fixed** — `/start` now returns server-generated IDs |
| `artifact`, `needsForm: false` | `POST /documents/wizard/generate-direct` | sync (1 call) | **new endpoint** |

None of this touched `/chat/:id/messages` itself — it's unchanged and still
fully functional for the messages that should go there (plain text/search,
and attachment-based analysis).

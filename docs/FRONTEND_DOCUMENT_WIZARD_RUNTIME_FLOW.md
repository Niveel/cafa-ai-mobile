# Frontend Document Wizard Runtime Flow

This document explains how the current mobile frontend handles the document form flow at runtime, from initial request detection to final document display after form submission.

The goal is to help backend investigation when a request is incorrectly routed into the document wizard, when a form behaves unexpectedly, or when generated documents do not appear correctly in chat.

## Relevant frontend files

- `app/(drawer)/index.tsx`
- `services/documentWizard.ts`
- `components/chat/DocumentWizardCard.tsx`
- `components/chat/document-wizard/enhanceDocumentWizardHtml.ts`
- `services/storage/documentWizardDrafts.ts`
- `components/chat/types.ts`

## High-level flow

1. User sends a normal chat message.
2. Frontend may call `POST /documents/wizard/detect`.
3. If the detector says the request is a document request with high enough confidence, frontend starts wizard mode.
4. Frontend calls `POST /documents/wizard/start` and receives raw HTML.
5. Frontend stores that HTML inside an assistant chat message under `message.documentWizard`.
6. Frontend renders the form in an iframe on web or a WebView on native.
7. The HTML form posts submitted form data back to the host via `postMessage`.
8. Frontend catches that message and calls `POST /documents/wizard/generate`.
9. Backend returns `artifacts`.
10. Frontend replaces the form assistant message with a normal assistant message containing downloadable attachments.

## Step-by-step runtime behavior

### 1. User sends a chat message

The main decision point lives in `app/(drawer)/index.tsx`.

Before normal chat send continues, the frontend checks document detection only when all of these are true:

- `screenMode === 'chat'`
- user is authenticated
- there are no attachments on the outgoing message

Code reference:

- `app/(drawer)/index.tsx:3175`
- `app/(drawer)/index.tsx:3176`

This means the wizard detection does not run on:

- dedicated media screens
- guest mode
- requests that already include uploaded attachments

### 2. Frontend calls `POST /documents/wizard/detect`

Frontend logs and sends the raw user message to:

- `POST /api/v1/documents/wizard/detect`

The service wrapper is in `services/documentWizard.ts:38`.

The request body is:

```json
{
  "message": "<raw user text>"
}
```

If the request fails for any reason, frontend does not throw. It falls back to:

```json
{
  "isDocumentRequest": false,
  "documentType": null,
  "format": null,
  "confidence": 0,
  "expectedResponseType": "text"
}
```

Code reference:

- `services/documentWizard.ts:25`
- `services/documentWizard.ts:38`

### 3. Frontend decides whether to enter document wizard mode

Current frontend routing logic is:

- use document wizard if `detection.isDocumentRequest === true`
- and `detection.confidence >= 0.7`

Code reference:

- `app/(drawer)/index.tsx:3215`

Important detail:

The frontend stores `expectedResponseType`, but it does not currently use `expectedResponseType` as the actual routing gate.

Code reference:

- `app/(drawer)/index.tsx:3190`
- `app/(drawer)/index.tsx:3215`

Practical consequence:

- if backend returns `isDocumentRequest: true` and `confidence >= 0.7`, frontend will start the form flow
- even if the request should really have been answered as plain text

So if a plain text prompt entered the wizard, that was triggered by the detector response, not by any frontend keyword matching.

### 4. Frontend creates wizard message IDs and calls `POST /documents/wizard/start`

If the detector passes the gate, frontend creates:

- `userMessageId = user-document-<timestamp>`
- `assistantMessageId = assistant-document-form-<timestamp>`

Code reference:

- `app/(drawer)/index.tsx:3226`
- `app/(drawer)/index.tsx:3227`

Then it calls:

- `POST /api/v1/documents/wizard/start`

using `startDocumentWizard(...)` from `services/documentWizard.ts:55`.

The request body is:

```json
{
  "userRequest": "<detection.documentType or raw message>",
  "conversationId": "<conversation id if available>",
  "userMessageId": "<generated user message id>",
  "assistantMessageId": "<generated assistant message id>"
}
```

Code reference:

- `app/(drawer)/index.tsx:3247`
- `services/documentWizard.ts:57`

Important detail:

Frontend prefers `detection.documentType` over the original user prompt when calling `/start`.

That means the detector output directly shapes the form that backend generates.

### 5. Backend returns raw HTML form

Frontend expects `POST /documents/wizard/start` to return:

```json
{
  "success": true,
  "data": {
    "html": "<full html string>"
  }
}
```

If `success` is false or `html` is missing, frontend throws and falls back to normal chat send.

Code reference:

- `services/documentWizard.ts:62`
- `app/(drawer)/index.tsx:3327`

Important consequence:

- a failed `/start` call does not leave the UI half-wizard, half-chat
- frontend simply abandons the wizard attempt and continues through normal chat logic

### 6. Frontend creates chat messages for the active form

After `/start` succeeds, frontend creates two chat messages:

1. A user message containing the original prompt.
2. An assistant message containing a `documentWizard` payload.

The assistant message looks conceptually like this:

```ts
{
  id: assistantMessageId,
  role: 'assistant',
  content: 'Fill in the form below and submit it here in chat...',
  documentWizard: {
    html,
    documentType,
    format,
    collapsed: false,
    userMessageId,
    assistantMessageId
  }
}
```

Code reference:

- `app/(drawer)/index.tsx:3263`
- `components/chat/types.ts:13`

The `documentWizard` object is the frontend's marker that this assistant message is not normal text yet. It is a live form container.

### 7. Frontend collapses older forms and persists the active draft

Before appending the new form, frontend collapses any older wizard messages so only the newest one stays expanded.

Code reference:

- `app/(drawer)/index.tsx:3287`
- `app/(drawer)/index.tsx:3302`

Then it persists the draft message pair locally with AsyncStorage so the unfinished form can survive navigation or app reload.

Draft storage logic:

- key format is `conversation:<conversationId>` when a conversation exists
- otherwise it uses `standalone`

Code reference:

- `app/(drawer)/index.tsx:3316`
- `services/storage/documentWizardDrafts.ts:67`
- `services/storage/documentWizardDrafts.ts:74`

### 8. Frontend renders the form

When chat messages render, any message with `message.documentWizard` is displayed using `DocumentWizardCard`.

Code reference:

- `app/(drawer)/index.tsx:6697`
- `components/chat/DocumentWizardCard.tsx:25`

Rendering behavior:

- web: uses an inline `iframe`
- native: uses `react-native-webview`

Code reference:

- `components/chat/DocumentWizardCard.tsx:102`
- `components/chat/DocumentWizardCard.tsx:115`

The frontend passes these values into the card:

- `html`
- `documentType`
- `format`
- `conversationId`
- `userMessageId`
- `assistantMessageId`
- `collapsed`

### 9. Frontend enhances backend HTML before rendering

Frontend does not render backend HTML exactly as-is.

It first passes the HTML through:

- `enhanceDocumentWizardHtml(...)`

Code reference:

- `components/chat/DocumentWizardCard.tsx:47`
- `components/chat/document-wizard/enhanceDocumentWizardHtml.ts:1`

What this enhancement layer does:

- removes top intro/title copy from the returned HTML
- injects frontend-controlled CSS for theme and sizing
- injects required markers and validation styling
- injects height reporting so the host can resize the iframe/WebView container
- injects validation behavior that blocks submit when required fields are empty

What it does not do:

- it does not itself serialize the form into the JSON payload used for `/generate`

This is a critical backend-facing detail.

The frontend expects the rendered HTML to eventually send a JSON string through one of these channels:

- `window.ReactNativeWebView.postMessage(...)` on native
- `window.parent.postMessage(...)` on web

The enhancement layer already uses those channels for height reporting, but the actual submitted form payload must also arrive as a JSON string through the same message channel.

Code reference:

- `components/chat/document-wizard/enhanceDocumentWizardHtml.ts:198`
- `components/chat/DocumentWizardCard.tsx:79`

So the effective contract is:

- backend returns HTML
- frontend decorates it
- backend-generated HTML behavior must still post final form data back to the host as JSON

### 10. Frontend receives form submission from the embedded HTML

`DocumentWizardCard` listens for messages from the iframe/WebView.

There are two kinds of payloads:

1. Height messages prefixed with `__CAFA_WIZARD_HEIGHT__:`
2. JSON form payloads

Code reference:

- `components/chat/DocumentWizardCard.tsx:22`
- `components/chat/DocumentWizardCard.tsx:57`

If the payload is not valid JSON object data, frontend ignores it.

Expected shape is effectively:

```json
{
  "fieldA": "value",
  "fieldB": "value"
}
```

### 11. Frontend calls `POST /documents/wizard/generate`

When a valid JSON object is received from the form, frontend calls:

- `POST /api/v1/documents/wizard/generate`

using `generateDocumentFromWizard(...)` from `services/documentWizard.ts:72`.

The request body is:

```json
{
  "formData": {
    "...": "..."
  },
  "documentType": "<same documentType stored on assistant message>",
  "format": "<same format stored on assistant message>",
  "conversationId": "<conversation id if available>",
  "userMessageId": "<same userMessageId from /start>",
  "assistantMessageId": "<same assistantMessageId from /start>"
}
```

Code reference:

- `components/chat/DocumentWizardCard.tsx:93`
- `services/documentWizard.ts:78`

Important detail:

The frontend does not regenerate or re-detect document type at submission time.
It reuses the values already stored on the assistant message.

### 12. Loading and error behavior during generation

While `/generate` is in flight:

- the form card shows a loading state
- accessibility announces "Generating your document."

If `/generate` fails:

- error text is shown inside the form card
- the form is not replaced
- user can reload the form card and try again

Code reference:

- `components/chat/DocumentWizardCard.tsx:89`
- `components/chat/DocumentWizardCard.tsx:194`

### 13. Backend returns artifacts

Frontend expects `/generate` to return:

```json
{
  "success": true,
  "data": {
    "artifacts": [
      {
        "type": "pdf",
        "title": "example",
        "mimeType": "application/pdf",
        "url": "https://...",
        "fileName": "example.pdf",
        "size_bytes": 12345
      }
    ]
  }
}
```

Code reference:

- `services/documentWizard.ts:86`
- `types/documentWizard.types.ts:10`

Frontend treats missing artifacts as an empty list, but a failed `success` response becomes an error.

### 14. Frontend replaces the form with final downloadable output

When generation succeeds, `handleDocumentWizardComplete(...)` runs.

Code reference:

- `app/(drawer)/index.tsx:1475`

What it does:

1. Converts backend `artifacts` into normal chat attachments.
2. Finds the assistant form message by message ID.
3. Replaces the assistant message content with:
   - `Your <documentType> is ready. Download it below.`
4. Sets `attachments` on that assistant message.
5. Removes `documentWizard` from that message.

Code reference:

- `app/(drawer)/index.tsx:1492`

This is the moment the message stops being a form and becomes a normal attachment-bearing assistant response.

So after successful generation:

- there is no longer an active wizard on that assistant message
- the document appears as a normal downloadable chat artifact

### 15. How the generated document becomes visible in chat

The generated files are shown via the normal assistant attachment rendering path, not via a special form-result component.

That means backend investigation should think of the completed state as:

- "assistant message with attachments"

not:

- "document wizard result object"

The wizard is only the temporary state before generation finishes.

## Draft persistence and resume behavior

The frontend persists unfinished forms in local storage.

This behavior matters because backend may see the same `conversationId`, `userMessageId`, or `assistantMessageId` across resumed sessions.

### What gets saved

Frontend saves the draft-related chat messages:

- the assistant message that contains `documentWizard`
- its preceding user prompt when present

Code reference:

- `app/(drawer)/index.tsx:1544`

### When drafts are restored

On screen hydration:

- frontend checks for an active draft key
- if found, it restores draft messages into chat
- if a real conversation is later hydrated from backend, local draft messages can be merged in if backend history does not already contain a wizard message

Code reference:

- `app/(drawer)/index.tsx:5641`
- `app/(drawer)/index.tsx:5732`

### When drafts are cleared

If there are no remaining wizard draft messages in the current conversation state, frontend clears the stored draft.

Code reference:

- `app/(drawer)/index.tsx:5673`
- `services/storage/documentWizardDrafts.ts:84`

## Exact frontend expectations from backend

For backend debugging, these are the practical frontend contracts.

### `/documents/wizard/detect`

Frontend expects:

- `isDocumentRequest`
- `documentType`
- `format`
- `confidence`
- `expectedResponseType`

Frontend currently routes to wizard using:

- `isDocumentRequest === true`
- `confidence >= 0.7`

It does not currently require `expectedResponseType === 'artifact'` for routing.

### `/documents/wizard/start`

Frontend expects:

- `success: true`
- `data.html` present

Frontend also forwards:

- `conversationId`
- `userMessageId`
- `assistantMessageId`

### Backend-provided HTML

Frontend expects the returned HTML to behave like an embeddable form.

It must be compatible with:

- iframe on web
- WebView on native

It must ultimately send form submission back to the host as a JSON string via `postMessage`.

The frontend does not scrape DOM fields itself.

### `/documents/wizard/generate`

Frontend expects:

- `success: true`
- `data.artifacts` array

Each artifact should include:

- `type`
- `title`
- `mimeType`
- `url`
- `fileName`
- `size_bytes`

## Investigation notes for the current issue class

If a user prompt that should have produced plain text instead opened a document form, the first thing to inspect is the detector response.

Why:

- the frontend has no keyword-based wizard trigger here
- it only followed detector output

Specifically inspect:

1. What `/documents/wizard/detect` returned for `isDocumentRequest`.
2. What it returned for `confidence`.
3. What it returned for `documentType`.
4. What it returned for `expectedResponseType`.

If backend returns:

```json
{
  "isDocumentRequest": true,
  "confidence": 0.9
}
```

the frontend will enter wizard mode today.

Even if the final ideal answer should have been text.

## Useful code anchors

- Detection gate: `app/(drawer)/index.tsx:3215`
- Start wizard request: `app/(drawer)/index.tsx:3247`
- Assistant wizard message creation: `app/(drawer)/index.tsx:3263`
- Draft persistence: `app/(drawer)/index.tsx:3316`
- Wizard render: `app/(drawer)/index.tsx:6697`
- Form submit handling: `components/chat/DocumentWizardCard.tsx:57`
- Generate request: `components/chat/DocumentWizardCard.tsx:93`
- Replace form with attachments: `app/(drawer)/index.tsx:1492`

## Short summary

The frontend treats document wizard as a temporary assistant-message state.

- Detect decides whether wizard starts.
- Start returns HTML.
- HTML is rendered inside chat.
- Submitted form posts JSON back to frontend.
- Frontend calls generate.
- Returned artifacts replace the form on the same assistant message.

If the wrong prompt entered the wizard, that is typically because detection classified it as a document request strongly enough for the frontend to trust it.

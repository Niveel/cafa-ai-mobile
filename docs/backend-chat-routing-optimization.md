# Backend-Only Chat Classification Optimization

## Objective

Reduce model-token usage caused by duplicate classification work before authenticated chat messages while requiring **no frontend changes**.

The mobile application must continue using the existing endpoints, request payloads, response payloads, and chat streaming events exactly as it does today.

## Non-Negotiable Compatibility Requirement

This optimization must be transparent to the frontend.

The backend must not require the mobile application to:

- Call a new endpoint
- Remove or reorder existing requests
- Add a request field
- Add a request header
- Add a correlation ID
- Send client-capability information
- Parse a new response schema
- Handle a new streaming event
- Change document-wizard behavior
- Perform semantic routing with regular expressions

No mobile release should be required for this optimization.

## Existing Frontend Behavior That Must Remain Supported

For every authenticated message in normal chat, the frontend concurrently calls:

1. `POST /chat/classify`
2. `POST /documents/wizard/detect`

The frontend then uses the existing responses to decide whether to:

- Continue to normal chat
- Display artifact-generation loading
- Route a chart through chat
- Call `POST /documents/wizard/start`
- Render the existing document-wizard form

The backend must preserve this behavior and all existing contracts.

## Required Backend Optimization

Both existing classification endpoints should use one shared classification operation internally.

The first request arriving for a message should start the shared classification job. If the other endpoint receives an equivalent request while that job is still running, it should await the same in-flight promise instead of starting another model call.

The shared operation should return a superset of the information needed by both endpoints:

```json
{
  "responseType": "artifact",
  "subIntent": "document_generate",
  "label": "Preparing document",
  "description": "Collecting document details",
  "isDocumentRequest": true,
  "documentType": "report",
  "format": "pdf",
  "expectedResponseType": "artifact",
  "needsForm": true,
  "formReason": "Additional information is required",
  "confidence": 0.96
}
```

This combined object is internal backend data. It must not be returned directly to the frontend unless it already matches the endpoint's existing response contract.

Each endpoint must adapt the shared result back to its current response shape.

## Existing Response Contracts Must Be Preserved

### `POST /chat/classify`

The endpoint must continue accepting its current payload and returning its current response schema.

Conceptual response:

```json
{
  "success": true,
  "data": {
    "responseType": "artifact",
    "confidence": 0.96,
    "subIntent": "document_generate",
    "label": "Preparing document",
    "description": "Collecting document details"
  }
}
```

Do not add a frontend requirement to read new fields.

### `POST /documents/wizard/detect`

The endpoint must continue accepting its current payload and returning its current response schema.

Conceptual response:

```json
{
  "success": true,
  "data": {
    "isDocumentRequest": true,
    "documentType": "report",
    "format": "pdf",
    "confidence": 0.96,
    "expectedResponseType": "artifact",
    "needsForm": true,
    "formReason": "Additional information is required"
  }
}
```

Do not add a frontend requirement to read new fields.

## In-Flight Request Coalescing

A normal completed-result cache is not sufficient because the frontend sends the two requests concurrently.

The backend needs both:

1. An in-flight job map that allows concurrent requests to await the same classification promise.
2. A short-lived completed-result cache that handles requests arriving shortly after the first job finishes.

Conceptual server-side flow:

```ts
const inFlight = new Map<string, Promise<SharedClassification>>();
const completed = new Map<string, CachedClassification>();

async function getSharedClassification(input: ClassificationInput) {
  const key = createClassificationKey(input);

  const cached = completed.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const existingJob = inFlight.get(key);
  if (existingJob) {
    return existingJob;
  }

  const job = classifyOnce(input)
    .then((result) => {
      completed.set(key, {
        value: result,
        expiresAt: Date.now() + CACHE_TTL_MS
      });
      return result;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, job);
  return job;
}
```

Both existing endpoint handlers should call this shared function and then map the result to their original response schemas.

## Classification Key

The backend must derive the key without requiring any new frontend data.

Use information already available in the existing requests and authenticated server context:

```text
authenticated user ID
normalized message
relevant attachment metadata when available
classifier model version
classifier prompt version
```

The message normalization should be conservative:

- Trim outer whitespace
- Normalize repeated whitespace
- Preserve the language and meaningful punctuation
- Do not translate or rewrite the prompt
- Do not remove words based on language-specific assumptions

Hash the resulting canonical value before using it as a map or cache key.

## Handling the Existing Attachment Difference

`/chat/classify` currently receives attachment metadata, while `/documents/wizard/detect` may receive only the message.

This must be handled entirely by the backend.

Recommended behavior:

1. Treat the message-only classification as the shared semantic base result.
2. Apply deterministic attachment adjustments in `/chat/classify` after obtaining the shared semantic result.
3. Determine attachment category from MIME type and file metadata without another model call.
4. Do not start a second language-model classification merely because one endpoint has attachment metadata.

Examples of deterministic attachment information:

- Whether an attachment exists
- Whether it is an image
- Whether it is a document
- Whether it is a spreadsheet
- Whether multiple files were attached

Semantic interpretation of the user's text must still come from the shared multilingual classifier.

If attachment context genuinely changes model classification, the backend may use a richer internal key when that metadata is already available. It must still preserve existing frontend payloads and avoid duplicate model calls wherever the existing data permits.

## Multilingual Requirements

The shared classifier must understand meaning across supported languages and mixed-language prompts.

It must not depend on frontend or backend regular expressions for semantic routing.

The classifier instructions should specify:

- Messages may be written in any language.
- Mixed-language messages are valid.
- Document types and formats must use canonical internal values.
- The original user message must not be rewritten.
- Ambiguous requests should safely default to ordinary text or indicate low confidence.
- Equivalent meanings across languages should produce equivalent classifications.

Regular expressions may be used only for deterministic parsing such as MIME types, known file extensions, or strictly defined format identifiers. They should not be the primary intent classifier.

## Model and Token Optimization

The shared classifier should:

- Use one small, inexpensive multilingual model.
- Produce one structured JSON result.
- Use a low maximum output-token limit.
- Avoid returning chain-of-thought or verbose reasoning.
- Use a short classification prompt.
- Avoid full conversation history unless the existing backend already requires it.
- Return canonical enum-like values.
- Fail safely to the existing endpoint fallback behavior.

The two endpoint handlers must never independently invoke their own classification models for the same message when a shared result is available.

## Cache Lifetime and Scope

Use a short cache lifetime because the purpose is request deduplication, not long-term semantic storage.

A starting recommendation is:

```text
In-flight entry: until the shared promise settles
Completed-result TTL: 30 to 120 seconds
```

The cache should be:

- Scoped by authenticated user
- Bounded in size
- Protected against unbounded key growth
- Cleared or naturally invalidated when classifier model or prompt versions change
- Safe for multiple backend instances

For a single backend instance, an in-memory map may be sufficient initially.

For multiple instances, use shared infrastructure such as Redis with:

- A short-lived distributed lock or single-flight mechanism
- A short-lived result entry
- Explicit timeouts
- Recovery if the lock owner fails

## Failure Behavior

Existing frontend fallback behavior must remain unchanged.

If shared classification fails:

- `/chat/classify` should return the same fallback shape it returns today.
- `/documents/wizard/detect` should return the same fallback shape it returns today.
- One endpoint failure must not leave an in-flight cache entry permanently locked.
- Errors must not expose internal prompts or model output.
- The actual chat request must remain usable.

The shared promise must always remove its in-flight entry in a `finally` block.

## Observability

Add backend-only metrics without changing frontend responses:

- `classification_shared_job_started`
- `classification_inflight_hit`
- `classification_cache_hit`
- `classification_cache_miss`
- `classification_model_tokens_input`
- `classification_model_tokens_output`
- `classification_model_latency_ms`
- `classification_endpoint_adapter`
- `classification_failure`

Logs should make it possible to confirm that two concurrent endpoint requests caused only one model operation.

Do not log full user prompts unless existing privacy and retention policies explicitly permit it. Prefer a request-safe hash for correlation.

## Acceptance Criteria

The optimization is complete when:

- The existing mobile application works without modification.
- No frontend endpoint, payload, response, or stream-event changes are required.
- `/chat/classify` preserves its existing request and response contract.
- `/documents/wizard/detect` preserves its existing request and response contract.
- Existing document-wizard behavior remains unchanged.
- Two concurrent classification requests for the same authenticated message normally produce one model call.
- Cached results expire quickly and cannot leak between users.
- Classification remains multilingual.
- The original user prompt is not rewritten.
- Failure behavior matches the current endpoint fallbacks.
- Backend metrics demonstrate reduced classification token usage.

## Out of Scope

The following changes must not be part of this optimization:

- Adding `/chat/route`
- Removing either existing endpoint from the frontend
- Adding typed chat-stream routing events
- Changing the normal chat request payload
- Adding frontend capability negotiation
- Moving intent detection into frontend regular expressions
- Requiring a coordinated mobile release

## Final Recommendation

Keep both public endpoint contracts unchanged and make them adapters over one shared, multilingual backend classification service.

Use in-flight request coalescing plus a short-lived completed-result cache so the two concurrent frontend requests reuse one model result. Apply attachment-based adjustments deterministically on the backend when possible.

This provides token savings without requiring any frontend data, API, rendering, or release change.

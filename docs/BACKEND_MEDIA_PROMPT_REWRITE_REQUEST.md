# Backend Request: Media Prompt Intent Rewrite Endpoint

## Purpose

The mobile frontend needs a backend endpoint that takes the raw user prompt from the dedicated media screens and returns:

1. the understood intent
2. a clearer rewritten prompt
3. whether that prompt belongs to the current screen

This is specifically for:
- `Edit image`
- `Image-to-video`

The goal is to remove fragile frontend intent guessing and improve UX for messy, short, or imperfect prompts.

Examples:
- User types: `change shirt to white`
- Frontend sends this to backend rewrite endpoint first
- Backend returns something like:
  - `Edit the shirt and change its current color to white while preserving the rest of the scene.`

Another example:
- User types: `change in into an african`
- Backend should still understand this as an image-edit request and return a cleaned prompt instead of forcing frontend to misclassify it.

## Why We Need This

Right now, frontend tries to detect intent using regex and heuristics. This creates UX problems:

- small spelling mistakes can trigger the wrong screen handoff
- unclear prompts can be blocked even when the user intent is obvious
- frontend has to maintain too many edge cases
- dedicated screen routing becomes brittle

Backend can do this much better with an AI-assisted interpretation pass.

## Proposed Endpoint

### Route

- `POST /api/v1/media/prompts/rewrite`

### Auth

- Same auth as other media endpoints
- Authenticated only

### Content Type

- `application/json`

## Request Payload

```json
{
  "screen": "edit-image",
  "prompt": "change shirt to white",
  "language": "en"
}
```

### Request Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `screen` | `"edit-image" \| "image-to-video"` | Yes | The screen the user is currently on |
| `prompt` | `string` | Yes | Raw user text exactly as typed |
| `language` | `string` | No | Optional locale/language hint, e.g. `en` |

## Response Payload

```json
{
  "success": true,
  "data": {
    "intent": "edit-image",
    "belongsToCurrentScreen": true,
    "requiresImage": true,
    "rewrittenPrompt": "Edit the shirt and change its current color to white while preserving the person's appearance and the rest of the scene.",
    "reason": "The user is asking for a visual edit."
  },
  "message": "Prompt interpreted successfully"
}
```

### Response Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `intent` | `"edit-image" \| "image-to-video" \| "unsupported"` | Yes | Backend's best understanding of the prompt |
| `belongsToCurrentScreen` | `boolean` | Yes | Whether frontend should continue on current screen |
| `requiresImage` | `boolean` | Yes | `true` for both dedicated media intents |
| `rewrittenPrompt` | `string` | Yes | The cleaned prompt frontend should send to the actual media generation endpoint |
| `reason` | `string` | Yes | Short explanation for debugging or optional UI use |

## Frontend Usage

Frontend flow on both dedicated media screens should become:

1. User types raw prompt
2. Frontend calls `POST /api/v1/media/prompts/rewrite`
3. Backend returns interpreted result
4. Frontend uses response rules:
   - if `belongsToCurrentScreen === true` and frontend already has an image attached, send `rewrittenPrompt` to the actual media endpoint
   - if `belongsToCurrentScreen === true` and frontend has no attached image, show the existing `upload image first` helper UI
   - if `belongsToCurrentScreen === false`, show the existing handoff UI to the appropriate screen
   - if `intent === "unsupported"`, send user to main chat

Important:
- frontend should use `data.rewrittenPrompt` as the final prompt for:
  - `POST /api/v1/media/image/edit`
  - `POST /api/v1/media/video/image-to-video`
- frontend should decide separately whether an image is attached; this rewrite endpoint should not inspect or require image input

## Exact Expected Behaviors

### Case 1: Valid edit prompt on edit-image

Request:

```json
{
  "screen": "edit-image",
  "prompt": "change shirt to white",
  "language": "en"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "intent": "edit-image",
    "belongsToCurrentScreen": true,
    "requiresImage": true,
    "rewrittenPrompt": "Edit the shirt by changing it from its current color to white while keeping the person's pose, body, and background unchanged.",
    "reason": "The request is a localized image-edit instruction."
  },
  "message": "Prompt interpreted successfully"
}
```

### Case 2: Messy edit prompt still meant for edit-image

Request:

```json
{
  "screen": "edit-image",
  "prompt": "change in into an african",
  "language": "en"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "intent": "edit-image",
    "belongsToCurrentScreen": true,
    "requiresImage": true,
    "rewrittenPrompt": "Edit the person's appearance so they look African, while preserving the composition, pose, clothing details where possible, and overall image quality.",
    "reason": "The prompt is malformed but clearly requests image editing."
  },
  "message": "Prompt interpreted successfully"
}
```

### Case 3: Video prompt on image-to-video

Request:

```json
{
  "screen": "image-to-video",
  "prompt": "make the child smile and camera move slowly",
  "language": "en"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "intent": "image-to-video",
    "belongsToCurrentScreen": true,
    "requiresImage": true,
    "rewrittenPrompt": "Generate a video where the child gradually smiles and the camera moves slowly with soft cinematic motion.",
    "reason": "The user wants image-to-video style motion generation."
  },
  "message": "Prompt interpreted successfully"
}
```

### Case 4: Edit prompt sent on image-to-video screen

Request:

```json
{
  "screen": "image-to-video",
  "prompt": "make the light all red",
  "language": "en"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "intent": "edit-image",
    "belongsToCurrentScreen": false,
    "requiresImage": true,
    "rewrittenPrompt": "Edit the image by changing the lighting so the scene appears red.",
    "reason": "The prompt requests a static image edit rather than video generation."
  },
  "message": "Prompt interpreted successfully"
}
```

Frontend should then show the existing handoff card to `Edit image`.

### Case 5: General chat request on dedicated screen

Request:

```json
{
  "screen": "edit-image",
  "prompt": "tell me the best phones in ghana",
  "language": "en"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "intent": "unsupported",
    "belongsToCurrentScreen": false,
    "requiresImage": false,
    "rewrittenPrompt": "Tell me the best phones in Ghana.",
    "reason": "This is a general chat request and does not belong to dedicated media screens."
  },
  "message": "Prompt interpreted successfully"
}
```

Frontend should then hand off to main chat.

## Backend Prompt-Rewrite Rules

Backend should follow these rules when generating `rewrittenPrompt`:

1. Preserve the user's goal, not their exact wording.
2. Fix grammar and spelling when needed.
3. Make the prompt more explicit and model-friendly.
4. Do not depend on actual image contents or image analysis.
5. For `edit-image`, frame the result as an edit instruction.
6. For `image-to-video`, frame the result as generating motion/video from an image-based scene.
7. Do not over-expand into a totally different creative request.
8. Do not block just because the wording is imperfect if the intent is still clear.
9. Keep the endpoint text-only for speed and low latency.

## Suggested Error Responses

### Validation Error

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Please provide a valid screen and prompt."
}
```

### Unsupported Screen

```json
{
  "success": false,
  "code": "UNSUPPORTED_SCREEN",
  "message": "This prompt rewrite endpoint only supports edit-image and image-to-video."
}
```

### Rewrite Failure

```json
{
  "success": false,
  "code": "PROMPT_REWRITE_FAILED",
  "message": "Could not interpret the prompt right now."
}
```

## Recommended Success Criteria

This endpoint is successful for frontend if:

1. Frontend no longer needs regex-heavy intent guessing for dedicated media screens.
2. Messy or typo-filled prompts still route correctly most of the time.
3. Frontend can rely on `belongsToCurrentScreen` instead of maintaining many edge cases.
4. Frontend can use `rewrittenPrompt` directly as the final prompt to media endpoints.
5. Wrong-screen handoffs become more accurate and less frustrating for users.

## Recommended Backend Priority

- Priority: `P0`

Reason:
- This directly affects dedicated media screen UX
- It removes avoidable false blocks
- It reduces frontend complexity and maintenance burden
- It improves user trust when prompts are short, imperfect, or informal

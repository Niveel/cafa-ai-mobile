# Document Wizard Chat Persistence Contract

**Status:** frontend implemented and ready  
**Date:** June 13, 2026  
**Scope:** make document-wizard prompts persist in chat history exactly like normal chat messages

## Goal

When a user triggers the document wizard:

1. The user's prompt should be stored in the target chat conversation.
2. The assistant's unfinished wizard card should also be stored in that same conversation.
3. If the user refreshes the app, `GET /api/v1/chat/:conversationId` should return enough data for the frontend to restore the open wizard.
4. When the form is submitted and the document is generated, that same assistant message should be updated to a completed attachment message.

The frontend is already implemented to support this contract automatically.

## Frontend Behavior Already Shipped

The mobile app now:

1. Creates or reuses a normal authenticated chat conversation before showing the wizard.
2. Sends conversation-aware metadata to the wizard endpoints.
3. Reads optional `documentWizard` metadata from `GET /api/v1/chat/:conversationId`.
4. Falls back to local draft persistence until the backend returns the wizard message in chat history.

That means once the backend starts returning the fields below, refresh persistence will switch over automatically.

## Required Backend Support

No brand-new endpoint is strictly required if you extend the existing endpoints below.

### 1. Extend `POST /api/v1/documents/wizard/start`

Current request:

```json
{
  "userRequest": "resume"
}
```

New request shape to support:

```json
{
  "userRequest": "resume",
  "conversationId": "6a2d3ad4c92099d6ded7d225",
  "userMessageId": "user-document-1718280000000",
  "assistantMessageId": "assistant-document-form-1718280000001"
}
```

### Required backend behavior for `/start`

If `conversationId`, `userMessageId`, and `assistantMessageId` are present:

1. Upsert the user message into the conversation.
2. Upsert an assistant message into the conversation with open wizard metadata.
3. Return the generated HTML as usual.

Suggested persisted user message:

```json
{
  "_id": "user-document-1718280000000",
  "role": "user",
  "content": "Create a professional resume for a senior frontend engineer applying to fintech roles.",
  "createdAt": "2026-06-13T12:00:00.000Z"
}
```

Suggested persisted assistant message:

```json
{
  "_id": "assistant-document-form-1718280000001",
  "role": "assistant",
  "content": "Fill in the form below and submit it here in chat.",
  "createdAt": "2026-06-13T12:00:01.000Z",
  "documentWizard": {
    "html": "<!DOCTYPE html><html>...</html>",
    "documentType": "resume",
    "format": "pdf",
    "state": "open",
    "collapsed": false,
    "userMessageId": "user-document-1718280000000",
    "assistantMessageId": "assistant-document-form-1718280000001"
  }
}
```

### Response for `/start`

The existing response can stay unchanged:

```json
{
  "success": true,
  "data": {
    "html": "<!DOCTYPE html><html>...</html>"
  }
}
```

## 2. Extend `POST /api/v1/documents/wizard/generate`

Current request:

```json
{
  "formData": {},
  "documentType": "resume",
  "format": "pdf"
}
```

New request shape to support:

```json
{
  "formData": {
    "fullName": "Jane Doe"
  },
  "documentType": "resume",
  "format": "pdf",
  "conversationId": "6a2d3ad4c92099d6ded7d225",
  "userMessageId": "user-document-1718280000000",
  "assistantMessageId": "assistant-document-form-1718280000001"
}
```

### Required backend behavior for `/generate`

If `conversationId` and `assistantMessageId` are present:

1. Generate the document as usual.
2. Update the existing assistant wizard message.
3. Remove the `documentWizard` field from that assistant message.
4. Attach the generated artifact(s) to that same assistant message.
5. Set a normal completion text such as `"Your resume is ready. Download it below."`

Suggested updated assistant message after generation:

```json
{
  "_id": "assistant-document-form-1718280000001",
  "role": "assistant",
  "content": "Your resume is ready. Download it below.",
  "createdAt": "2026-06-13T12:00:01.000Z",
  "attachments": [
    {
      "_id": "artifact-1",
      "fileType": "document",
      "mimeType": "application/pdf",
      "originalName": "jane_doe_resume.pdf",
      "url": "https://res.cloudinary.com/example/raw/upload/v1/jane_doe_resume.pdf"
    }
  ]
}
```

### Response for `/generate`

The existing response can stay unchanged:

```json
{
  "success": true,
  "data": {
    "artifacts": [
      {
        "type": "pdf",
        "title": "jane_doe_resume",
        "mimeType": "application/pdf",
        "url": "https://res.cloudinary.com/example/raw/upload/v1/jane_doe_resume.pdf",
        "fileName": "jane_doe_resume.pdf",
        "size_bytes": 45231
      }
    ]
  }
}
```

## 3. Extend `GET /api/v1/chat/:conversationId`

This is the key part for refresh persistence.

The `messages` array returned by the normal chat detail endpoint should support an optional `documentWizard` field on assistant messages:

```json
{
  "success": true,
  "data": {
    "_id": "6a2d3ad4c92099d6ded7d225",
    "title": "New chat",
    "messages": [
      {
        "_id": "user-document-1718280000000",
        "role": "user",
        "content": "Create a professional resume for a senior frontend engineer applying to fintech roles.",
        "createdAt": "2026-06-13T12:00:00.000Z"
      },
      {
        "_id": "assistant-document-form-1718280000001",
        "role": "assistant",
        "content": "Fill in the form below and submit it here in chat.",
        "createdAt": "2026-06-13T12:00:01.000Z",
        "documentWizard": {
          "html": "<!DOCTYPE html><html>...</html>",
          "documentType": "resume",
          "format": "pdf",
          "state": "open",
          "collapsed": false,
          "userMessageId": "user-document-1718280000000",
          "assistantMessageId": "assistant-document-form-1718280000001"
        }
      }
    ]
  }
}
```

## Supported `documentWizard` Shape

```json
{
  "html": "<!DOCTYPE html><html>...</html>",
  "documentType": "resume",
  "format": "pdf",
  "state": "open",
  "collapsed": false,
  "userMessageId": "user-document-1718280000000",
  "assistantMessageId": "assistant-document-form-1718280000001"
}
```

### Field notes

- `html`: required while the wizard is unfinished.
- `documentType`: required.
- `format`: required.
- `state`: one of `"open"`, `"collapsed"`, `"completed"`.
- `collapsed`: optional boolean for UI preference.
- `userMessageId`: optional but recommended for pairing.
- `assistantMessageId`: optional but recommended for pairing.

Once the wizard is completed, the backend should stop returning `documentWizard` on that message and instead return normal assistant `attachments`.

## Idempotency Expectations

Because the frontend sends stable `userMessageId` and `assistantMessageId`, backend writes should be idempotent:

1. Repeated `/start` calls with the same IDs should not create duplicate messages.
2. Repeated `/generate` calls with the same `assistantMessageId` should update the same assistant message instead of appending a second completion message.

## Recommended Rollout

1. Accept the extra fields on `/start` and `/generate` immediately, even if ignored at first.
2. Persist wizard messages in the chat conversation.
3. Return `documentWizard` from `GET /chat/:conversationId`.
4. Once that ships, the mobile app will automatically restore unfinished wizard cards on refresh using server data instead of local fallback.

## Frontend Files Already Prepared

- `app/(drawer)/index.tsx`
- `components/chat/DocumentWizardCard.tsx`
- `services/documentWizard.ts`
- `services/storage/documentWizardDrafts.ts`
- `features/chat/services/authenticated.ts`

No additional frontend changes should be required once the backend implements this contract.

# Frontend Artifacts API Guide

This guide covers the dedicated artifacts APIs for web and mobile.

Base API path:
- `/api/v1`

Auth:
- Required on all endpoints below
- `Authorization: Bearer <accessToken>`

---

## 1) List All Artifacts

### `GET /api/v1/artifacts`

Returns artifacts across all conversations owned by the authenticated user.

### Query Params

- `page` (optional, default `1`, min `1`)
- `limit` (optional, default `20`, min `1`, max `100`)
- `mimeType` (optional, exact match filter, e.g. `application/pdf`)
- `kind` (optional, `attachment` | `generated`)

### Success `200`

```json
{
  "success": true,
  "data": [
    {
      "artifactId": "att:6818d1...:6818d2...:0",
      "kind": "attachment",
      "conversationId": "6818d1...",
      "messageId": "6818d2...",
      "role": "assistant",
      "createdAt": "2026-05-05T15:10:22.000Z",
      "mimeType": "application/pdf",
      "fileName": "climate-report.pdf",
      "size": 2931,
      "url": "/uploads/<userId>/<conversationId>/climate-report.pdf",
      "downloadUrl": "/api/v1/artifacts/att:6818d1...:6818d2...:0/download"
    },
    {
      "artifactId": "gen:6818d1...:6818d2...:0",
      "kind": "generated",
      "conversationId": "6818d1...",
      "messageId": "6818d2...",
      "role": "assistant",
      "createdAt": "2026-05-05T15:11:12.000Z",
      "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "fileName": "draft.docx",
      "size": 12440,
      "url": "https://<storage-host>/draft.docx",
      "downloadUrl": "/api/v1/artifacts/gen:6818d1...:6818d2...:0/download"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "pages": 3
  }
}
```

### Notes

- `kind=attachment`: files stored in chat `message.attachments`.
- `kind=generated`: sandbox-generated artifacts stored in message artifact metadata.
- Items are sorted by newest `createdAt` first.

---

## 2) Download One Artifact

### `GET /api/v1/artifacts/:artifactId/download`

Resolves ownership + artifact mapping and returns:
- `302 Found` redirect to the real file URL (`url` from list response)

Use this endpoint for secure, ownership-checked downloads.

### Success

- HTTP `302` with `Location` header pointing to the file.

### Errors

- `400 VALIDATION_ERROR` (invalid artifactId format)
- `401 UNAUTHORIZED` (missing/invalid bearer header)
- `401 TOKEN_EXPIRED` (expired/invalid token)
- `404 NOT_FOUND` (artifact/conversation/message not found or not owned)
- `500 INTERNAL_ERROR`

---

## 3) Error Response Shape

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "code": "ERROR_CODE",
  "message": "Human-readable message"
}
```

Validation errors also include `errors[]` from request validator middleware.

---

## 4) Frontend Integration Notes

### Web

- Render artifacts table/grid from `GET /artifacts`.
- On download click:
  1. Call `GET /artifacts/:artifactId/download` with bearer token.
  2. Follow redirect automatically (browser default).

### Mobile

- Call `GET /artifacts/:artifactId/download` with bearer token.
- Read redirect target URL (`Location`) if your HTTP client does not auto-follow.
- Download file bytes to app storage; open/share from local path.

---

## 5) Quick Test Matrix

1. List artifacts: `GET /artifacts`
2. Filter by PDF: `GET /artifacts?mimeType=application/pdf`
3. Filter generated only: `GET /artifacts?kind=generated`
4. Pagination: `GET /artifacts?page=2&limit=10`
5. Download valid artifact: `GET /artifacts/:artifactId/download` -> `302`
6. Download invalid artifact id: `400 VALIDATION_ERROR`
7. Download artifact not owned by user: `404 NOT_FOUND`

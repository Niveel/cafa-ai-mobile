# Next.js Artifacts Implementation Guide (Mobile Parity)

This document defines how the Next.js web app should implement artifacts so behavior matches mobile and remains safe, debuggable, and scalable.

Scope:
- Authenticated web experience (same ownership model as mobile)
- Chat timeline artifact rendering
- Global artifacts library page
- Secure artifact download flow
- Reliability and fallback behavior

Related docs:
- `docs/FRONTEND_ARTIFACTS_API_GUIDE.md`
- `docs/FRONTEND_VIDEO_GENERATION_ASYNC_GUIDE.md`

## 1) Goals And Non-Goals

Goals:
- Show all user artifacts (attachments + generated outputs) in a dedicated artifacts surface.
- Ensure chat messages can display generated artifacts even when message payload is incomplete.
- Use ownership-checked backend download endpoint for every artifact download.
- Match mobile best-effort hydration and graceful fallback behavior.

Non-goals:
- Guest artifact library (mobile artifacts screen is auth-only).
- Replacing existing chat/image/video endpoints.

## 2) Canonical Artifact Contract

Use this normalized model in web state (same shape as mobile):

```ts
export type ArtifactItem = {
  artifactId: string;
  kind: 'attachment' | 'generated' | string;
  conversationId: string;
  messageId: string;
  role: 'user' | 'assistant' | 'system' | string;
  createdAt: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  url?: string;
  downloadUrl?: string;
};
```

List endpoint:
- `GET /artifacts`
- Query: `page`, `limit`, `mimeType`, `kind`, `q`

Download endpoint:
- `GET /artifacts/:artifactId/download`
- Returns `302` redirect to storage URL after ownership check.

Important:
- Prefer `url` for preview when present.
- Use `download` endpoint for user-triggered downloads.
- `artifactId` is the unique dedupe key across pages.

## 3) Required Web Surfaces

1. Chat Conversation Surface
- Assistant messages may contain image/video/file artifacts.
- Render attachments from message payload first.
- If a message has no attachments but artifact metadata exists globally, hydrate from artifacts index (see section 5).

2. Global Artifacts Library
- Route example: `/artifacts`
- Paginated list/grid of all artifacts for user.
- Search by `q` (file name, mime, url terms).
- Optional filters: `kind`, `mimeType`.
- Actions: download, open originating conversation.

3. Conversation Deep Link
- Artifact row click should route to chat with:
  - `conversationId`
  - `messageId` (optional but recommended for scroll focus)

## 4) API Client Requirements

Create `features/artifacts/services/artifacts.ts` in web app with:
- `getArtifactsPage(query)`
- Handles pagination fallback safely:
  - `page = response.pagination.page ?? query.page ?? 1`
  - `limit = response.pagination.limit ?? query.limit ?? (artifacts.length || 20)`
  - `total/pages` defaults computed if omitted.

Error handling:
- Map backend error shape (`success=false`, `code`, `message`) into typed frontend errors.
- Do not break chat rendering if artifacts endpoint fails.

## 5) Chat Hydration Strategy (Critical For Parity)

Mobile behavior to replicate:
- For an opened authenticated conversation, if assistant messages are missing attachments, perform best-effort artifact hydration from `/artifacts`.
- Match artifacts to messages by `messageId` and `conversationId`.
- Do not override already-present attachments.

Recommended algorithm:
1. After conversation detail loads, inspect assistant messages with empty attachments.
2. If any found, fetch artifacts pages (`limit=100`) up to a hard cap (suggested max 10 pages).
3. Filter artifacts to current `conversationId` and truthy `messageId` and URL (`url || downloadUrl`).
4. Group by `messageId`.
5. Patch only missing-message attachments.
6. Keep this hydration best-effort; swallow errors and continue chat usage.

Attachment mapping rules:
- `fileType = image` if `mimeType` starts with `image/`
- `fileType = video` if `mimeType` starts with `video/`
- else `fileType = artifact.kind || 'file'`
- `thumbnailUrl = url` for images

Concurrency guard:
- Track in-flight hydration per `conversationId` to avoid duplicate fetch storms.

## 6) Download Handling (Security-Safe)

Web download behavior:
- Always navigate/fetch via `GET /artifacts/:artifactId/download` (bearer auth attached).
- Let browser follow redirect to final file URL.
- Never expose private storage paths without backend ownership check.

Implementation options:
1. `window.open(downloadEndpoint, '_blank', 'noopener,noreferrer')`
2. Programmatic `fetch` + blob only if you need custom naming; still use download endpoint first.

Do not:
- Download directly from raw `url` when it could bypass ownership validation.

## 7) UX Requirements

Library page:
- Initial load spinner.
- Pull/refresh equivalent (manual refresh button on web).
- Infinite scroll or "Load more".
- Empty state with "Go to chat" CTA.
- Inline non-blocking error toast for load/download failures.

Chat page:
- Render placeholders while generation is in progress (image/video/file).
- Once completed, swap placeholder to resolved artifact attachment.
- If hydration later fills missing attachments, patch message in place without full chat reset.

Metadata display:
- `fileName` fallback to `artifactId`
- Optional secondary text: `kind`, `mimeType`, formatted `createdAt`, humanized size.

## 8) State Management Recommendations

Use React Query (recommended) or equivalent:
- Query key for library: `['artifacts', query]`
- Query key for conversation hydration: `['artifacts-hydrate', conversationId]`
- Keep dedupe by `artifactId` when appending pages.

Chat merge rules:
- Preserve optimistic/locally-enriched message fields.
- Only add missing attachments; avoid replacing complete server payloads.

## 9) Performance And Guardrails

- Page size: `20` for library; `100` for hydration scans.
- Hydration page cap: `<= 10` pages to bound latency.
- Debounce search input (200-300ms).
- Cache artifacts list briefly (for example 30-60s).
- Do not block initial chat paint on artifact hydration.

## 10) Telemetry And Debugging

Track:
- Artifacts list success/failure, latency, page count.
- Hydration started/succeeded/failed per conversation.
- Download started/succeeded/failed with error code.

Log helpful diagnostics (no sensitive payloads):
- endpoint, error code, status, conversationId, artifactId.

## 11) Security Checklist

- Require auth for library route and calls.
- Use bearer token on list/download requests.
- Use backend download endpoint for every artifact download.
- Sanitize displayed file names in UI.
- Avoid rendering untrusted HTML from artifact content.

## 12) Minimal Acceptance Checklist

- User can view all artifacts in one web page.
- Pagination and search work without duplicate rows.
- Download works via backend redirect endpoint.
- Clicking artifact opens its source conversation.
- Chat can display generated artifacts from message payload.
- Chat fills missing assistant attachments via best-effort artifact hydration.
- Hydration failures do not break message send/receive flow.

## 13) Suggested Implementation Order

1. Build typed artifacts API service and query hooks.
2. Build `/artifacts` page (list/search/pagination/download/open-chat).
3. Add chat-side best-effort artifact hydration by `conversationId + messageId`.
4. Add telemetry and error toasts.
5. Run parity QA against mobile behavior.

## 14) QA Matrix

- Library loads with existing artifacts.
- Search term matches file name/mime/url and resets correctly.
- Multi-page results dedupe by `artifactId`.
- Download returns file for owned artifact.
- Download fails cleanly for invalid/non-owned artifact.
- Chat conversation with generated image/video shows attachment.
- Chat conversation with missing message attachments gets hydrated from artifacts index.
- Hydration cap prevents endless paging.
- Regression check: normal chat and streaming still function when artifacts endpoint is down.

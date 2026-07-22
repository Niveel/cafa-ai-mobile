# Backend Request: Unarchive All Chats

Please add an authenticated bulk endpoint that restores every archived chat belonging to the current user.

## Endpoint

`PATCH /api/v1/chat/unarchive-all`

**Authentication:** Required. The user must be resolved from the access token; do not accept a user ID from the client.

**Request body:** None.

## Success response

```json
{
  "success": true,
  "data": {
    "unarchivedCount": 12
  }
}
```

Return `200` with `unarchivedCount: 0` when the user has no archived chats. The operation should be idempotent and update only chats owned by the authenticated user.

## Backend behavior

- Set `isArchived` to `false` for all of the user's archived chats in one database operation.
- Update timestamps consistently with the existing single-chat archive endpoint.
- Invalidate any cached conversation lists for that user.
- Return the number of chats actually changed.
- Use the existing API error envelope and authentication status codes.

The mobile client currently restores chats in small batches through the single-chat endpoint. After this endpoint is available, it will call this bulk endpoint instead and refresh the active and archived chat lists from the server.

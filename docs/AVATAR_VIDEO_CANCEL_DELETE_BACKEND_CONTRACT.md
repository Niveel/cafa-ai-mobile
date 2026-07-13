# Avatar Video Backend Contract

The mobile app needs these two backend capabilities.

## 1. Cancel avatar video generation

Allow a user to cancel their avatar video while it is still generating.

- `POST /api/v1/avatar/video/:id/cancel`
- The video job must belong to the authenticated user.
- Stop the generation and mark the job as `cancelled`.

## 2. Delete a generated avatar video

Allow a user to delete an already generated avatar video from their avatar history.

- `DELETE /api/v1/avatar/video/:id`
- The video must belong to the authenticated user.
- Remove it from `GET /api/v1/avatar/history`.

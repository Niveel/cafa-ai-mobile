# Cafa AI — Avatar Video Feature Integration Guide

## Overview

The Avatar Video feature allows users to create professional lip-synced talking avatar videos. The flow is:

1. User browses the avatar gallery or uploads their own photo
2. User describes what they want in plain language
3. Backend writes a professional script automatically
4. User selects a voice
5. User submits — backend generates TTS audio + lip-synced video
6. Frontend polls for completion and displays the final video

All endpoints are on: `https://cafaapi.niveel.com/api/v1`

---

## Authentication

All endpoints except `GET /avatar/gallery` and `GET /cafa-life/voices` require a Bearer token in the Authorization header:

```
Authorization: Bearer {accessToken}
```

---

## Step 1 — Load the Avatar Gallery

**Endpoint:** `GET /api/v1/avatar/gallery`

No authentication required.

**Query parameters (all optional):**
- `gender` — `male`, `female`, or `neutral`
- `style` — `professional`, `casual`, `creative`
- `limit` — number of results (default 20)

**Example request:**
```http
GET /api/v1/avatar/gallery?gender=female&style=professional
```

**Example response:**
```json
{
  "success": true,
  "data": {
    "avatars": [
      {
        "id": "6a4981682d8804120ededbbc",
        "name": "Professional Woman - African",
        "imageUrl": "https://res.cloudinary.com/.../avatar_gallery_1.jpg",
        "thumbnailUrl": "https://res.cloudinary.com/.../avatar_gallery_1_thumb.jpg",
        "gender": "female",
        "ethnicity": "african",
        "setting": "office",
        "style": "professional"
      }
    ]
  }
}
```

**UI guidance:**
- Show avatars in a grid using `thumbnailUrl` for performance
- Allow filtering by gender and style
- Highlight the selected avatar with a border/checkmark
- Include an "Upload your own photo" option alongside the gallery

---

## Step 2 — Upload Own Photo (Optional)

If the user wants to use their own photo instead of the gallery:

**Endpoint:** `POST /api/v1/avatar/upload`

Requires authentication. Send as `multipart/form-data`.

**Form field:** `image` — the photo file (JPG, PNG, WEBP)

**Example response:**
```json
{
  "success": true,
  "data": {
    "imageUrl": "https://res.cloudinary.com/.../uploaded_avatar.jpg"
  }
}
```

Store this `imageUrl` — it will be used in Step 5.

**UI guidance:**
- Accept JPG, PNG, WEBP files
- Show a preview of the uploaded photo
- Recommend portrait/headshot photos for best lip-sync results
- Max file size: 10MB

---

## Step 3 — Load Available Voices

**Endpoint:** `GET /api/v1/cafa-life/voices`

No authentication required. Call this once when the screen loads.

**Example response:**
```json
{
  "success": true,
  "data": {
    "voices": [
      {
        "id": "james",
        "name": "James",
        "gender": "male",
        "description": "Deep and authoritative",
        "default": true
      },
      {
        "id": "marcus",
        "name": "Marcus",
        "gender": "male",
        "description": "Clear and calm"
      },
      {
        "id": "amara",
        "name": "Amara",
        "gender": "female",
        "description": "Warm and friendly"
      },
      {
        "id": "sofia",
        "name": "Sofia",
        "gender": "female",
        "description": "Soft and gentle"
      }
    ],
    "defaultVoice": "james"
  }
}
```

**UI guidance:**
- Show voices as selectable cards with name, gender icon, and description
- Add a preview button per voice (see Voice Preview below)
- Pre-select `james` as default

---

## Step 3b — Voice Preview (Optional but Recommended)

Let users hear a voice before selecting it.

**Endpoint:** `POST /api/v1/cafa-life/voice-preview`

Requires authentication. Returns streaming `audio/mpeg`.

**Request body:**
```json
{
  "voice": "amara"
}
```

**UI guidance:**
- Play the audio response directly using an `<audio>` element (web) or `Audio` API (mobile)
- Show a loading spinner while the preview loads
- Previews are cached — repeated calls for the same voice are instant

---

## Step 4 — Generate Script

Send the user's goal in plain language. The backend writes a professional script automatically.

**Endpoint:** `POST /api/v1/avatar/script/generate`

Requires authentication.

**Request body:**
```json
{
  "userGoal": "Promote my bakery called Sweet Treats in Accra Ghana",
  "targetAudience": "People in Accra looking for quality baked goods",
  "tone": "friendly",
  "durationSeconds": 30,
  "useCaseTemplate": "product ad"
}
```

**Field reference:**
- `userGoal` — required. What the user wants to say or promote
- `targetAudience` — optional. Who the video is for
- `tone` — optional. `friendly`, `professional`, `motivational`, `educational`
- `durationSeconds` — optional. `15`, `30`, `45`, or `60`
- `useCaseTemplate` — optional. `product ad`, `intro`, `explainer`, `testimonial`, `pitch`, `general`

**Example response:**
```json
{
  "success": true,
  "data": {
    "script": "Welcome to Sweet Treats bakery in Accra Ghana. We specialize in fresh pastries and beautiful custom cakes for every occasion. From birthdays to weddings, we bake everything with quality ingredients and a whole lot of care. Order today and make life sweeter.",
    "estimatedDurationSeconds": 30,
    "title": "Sweet Treats Accra Bakery Ad",
    "keyPoints": [
      "Fresh pastries and desserts in Accra",
      "Custom cakes for birthdays, weddings, and events",
      "Quality ingredients with a friendly call to order"
    ]
  }
}
```

**UI guidance:**
- Show the generated script in an editable text area — users can modify it before generating the video
- Show `estimatedDurationSeconds` so users know the video length
- Show `keyPoints` as a summary below the script
- Add a "Regenerate Script" button to try again with different settings
- Keep scripts under 45 seconds (roughly 110 words) for best results

---

## Step 5 — Generate Avatar Video

Submit everything to generate the video. This returns immediately with a job ID — the actual generation happens in the background.

**Endpoint:** `POST /api/v1/avatar/video/generate`

Requires authentication.

**Request body:**
```json
{
  "avatarImageUrl": "https://res.cloudinary.com/.../avatar_gallery_1.jpg",
  "avatarType": "gallery",
  "galleryAvatarId": "6a4981682d8804120ededbbc",
  "scriptText": "Welcome to Sweet Treats bakery in Accra Ghana...",
  "userGoal": "Promote my bakery called Sweet Treats",
  "voiceName": "amara"
}
```

**Field reference:**
- `avatarImageUrl` — required. The `imageUrl` from gallery selection or upload
- `avatarType` — required. `gallery` or `upload`
- `galleryAvatarId` — required if `avatarType` is `gallery`. The `id` from the gallery response
- `scriptText` — required. The script text (edited or as-returned from Step 4)
- `userGoal` — required. The user's original goal description
- `voiceName` — required. One of `james`, `marcus`, `amara`, `sofia`

**Example response (immediate — no waiting):**
```json
{
  "success": true,
  "data": {
    "id": "6a49bc307cb07ba92a798f48",
    "status": "processing",
    "message": "Avatar video generation started. Use the job ID to check status."
  }
}
```

**UI guidance:**
- Show a full-screen loading state immediately after submission
- Display a progress message like "Generating your avatar video... this takes 5-10 minutes"
- Store the `id` and start polling (Step 6)
- Do NOT allow the user to navigate away — or save the job ID to resume polling if they do

---

## Step 6 — Poll for Video Status

Poll this endpoint every 10-15 seconds until `status` is `completed` or `failed`.

**Endpoint:** `GET /api/v1/avatar/video/{id}/status`

Requires authentication.

**Example response (still processing):**
```json
{
  "success": true,
  "data": {
    "id": "6a49bc307cb07ba92a798f48",
    "status": "audio_generated",
    "videoUrl": null,
    "audioUrl": "https://res.cloudinary.com/.../avatar_audio.mp3",
    "scriptText": "Welcome to Sweet Treats...",
    "generationTime": null,
    "createdAt": "2026-07-05T02:06:40.944Z"
  }
}
```

**Status values and what to show the user:**

| Status | User message |
|---|---|
| `script_ready` | Preparing your avatar... |
| `audio_generated` | Voice generated, creating lip-sync video... |
| `video_generating` | Animating your avatar... almost there! |
| `completed` | Your avatar video is ready! |
| `failed` | Generation failed. Please try again. |

**Example response (completed):**
```json
{
  "success": true,
  "data": {
    "id": "6a49bc307cb07ba92a798f48",
    "status": "completed",
    "videoUrl": "https://res.cloudinary.com/.../avatar_video.mp4",
    "audioUrl": "https://res.cloudinary.com/.../avatar_audio.mp3",
    "scriptText": "Welcome to Sweet Treats...",
    "generationTime": 293827,
    "createdAt": "2026-07-05T02:06:40.944Z"
  }
}
```

**UI guidance:**
- Poll every 10-15 seconds
- Update the progress message based on the `status` field
- When `completed` — show the video player with `videoUrl`
- When `failed` — show error message and a "Try Again" button
- Stop polling once `status` is `completed` or `failed`

---

## Step 7 — Display Completed Video

When status is `completed`, show:
- A video player with the `videoUrl` (MP4)
- The script text used
- The voice name selected
- Generation time (convert `generationTime` ms to seconds)
- Download button
- Share button
- "Create Another" button

---

## Step 8 — Avatar Video History

Show the user's previously generated avatar videos.

**Endpoint:** `GET /api/v1/avatar/history`

Requires authentication.

**Query parameters (optional):**
- `page` — page number (default 1)
- `limit` — results per page (default 20, max 50)

**Example response:**
```json
{
  "success": true,
  "data": {
    "videos": [
      {
        "id": "6a49bc307cb07ba92a798f48",
        "avatarImageUrl": "https://res.cloudinary.com/.../avatar.jpg",
        "scriptText": "Welcome to Sweet Treats...",
        "voiceName": "amara",
        "videoUrl": "https://res.cloudinary.com/.../avatar_video.mp4",
        "status": "completed",
        "generationTime": 293827,
        "createdAt": "2026-07-05T02:06:40.944Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

**UI guidance:**
- Show as a grid of video thumbnails
- Show avatar image, script preview, voice name, and date
- Tap to open and replay the video
- Only show videos with `status === "completed"`

---

## Complete Flow Summary

```
Screen 1: Avatar Selection
  → GET /avatar/gallery
  → User picks from gallery OR uploads photo (POST /avatar/upload)
  → User taps "Next"

Screen 2: Script Generation
  → User types their goal
  → POST /avatar/script/generate
  → Show editable script
  → User reviews/edits and taps "Next"

Screen 3: Voice Selection
  → GET /cafa-life/voices
  → Show 4 voice options with preview buttons
  → POST /cafa-life/voice-preview (on preview tap)
  → User selects voice and taps "Generate Video"

Screen 4: Generation Loading
  → POST /avatar/video/generate (immediate response)
  → Poll GET /avatar/video/{id}/status every 10-15 seconds
  → Update progress message based on status
  → When completed → navigate to Screen 5

Screen 5: Result
  → Show video player
  → Download / Share / Create Another buttons

Screen 6: History
  → GET /avatar/history
  → Grid of past videos
```

---

## Important Notes

- **Script length:** Keep scripts under 45 seconds (roughly 110 words) for best results. Longer scripts may fail or take longer.
- **Photo quality:** For uploaded photos, use clear front-facing portrait/headshot images. The face must be clearly visible.
- **Generation time:** Typically 5-10 minutes per video. Always use the polling approach — never wait synchronously.
- **Video format:** All videos are returned as MP4 from Cloudinary. Compatible with all standard video players.
- **Voice IDs:** Always use the `id` field from the voices endpoint (`james`, `marcus`, `amara`, `sofia`) — not the display name.

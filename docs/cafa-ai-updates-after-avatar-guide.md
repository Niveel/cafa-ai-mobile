# Cafa AI — Updates After Avatar Integration Guide

This document covers everything added AFTER the initial Avatar Feature Integration Guide.
Read this alongside the original avatar guide.

**Base URL:** `https://cafaapi.niveel.com/api/v1`

---

## 1. Avatar Voice System — Major Update

The avatar now uses 20 voices. The voice endpoints for avatar are completely separate from Cafa Life voices.

### 1.1 Get Avatar Voice Library

`GET /api/v1/avatar/voices`

No authentication required.

**Query params (all optional):**
- `gender` — `male` or `female`
- `category` — `professional`, `african`, `creative`, `entertainment`
- `popular` — `true` for popular voices only

**Example response:**
```json
{
  "success": true,
  "data": {
    "voices": [
      {
        "id": "sarah",
        "name": "Sarah",
        "gender": "female",
        "style": "professional",
        "description": "Clear and professional",
        "category": "professional",
        "popular": true
      },
      {
        "id": "bukola",
        "name": "Bukola",
        "gender": "female",
        "style": "african",
        "description": "West African female accent",
        "category": "african",
        "popular": true
      },
      {
        "id": "kofi",
        "name": "Kofi",
        "gender": "male",
        "style": "african",
        "description": "Calm African male",
        "category": "african",
        "popular": true
      }
    ],
    "total": 20,
    "categories": ["professional", "african", "creative", "entertainment"]
  }
}
```

**Full voice list:**

| ID | Name | Gender | Category | Description |
|---|---|---|---|---|
| sarah | Sarah | Female | Professional | Clear and professional |
| emma | Emma | Female | Professional | British professional |
| jasmine | Jasmine | Female | Professional | Warm and friendly |
| victoria | Victoria | Female | Professional | Natural female voice |
| aria | Aria | Female | Creative | Expressive and sassy |
| luna | Luna | Female | Creative | Soft and gentle |
| charlotte | Charlotte | Female | Professional | British female |
| nova | Nova | Female | Creative | Futuristic and bold |
| bukola | Bukola | Female | African | West African female accent |
| kofi | Kofi | Male | African | Calm African male |
| emeka | Emeka | Male | African | Professional Nigerian male |
| adrian | Adrian | Male | Professional | Professional male |
| marcus | Marcus | Male | Professional | Energetic male |
| alex | Alex | Male | Professional | Expressive narrator |
| james | James | Male | Professional | Deep narrator voice |
| polo | Polo | Male | Professional | Casual and friendly |
| edward | Edward | Male | Professional | British warm and deep |
| elite | Elite | Male | Creative | Bold and commanding |
| alle | Alle | Male | Creative | Dynamic and versatile |
| max | Max | Male | Entertainment | Powerful announcer |

---

### 1.2 Preview Any Avatar Voice

`POST /api/v1/avatar/voices/preview`

Requires authentication. Streams a short audio sample so users can hear the voice before selecting.

**Request body — use ONE of these:**
```json
{ "voiceId": "bukola" }
```
OR for cloned voices:
```json
{ "fishAudioId": "56771862f633485796950ad09eaf6109" }
```

**Response:** Streaming `audio/mpeg`

Previews are cached — repeat calls for the same voice are instant.

**UI guidance:**
- Show a play button on each voice card
- Call this endpoint when user taps play and stream the audio
- Stop any currently playing preview before starting a new one

---

### 1.3 Voice Cloning

Users can clone their own voice from a short audio recording (minimum 10 seconds).

**Clone a voice:**

`POST /api/v1/avatar/voices/clone`

Requires authentication. Send as `multipart/form-data`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `audio` | File | Yes | MP3, WAV, M4A or OGG. Min 10 seconds, max 50MB |
| `name` | String | Yes | User-friendly name e.g. "My Work Voice" |

**Example response:**
```json
{
  "success": true,
  "data": {
    "id": "6a4b4f0e72b14a77328a4cb0",
    "fishAudioId": "56771862f633485796950ad09eaf6109",
    "name": "My Work Voice",
    "status": "ready"
  },
  "message": "Voice cloned successfully"
}
```

**Get user's cloned voices:**

`GET /api/v1/avatar/voices/clones`

Requires authentication.

```json
{
  "success": true,
  "data": {
    "clones": [
      {
        "id": "6a4b4f0e72b14a77328a4cb0",
        "name": "My Work Voice",
        "fishAudioId": "56771862f633485796950ad09eaf6109",
        "status": "ready",
        "createdAt": "2026-07-06T06:45:34.368Z"
      }
    ]
  }
}
```

**UI guidance:**
- Show cloned voices in a separate "My Voices" section below the library voices
- Add a "Clone My Voice" button that opens a recording or upload flow
- Each cloned voice has a preview button — use `POST /avatar/voices/preview` with `fishAudioId`
- The `fishAudioId` is safe to store and send back in subsequent requests

---

### 1.4 Updated Video Generation Request

`POST /api/v1/avatar/video/generate`

The `voiceName` field now accepts the new 20-voice IDs. The request body also accepts new optional fields:

**With library voice:**
```json
{
  "avatarImageUrl": "https://...",
  "avatarType": "gallery",
  "galleryAvatarId": "6a4981682d8804120ededbbc",
  "scriptText": "Welcome to Sweet Treats bakery...",
  "userGoal": "Promote Sweet Treats bakery",
  "voiceName": "bukola",
  "useCaseTemplate": "product ad"
}
```

**With cloned voice (send `fishAudioId` instead of `voiceName`):**
```json
{
  "avatarImageUrl": "https://...",
  "avatarType": "gallery",
  "galleryAvatarId": "6a4981682d8804120ededbbc",
  "scriptText": "Welcome to Sweet Treats bakery...",
  "userGoal": "Promote Sweet Treats bakery",
  "fishAudioId": "56771862f633485796950ad09eaf6109",
  "useCaseTemplate": "product ad"
}
```

**New fields:**

| Field | Type | Notes |
|---|---|---|
| `voiceName` | String | Now uses the 20-voice IDs e.g. `bukola`, `sarah`, `kofi`, `adrian` |
| `fishAudioId` | String | Use instead of `voiceName` for cloned voices |
| `useCaseTemplate` | String | Optional. `product ad`, `intro`, `explainer`, `testimonial`, `pitch`, `general` |

**Important:** Send either `voiceName` OR `fishAudioId` — not both.

**Note on emotion enhancement:** The backend automatically enhances the script with natural emotion cues before audio generation. This is invisible to the user. The `scriptText` in the response always shows the original clean script.

---

### 1.5 Status Response (Updated)

`GET /api/v1/avatar/video/:id/status`

The response always shows the original clean script:

```json
{
  "success": true,
  "data": {
    "id": "6a4b32979620d81ec8e14c02",
    "status": "completed",
    "videoUrl": "https://res.cloudinary.com/.../avatar_video.mp4",
    "audioUrl": "https://res.cloudinary.com/.../avatar_audio.mp3",
    "scriptText": "Welcome to Sweet Treats bakery...",
    "generationTime": 506244,
    "createdAt": "2026-07-06T04:44:07.520Z"
  }
}
```

---

## 2. Text to Speech (New Feature)

Users can convert any text to audio and download it as MP3 or WAV using any of the 20 avatar voices or their own cloned voices.

### 2.1 Convert Text to Speech

`POST /api/v1/tts/convert`

Requires authentication.

**With library voice:**
```json
{
  "text": "Hello! Welcome to Cafa AI. Your all-in-one AI assistant.",
  "voiceId": "bukola",
  "format": "mp3"
}
```

**With cloned voice:**
```json
{
  "text": "Hello! This is my own cloned voice on Cafa AI.",
  "fishAudioId": "56771862f633485796950ad09eaf6109",
  "format": "mp3"
}
```

**Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `text` | String | Yes | Free tier max 500 chars, paid tiers max 3000 chars |
| `voiceId` | String | One of these | Voice ID from the 20-voice library |
| `fishAudioId` | String | One of these | fishAudioId from a cloned voice |
| `format` | String | No | `mp3` or `wav`. Default `mp3` |

**Example response:**
```json
{
  "success": true,
  "data": {
    "id": "mongo_conversion_id",
    "audioUrl": "https://res.cloudinary.com/.../tts_audio.mp3",
    "text": "Hello! Welcome to Cafa AI.",
    "voiceId": "bukola",
    "format": "mp3",
    "duration": 5,
    "createdAt": "2026-07-06T10:00:00.000Z"
  }
}
```

**Tier limits:**
- Free tier: max 500 characters per request
- Cafa Smart / Pro / Max: max 3000 characters per request

**UI guidance:**
- Show a live character counter as the user types
- Show remaining characters based on their tier
- After conversion, show an inline audio player with the `audioUrl`
- Add a download button linking directly to the `audioUrl`

---

### 2.2 TTS History

`GET /api/v1/tts/history`

Requires authentication.

**Query params:** `page` (default 1), `limit` (default 20, max 50)

**Example response:**
```json
{
  "success": true,
  "data": {
    "conversions": [
      {
        "id": "mongo_id",
        "text": "Hello! Welcome to Cafa AI.",
        "voiceId": "bukola",
        "voiceName": "Bukola",
        "format": "mp3",
        "audioUrl": "https://res.cloudinary.com/.../tts_audio.mp3",
        "duration": 5,
        "characterCount": 26,
        "createdAt": "2026-07-06T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5
    }
  }
}
```

---

### 2.3 TTS Voice List

`GET /api/v1/tts/voices`

No authentication required. Returns the same 20 voices as `GET /avatar/voices`. Use whichever endpoint is more convenient for your screen.

---

### 2.4 TTS Voice Preview

`POST /api/v1/tts/preview`

No authentication required. Same behaviour as `POST /avatar/voices/preview`.

**Request body:**
```json
{ "voiceId": "sarah" }
```
OR:
```json
{ "fishAudioId": "abc123" }
```

**Response:** Streaming `audio/mpeg`

---

## 3. Chat Message Character Limit

The chat endpoint now enforces a **1500 character limit** per message.

If exceeded, the API returns:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "code": "VALIDATION_ERROR",
  "message": "Message too long. Maximum 1500 characters allowed."
}
```

**UI guidance:**
- Show a live character counter in the chat input
- Disable the send button or show a warning when the limit is reached
- Display format: `1,234 / 1,500`

---

## 4. Document Wizard — New Field

`POST /api/v1/documents/wizard/detect`

The response now includes `expectedResponseType` to help show the correct loading animation:

```json
{
  "success": true,
  "data": {
    "isDocumentRequest": true,
    "documentType": "resume",
    "format": "pdf",
    "confidence": 0.95,
    "expectedResponseType": "artifact"
  }
}
```

**expectedResponseType values:**

| Value | Meaning | UI Action |
|---|---|---|
| `text` | Normal chat response | No loading animation |
| `image` | Image being generated | Show image loading animation |
| `video` | Video being generated | Show video loading animation |
| `artifact` | Document being generated | Show document loading animation |

Call this endpoint before every chat message send to determine which loading state to show.

---

## 5. Cafa Life Voice Selection (Updated)

`POST /api/v1/cafa-life/token` now accepts an optional `voice` field:

```json
{
  "voice": "amara"
}
```

**Available Cafa Life voices — these are DIFFERENT from avatar voices:**

| ID | Name | Gender | Character |
|---|---|---|---|
| `james` | James | Male | Deep and authoritative (default) |
| `marcus` | Marcus | Male | Clear and calm |
| `amara` | Amara | Female | Warm and friendly |
| `sofia` | Sofia | Female | Soft and gentle |

`GET /api/v1/cafa-life/voices` — returns these 4 voices. No auth required.

`POST /api/v1/cafa-life/voice-preview` — streams a preview for Cafa Life voices only. Requires auth.

```json
{ "voice": "amara" }
```

---

## 6. Updated Avatar Screen Flow

```
Screen 1: Avatar Selection
  → GET /avatar/gallery

Screen 2: Script Generation
  → POST /avatar/script/generate
  → Add optional: useCaseTemplate
    e.g. "product ad", "explainer", "testimonial", "pitch"

Screen 3: Voice Selection (UPDATED)
  → GET /avatar/voices  ← 20 avatar voices (not /cafa-life/voices)
  → GET /avatar/voices/clones  ← user's cloned voices
  → Show both together, with preview buttons
  → POST /avatar/voices/preview  ← preview any voice
  → POST /avatar/voices/clone  ← "Clone My Voice" button

Screen 4: Video Generation (UPDATED)
  → POST /avatar/video/generate
  → Send voiceName (library) OR fishAudioId (cloned voice)
  → Optionally send useCaseTemplate
  → Returns immediately: { id, status: "processing" }

Screen 5: Polling
  → GET /avatar/video/:id/status every 10-15 seconds
  → scriptText always shows original clean script

Screen 6: Result
  → Show video player with videoUrl
```

---

## 7. New TTS Screen Flow

```
Screen: Text to Speech

1. Load voices:
   GET /tts/voices (20 library voices)
   GET /avatar/voices/clones (user's cloned voices)

2. User selects a voice
   Preview: POST /tts/preview

3. User types text
   Show character counter
   Free: max 500 chars | Paid: max 3000 chars

4. User selects format: MP3 or WAV

5. POST /tts/convert
   → Show audio player with audioUrl
   → Download button

6. GET /tts/history — past conversions
```

---

## 8. Complete Endpoint Reference

### Avatar

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/avatar/gallery` | No | Browse avatar images |
| POST | `/avatar/upload` | Yes | Upload own photo |
| POST | `/avatar/script/generate` | Yes | AI writes script |
| GET | `/avatar/voices` | No | 20 avatar voices |
| POST | `/avatar/voices/preview` | Yes | Preview any voice or clone |
| POST | `/avatar/voices/clone` | Yes | Clone user's voice |
| GET | `/avatar/voices/clones` | Yes | User's cloned voices |
| POST | `/avatar/video/generate` | Yes | Start video generation |
| GET | `/avatar/video/:id/status` | Yes | Poll status |
| GET | `/avatar/history` | Yes | Past avatar videos |

### TTS (New)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/tts/voices` | No | Same 20 voices as avatar/voices |
| POST | `/tts/preview` | No | Preview any voice |
| POST | `/tts/convert` | Yes | Convert text to audio |
| GET | `/tts/history` | Yes | Past TTS conversions |

### Cafa Life (Updated)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/cafa-life/voices` | No | 4 Cafa Life voices |
| POST | `/cafa-life/voice-preview` | Yes | Preview a Cafa Life voice |
| POST | `/cafa-life/token` | Yes | Start session (now accepts voice field) |
| GET | `/cafa-life/history` | Yes | Session history |

### Document Wizard (Updated)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/documents/wizard/detect` | Yes | Now returns expectedResponseType |
| POST | `/documents/wizard/start` | Yes | Start wizard |
| POST | `/documents/wizard/generate` | Yes | Generate document |
| GET | `/documents/wizard/history` | Yes | Document history |

---

## 9. Key Notes

- **Avatar voices and Cafa Life voices are completely different.** Avatar uses 20 voices. Cafa Life uses 4 voices (james, marcus, amara, sofia). Never mix them up.
- **fishAudioId from cloned voices** is safe to store on the frontend and send back in requests.
- **Emotion enhancement is invisible.** Backend adds natural emotion cues automatically. The user always sees the original clean script.
- **Chat limit is 1500 characters.** Show a counter in the chat input.
- **TTS tier limits:** Free = 500 chars max, Paid tiers = 3000 chars max per request.
- **Voice cloning minimum:** Audio must be at least 10 seconds. Accept MP3, WAV, M4A, OGG.

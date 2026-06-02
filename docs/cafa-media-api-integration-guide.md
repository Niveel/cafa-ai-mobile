# Cafa AI Media API — Frontend Integration Guide

## Base URL
```
https://cafaapi.niveel.com/api/v1
```

## Authentication
All requests require a Bearer token in the Authorization header:
```
Authorization: Bearer <accessToken>
```

---

## 1. Image Edit Endpoint

### `POST /media/image/edit`

Uploads an image and edits it based on a text prompt.

**Request**
```
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|---|---|---|---|
| `image` | File | Yes | JPEG, PNG or WebP. Max 10MB |
| `prompt` | String | Yes | Description of the edit to make |

**Success Response (200)**
```json
{
  "success": true,
  "imageUrl": "https://cdn.example.com/edited-image.jpg",
  "generationTime": 10875
}
```

**Example (JavaScript)**
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('prompt', 'make the background blue');

const response = await fetch('https://cafaapi.niveel.com/api/v1/media/image/edit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: formData
});

const data = await response.json();
if (data.success) {
  console.log(data.imageUrl);
}
```

---

## 2. Image to Video Endpoint

### `POST /media/video/image-to-video`

Uploads an image and generates a video based on a text prompt.

**Request**
```
Content-Type: multipart/form-data
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `image` | File | Yes | — | JPEG, PNG or WebP. Max 10MB |
| `prompt` | String | Yes | — | Description of the video motion |
| `duration` | Number | No | 5 | Video duration in seconds (5 or 10) |
| `aspectRatio` | String | No | `16:9` | `16:9`, `9:16`, or `1:1` |

**Success Response (200)**
```json
{
  "success": true,
  "videoUrl": "https://cdn.example.com/generated-video.mp4",
  "generationTime": 117267,
  "duration": 5
}
```

**Example (JavaScript)**
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('prompt', 'a dog running through a park');
formData.append('duration', '5');
formData.append('aspectRatio', '16:9');

const response = await fetch('https://cafaapi.niveel.com/api/v1/media/video/image-to-video', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: formData
});

const data = await response.json();
if (data.success) {
  console.log(data.videoUrl);
}
```

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "User friendly message"
}
```

| Code | HTTP | Message | Action |
|---|---|---|---|
| `MISSING_IMAGE` | 400 | Please upload an image to continue | Show file picker |
| `INVALID_IMAGE` | 400 | The uploaded image appears to be empty or corrupted | Ask user to re-upload |
| `INVALID_FILE_TYPE` | 400 | Only JPEG, PNG, and WebP images are supported | Validate file type before upload |
| `MISSING_PROMPT` | 400 | Please provide a prompt describing what you want | Show prompt input |
| `CONTENT_SAFETY_BLOCKED` | 400 | Your image or prompt was flagged. Please try different content | Show warning to user |
| `UPLOAD_FAILED` | 502 | Failed to process your image. Please try again | Retry button |
| `GENERATION_TIMEOUT` | 504 | Generation timed out. Please try again | Retry button |
| `USAGE_LIMIT_EXCEEDED` | 429 | You've reached your monthly limit. Please upgrade your plan | Show upgrade screen |
| `UNAUTHORIZED` | 401 | — | Redirect to login |

---

## Notes for Frontend Developer

- **Video generation takes time** — typically 60-180 seconds. Show a loading spinner or progress indicator.
- **Image editing takes time** — typically 10-15 seconds. Show a loading state.
- **Do not set `Content-Type` header manually** when using `FormData` — let the browser set it automatically with the correct boundary.
- **File validation** — validate file type and size on the frontend before uploading to avoid unnecessary requests:

```javascript
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxSize = 10 * 1024 * 1024; // 10MB

if (!allowedTypes.includes(file.type)) {
  alert('Only JPEG, PNG and WebP images are supported');
  return;
}
if (file.size > maxSize) {
  alert('Image must be 10MB or smaller');
  return;
}
```

---

## React Example (Image Edit)

```jsx
import { useState } from 'react';

export default function ImageEditor() {
  const [image, setImage] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!image || !prompt.trim()) return;

    const formData = new FormData();
    formData.append('image', image);
    formData.append('prompt', prompt);

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('https://cafaapi.niveel.com/api/v1/media/image/edit', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.imageUrl);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input type="file" accept="image/jpeg,image/png,image/webp"
        onChange={e => setImage(e.target.files[0])} />
      <input type="text" placeholder="Describe your edit..."
        value={prompt} onChange={e => setPrompt(e.target.value)} />
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Editing...' : 'Edit Image'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && <img src={result} alt="Edited" />}
    </div>
  );
}
```

---

## React Example (Image to Video)

```jsx
import { useState } from 'react';

export default function ImageToVideo() {
  const [image, setImage] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!image || !prompt.trim()) return;

    const formData = new FormData();
    formData.append('image', image);
    formData.append('prompt', prompt);
    formData.append('duration', String(duration));
    formData.append('aspectRatio', aspectRatio);

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('https://cafaapi.niveel.com/api/v1/media/video/image-to-video', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.videoUrl);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input type="file" accept="image/jpeg,image/png,image/webp"
        onChange={e => setImage(e.target.files[0])} />
      <input type="text" placeholder="Describe the video motion..."
        value={prompt} onChange={e => setPrompt(e.target.value)} />
      <select value={duration} onChange={e => setDuration(Number(e.target.value))}>
        <option value={5}>5 seconds</option>
        <option value={10}>10 seconds</option>
      </select>
      <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
        <option value="16:9">Landscape (16:9)</option>
        <option value="9:16">Portrait (9:16)</option>
        <option value="1:1">Square (1:1)</option>
      </select>
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Generating video... (this may take 1-3 minutes)' : 'Generate Video'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && <video src={result} controls style={{ maxWidth: '100%' }} />}
    </div>
  );
}
```

# Cafa AI Mobile Native Package Plan (One Build)

This list was derived from:
- `docs/API_DOCUMENTATION.md`
- `docs/CAFA_AI_MOBILE_BUILD_GUIDE.md`
- `docs/FRONTEND_*` guides
- Web app feature modules in `C:\Users\Good\Desktop\Klasique_projects\cafa_ai_web\features\*`

## Installed Core Native Packages

- `expo-secure-store`  
  Token/session persistence.

- `expo-image-picker`  
  Pick image attachments and avatar photos.

- `expo-document-picker`  
  Pick document/file attachments for chat uploads.

- `expo-camera`  
  Camera capture for future attachment/avatar capture flows.

- `expo-media-library`  
  Save generated images/videos to device gallery.

- `expo-file-system`  
  File download caching and ZIP/image/video persistence.

- `expo-sharing`  
  Share downloaded/generated files to other apps.

- `expo-video`  
  Native video playback for generated/history videos.

- `expo-audio`  
  Native audio recording/playback for voice flows.

- `expo-speech-recognition`  
  On-device speech-to-text (guest/authenticated composer dictation).

- `expo-speech`  
  Native read-aloud fallback (guest mode and local TTS UX).

- `expo-clipboard`  
  Copy assistant responses.

- `expo-haptics`  
  Tactile feedback for utility actions.

- `expo-blur`  
  Settings/backdrop blur effects.

## Why this covers feature parity

These packages cover all documented mobile parity surfaces:
- chat attachments (image + document)
- image/video generation history + download/share/save
- voice transcription input
- text-to-speech/read-aloud UX
- local secure auth persistence

## iOS permission coverage added in `app.json`

- Camera
- Photo library read
- Photo library add/save
- Microphone
- Speech recognition

## One-time rebuild command

After native package/plugin changes, rebuild once:

```bash
npx expo run:android
# and/or
npx expo run:ios
```

Then run:

```bash
npx expo start --dev-client
```

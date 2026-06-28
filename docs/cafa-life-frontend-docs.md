# Cafa Life — Frontend Integration Documentation

**Project:** Cafa AI  
**Feature:** Cafa Life (Real-Time Voice Assistant)  
**Backend:** `https://cafaapi.niveel.com`  
**Prepared for:** Frontend Developer  
**Covers:** React Web + Expo React Native

---

## Overview

Cafa Life is a real-time voice conversation feature. The user speaks, the AI listens and responds with voice. It is powered by LiveKit (WebRTC), Groq Whisper (STT), OpenAI GPT-4o-mini (LLM), and OpenAI TTS (voice).

The frontend does **not** call OpenAI or Groq directly. It only:
1. Calls the Cafa API to get a LiveKit room token
2. Connects to LiveKit using that token
3. Publishes the user's microphone audio
4. Plays back the agent's audio automatically via LiveKit

---

## Authentication

All Cafa Life endpoints require the user to be logged in with a valid JWT access token.

### Login

```
POST https://cafaapi.niveel.com/api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc..."
    },
    "user": {
      "_id": "6a0dc62f...",
      "name": "John Doe",
      "email": "user@example.com"
    }
  }
}
```

Store `accessToken` in memory (or secure storage on mobile). Pass it as `Authorization: Bearer <token>` on all subsequent requests.

---

## Cafa Life API Endpoints

### 1. Get LiveKit Token

This is the only Cafa Life API call. It creates a LiveKit room for this user and returns the connection credentials.

```
POST https://cafaapi.niveel.com/api/v1/cafa-life/token
Authorization: Bearer <accessToken>
Content-Type: application/json
```

No request body needed.

**Success Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "livekitUrl": "wss://cafa-life-2s49fgki.livekit.cloud",
    "roomName": "cafa-life-6a0dc62f4045fa59a56bcfc5-1782455871359"
  }
}
```

| Field | Description |
|-------|-------------|
| `token` | LiveKit JWT — pass directly to `room.connect()` |
| `livekitUrl` | LiveKit server WebSocket URL |
| `roomName` | The room this user is assigned to |

### 2. Get Conversation History (optional)

Fetch the user's last 20 conversation turns for display purposes.

```
GET https://cafaapi.niveel.com/api/v1/cafa-life/history
Authorization: Bearer <accessToken>
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "turns": [
      { "role": "user", "content": "Hello!", "timestamp": "2026-06-26T05:44:25Z" },
      { "role": "assistant", "content": "Hi there! How can I help you?", "timestamp": "2026-06-26T05:44:26Z" }
    ]
  }
}
```

---

## LiveKit Integration

### Install the SDK

**Web (React):**
```bash
npm install livekit-client
```

**Mobile (Expo React Native):**
```bash
npx expo install @livekit/react-native @livekit/react-native-webrtc
```

For Expo, also add to `app.json` / `app.config.js`:
```json
{
  "expo": {
    "plugins": [
      [
        "@livekit/react-native-webrtc",
        {
          "cameraPermission": "Allow Cafa to access your camera",
          "microphonePermission": "Allow Cafa to access your microphone"
        }
      ]
    ]
  }
}
```

---

## Session Flow

```
User taps "Start"
     ↓
POST /api/v1/cafa-life/token  →  get { token, livekitUrl }
     ↓
room.connect(livekitUrl, token)
     ↓
room.localParticipant.setMicrophoneEnabled(true)
     ↓
Agent joins room automatically (server-side)
Agent speaks  →  TrackSubscribed event fires  →  attach audio
User speaks   →  agent hears it via Groq Whisper
Agent replies →  agent publishes audio track  →  frontend plays it
     ↓
User taps "End"  →  room.disconnect()
```

---

## React Web Implementation

### Install

```bash
npm install livekit-client
```

### Complete Hook: `useCafaLife.ts`

```typescript
import { useCallback, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
} from 'livekit-client';

const API_BASE = 'https://cafaapi.niveel.com';

export type SessionState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export function useCafaLife(accessToken: string) {
  const roomRef = useRef<Room | null>(null);
  const audioEls = useRef<HTMLAudioElement[]>([]);
  const [state, setState] = useState<SessionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const startSession = useCallback(async () => {
    setError(null);
    setState('connecting');

    try {
      // Step 1: Get LiveKit token from Cafa API
      const res = await fetch(`${API_BASE}/api/v1/cafa-life/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to get token');
      }

      const { data } = await res.json();
      const { token, livekitUrl } = data;

      // Step 2: Create and connect Room
      const room = new Room({
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      roomRef.current = room;

      // Step 3: Wire up events
      room.on(RoomEvent.Connected, () => {
        setState('listening');
      });

      room.on(RoomEvent.Disconnected, () => {
        // Clean up audio elements
        audioEls.current.forEach(el => el.remove());
        audioEls.current = [];
        setState('idle');
        roomRef.current = null;
      });

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          // Attach agent audio to DOM so it plays
          const el = track.attach() as HTMLAudioElement;
          document.body.appendChild(el);
          audioEls.current.push(el);
          setState('speaking');
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          const detached = track.detach();
          detached.forEach(el => el.remove());
          audioEls.current = audioEls.current.filter(el => !detached.includes(el));
          setState('listening');
        }
      });

      // Step 4: Connect to LiveKit
      await room.connect(livekitUrl, token);

      // Step 5: Enable microphone
      await room.localParticipant.setMicrophoneEnabled(true);

    } catch (err: any) {
      setError(err.message);
      setState('error');
      roomRef.current = null;
    }
  }, [accessToken]);

  const endSession = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    audioEls.current.forEach(el => el.remove());
    audioEls.current = [];
    setState('idle');
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(async () => {
    if (!roomRef.current) return;
    const next = !isMuted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(!next);
    setIsMuted(next);
  }, [isMuted]);

  return { state, error, isMuted, startSession, endSession, toggleMute };
}
```

### Example UI Component: `CafaLifeScreen.tsx`

```tsx
import { useCafaLife } from './useCafaLife';

const orbColors = {
  idle:       'bg-purple-900 opacity-50',
  connecting: 'bg-purple-700 animate-pulse',
  listening:  'bg-purple-600 ring-4 ring-purple-400/30 scale-105',
  speaking:   'bg-emerald-600 ring-4 ring-emerald-400/20 scale-103',
  error:      'bg-red-800',
};

const statusLabels = {
  idle:       'Tap to start',
  connecting: 'Connecting…',
  listening:  'Listening…',
  speaking:   'Cafa is speaking…',
  error:      'Something went wrong',
};

export function CafaLifeScreen({ accessToken }: { accessToken: string }) {
  const { state, error, isMuted, startSession, endSession, toggleMute } = useCafaLife(accessToken);

  const handleOrbPress = () => {
    if (state === 'idle' || state === 'error') {
      startSession();
    } else {
      endSession();
    }
  };

  const isActive = state !== 'idle' && state !== 'error';

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {/* Orb */}
      <button
        onClick={handleOrbPress}
        className={`w-32 h-32 rounded-full transition-all duration-300 ${orbColors[state]}`}
        aria-label={isActive ? 'End session' : 'Start session'}
      />

      {/* Status */}
      <p className="text-gray-400 text-sm">{statusLabels[state]}</p>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {/* Controls — only shown during active session */}
      {isActive && (
        <div className="flex gap-3">
          <button
            onClick={toggleMute}
            className="px-4 py-2 rounded-lg bg-gray-800 text-sm"
          >
            {isMuted ? '🔇 Unmute' : '🎙 Mute'}
          </button>
          <button
            onClick={endSession}
            className="px-4 py-2 rounded-lg bg-red-700 text-sm text-white"
          >
            End Session
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Expo React Native Implementation

### Install

```bash
npx expo install @livekit/react-native @livekit/react-native-webrtc
```

> **Important:** After installing, run `npx expo prebuild` if using managed workflow, or rebuild your dev client.

### Register audio session (add to `App.tsx` or entry point)

```typescript
import { registerGlobals } from '@livekit/react-native';

// Call this once at app startup, before any LiveKit usage
registerGlobals();
```

### Complete Hook: `useCafaLife.ts` (React Native)

```typescript
import { useCallback, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrackPublication,
  type RemoteParticipant,
} from '@livekit/react-native';

const API_BASE = 'https://cafaapi.niveel.com';

export type SessionState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export function useCafaLife(accessToken: string) {
  const roomRef = useRef<Room | null>(null);
  const [state, setState] = useState<SessionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const startSession = useCallback(async () => {
    setError(null);
    setState('connecting');

    try {
      // Step 1: Get LiveKit token
      const res = await fetch(`${API_BASE}/api/v1/cafa-life/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to get token');
      }

      const { data } = await res.json();
      const { token, livekitUrl } = data;

      // Step 2: Create Room
      const room = new Room();
      roomRef.current = room;

      // Step 3: Wire events
      room.on(RoomEvent.Connected, () => {
        setState('listening');
      });

      room.on(RoomEvent.Disconnected, () => {
        setState('idle');
        roomRef.current = null;
      });

      room.on(
        RoomEvent.TrackSubscribed,
        (
          track: any,
          publication: RemoteTrackPublication,
          participant: RemoteParticipant,
        ) => {
          if (track.kind === Track.Kind.Audio) {
            // On React Native, audio plays automatically when subscribed
            // No manual attachment needed
            setState('speaking');
          }
        },
      );

      room.on(RoomEvent.TrackUnsubscribed, (track: any) => {
        if (track.kind === Track.Kind.Audio) {
          setState('listening');
        }
      });

      // Step 4: Connect
      await room.connect(livekitUrl, token, {
        autoSubscribe: true,
      });

      // Step 5: Enable microphone
      await room.localParticipant.setMicrophoneEnabled(true);

    } catch (err: any) {
      setError(err.message);
      setState('error');
      roomRef.current = null;
    }
  }, [accessToken]);

  const endSession = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setState('idle');
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(async () => {
    if (!roomRef.current) return;
    const next = !isMuted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(!next);
    setIsMuted(next);
  }, [isMuted]);

  return { state, error, isMuted, startSession, endSession, toggleMute };
}
```

### Example UI Component: `CafaLifeScreen.tsx` (React Native)

```tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { useCafaLife, type SessionState } from './useCafaLife';

const ORB_COLORS: Record<SessionState, string> = {
  idle:       '#3b1f8a',
  connecting: '#5b40ff',
  listening:  '#7c6aff',
  speaking:   '#059669',
  error:      '#dc2626',
};

const STATUS_LABELS: Record<SessionState, string> = {
  idle:       'Tap to start',
  connecting: 'Connecting…',
  listening:  'Listening…',
  speaking:   'Cafa is speaking…',
  error:      'Something went wrong',
};

interface Props {
  accessToken: string;
}

export function CafaLifeScreen({ accessToken }: Props) {
  const { state, error, isMuted, startSession, endSession, toggleMute } =
    useCafaLife(accessToken);

  const isActive = state !== 'idle' && state !== 'error';

  const handleOrbPress = () => {
    if (state === 'idle' || state === 'error') {
      startSession();
    } else {
      endSession();
    }
  };

  return (
    <View style={styles.container}>
      {/* Orb */}
      <TouchableOpacity
        onPress={handleOrbPress}
        activeOpacity={0.8}
        style={[
          styles.orb,
          { backgroundColor: ORB_COLORS[state] },
          state === 'listening' && styles.orbListening,
          state === 'speaking'  && styles.orbSpeaking,
        ]}
        accessibilityLabel={isActive ? 'End voice session' : 'Start voice session'}
      />

      {/* Status label */}
      <Text style={styles.statusLabel}>{STATUS_LABELS[state]}</Text>

      {/* Error */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Controls */}
      {isActive && (
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={toggleMute}
            style={[styles.controlBtn, styles.muteBtn]}
          >
            <Text style={styles.controlBtnText}>
              {isMuted ? '🔇 Unmute' : '🎙 Mute'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={endSession}
            style={[styles.controlBtn, styles.endBtn]}
          >
            <Text style={styles.controlBtnText}>End</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d0f14',
    gap: 20,
  },
  orb: {
    width: 130,
    height: 130,
    borderRadius: 65,
    opacity: 1,
  },
  orbListening: {
    shadowColor: '#7c6aff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  orbSpeaking: {
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  statusLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  controlBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  muteBtn: {
    backgroundColor: '#252935',
  },
  endBtn: {
    backgroundColor: '#dc2626',
  },
  controlBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
```

---

## Permissions

### Web (React)
The browser will prompt the user for microphone permission automatically when `setMicrophoneEnabled(true)` is called. No extra setup needed. Must be served over **HTTPS** (or `localhost`) — microphone access is blocked on plain HTTP.

### React Native (Expo)
Add to `app.json`:
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSMicrophoneUsageDescription": "Cafa needs microphone access to talk with you."
      }
    },
    "android": {
      "permissions": ["android.permission.RECORD_AUDIO"]
    }
  }
}
```

Request permission before starting a session:
```typescript
import { Audio } from 'expo-av';

async function requestMicPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

// Call before startSession():
const granted = await requestMicPermission();
if (!granted) {
  Alert.alert('Permission required', 'Microphone access is needed for Cafa Life.');
  return;
}
```

---

## Orb State Reference

The orb is the core UI element. It visually reflects the session state.

| State | Meaning | Suggested visual |
|-------|---------|-----------------|
| `idle` | Not started | Dim purple, 50% opacity |
| `connecting` | Getting token + connecting | Pulsing animation |
| `listening` | Agent ready, user can speak | Purple glow ring |
| `speaking` | Agent is talking | Green/teal glow ring |
| `error` | Something failed | Red tint, show error text |

---

## Important Notes for the Developer

**Token lifespan:** The LiveKit token from `/cafa-life/token` expires. If the user's session drops and they reconnect after a long time, call the endpoint again to get a fresh token.

**One session at a time:** Each call to `/cafa-life/token` creates a new room. Always call `room.disconnect()` before starting a new session.

**Audio on iOS:** On iOS, audio context may be suspended until a user gesture. Always start the session inside a `TouchableOpacity` or button `onPress` handler — never auto-start.

**Web CORS:** The Cafa API allows requests from any origin. No proxy is needed for local development.

**No transcript from the API:** The agent saves transcripts server-side but does not push them to the frontend via LiveKit data messages in the current implementation. The conversation history endpoint (`GET /history`) can be called after a session ends to show what was said.

**Error handling:** Common errors and what to show the user:

| Error | Cause | User message |
|-------|-------|-------------|
| `401` from `/token` | Expired JWT | "Please log in again" |
| `Failed to get token` | Network issue | "Check your internet connection" |
| LiveKit connection timeout | Server or network issue | "Could not connect — try again" |
| Mic permission denied | User denied | "Microphone permission required" |

---

## Quick Reference

```
API Base:      https://cafaapi.niveel.com
Token:         POST /api/v1/cafa-life/token   (Bearer JWT required)
History:       GET  /api/v1/cafa-life/history  (Bearer JWT required)

LiveKit URL:   wss://cafa-life-2s49fgki.livekit.cloud
               (returned dynamically in token response)

Web SDK:       livekit-client
RN SDK:        @livekit/react-native + @livekit/react-native-webrtc
```

---

*Document generated for Niveel LLC / Cafa AI — June 2026*

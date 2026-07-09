import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { requestRecordingPermissionsAsync } from 'expo-audio';

import { getCafaLifeToken } from '@/features/cafaLife/services/cafaLife';
import {
  configureCafaLifeAudioSession,
  ensureCafaLifeGlobalsRegistered,
  forceCafaLifeSpeakerOutput,
  getCafaLifeRuntimeSupport,
} from '@/features/cafaLife/services/cafaLife.runtime';
import { hapticError, hapticSelection, hapticSuccess } from '@/utils';
import type { CafaLifeSessionError, CafaLifeSessionSnapshot, CafaLifeSessionState } from '@/types';

type LiveKitRuntime = {
  Room: typeof import('livekit-client').Room;
  RoomEvent: typeof import('livekit-client').RoomEvent;
  Track: typeof import('livekit-client').Track;
};

type RemoteAudioTrackHandle = {
  kind?: string;
  setVolume?: (volume: number) => void;
};

function createSessionError(message: string, code: CafaLifeSessionError['code'], status?: number) {
  const error = new Error(message) as CafaLifeSessionError;
  error.code = code;
  error.status = status;
  return error;
}

function mapFriendlySessionError(error: unknown): CafaLifeSessionError {
  const typed = error as Partial<CafaLifeSessionError> | undefined;
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  const status = typeof typed?.status === 'number' ? typed.status : undefined;
  const code = typed?.code;

  if (code === 'UNSUPPORTED_RUNTIME' || code === 'MIC_PERMISSION_DENIED') {
    return createSessionError(message, code, status);
  }

  if (status === 401) {
    return createSessionError('Please log in again to use Cafa Live.', 'AUTH_REQUIRED', status);
  }

  if (/permission/i.test(message)) {
    return createSessionError('Microphone permission is required for Cafa Live.', 'MIC_PERMISSION_DENIED', status);
  }

  if (/network|internet|fetch/i.test(message)) {
    return createSessionError('Check your internet connection and try again.', 'NETWORK_ERROR', status);
  }

  if (/token/i.test(message)) {
    return createSessionError('Could not start your voice session. Please try again.', 'TOKEN_REQUEST_FAILED', status);
  }

  if (/connect|room|livekit/i.test(message)) {
    return createSessionError('Could not connect to Cafa Live right now. Please try again.', 'LIVEKIT_CONNECT_FAILED', status);
  }

  return createSessionError(message, 'UNKNOWN_ERROR', status);
}

function getLiveKitRuntime(): LiveKitRuntime {
  const livekitClient = require('livekit-client') as typeof import('livekit-client');
  return {
    Room: livekitClient.Room,
    RoomEvent: livekitClient.RoomEvent,
    Track: livekitClient.Track,
  };
}

function announceForAccessibilitySafe(message: string) {
  try {
    const result = AccessibilityInfo.announceForAccessibility(message) as unknown;
    if (typeof result === 'object' && result !== null && 'then' in result && typeof result.then === 'function') {
      void (result as PromiseLike<void>).then(() => undefined, () => undefined);
    }
  } catch {
    // Ignore announcement failures. They should never break the voice session.
  }
}

export function useCafaLifeSession() {
  const runtime = useMemo(() => getCafaLifeRuntimeSupport(), []);
  const roomRef = useRef<import('livekit-client').Room | null>(null);
  const sessionTokenRef = useRef(0);
  const remoteAudioTracksRef = useRef<Set<RemoteAudioTrackHandle>>(new Set());
  const activeRemoteAudioTrackRef = useRef<RemoteAudioTrackHandle | null>(null);
  const [state, setState] = useState<CafaLifeSessionState>('idle');
  const [error, setError] = useState<CafaLifeSessionError | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [assistantName, setAssistantName] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    const remoteAudioTracks = remoteAudioTracksRef.current;
    return () => {
      const room = roomRef.current;
      sessionTokenRef.current += 1;
      roomRef.current = null;
      remoteAudioTracks.forEach((track) => {
        track.setVolume?.(0);
      });
      remoteAudioTracks.clear();
      activeRemoteAudioTrackRef.current = null;
      if (room) {
        void room.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    const label =
      state === 'connecting'
        ? 'Connecting to Cafa Live.'
        : state === 'listening'
          ? 'Cafa Live is listening.'
          : state === 'speaking'
            ? 'Cafa is speaking.'
            : state === 'muted'
              ? 'Microphone muted.'
              : state === 'error' && error
                ? error.message
                : null;
    if (!label) return;
    announceForAccessibilitySafe(label);
  }, [error, state]);

  const clearSessionMeta = useCallback(() => {
    setIsMuted(false);
    setRoomName(null);
    setAssistantName(null);
    setStartedAt(null);
    remoteAudioTracksRef.current.clear();
    activeRemoteAudioTrackRef.current = null;
  }, []);

  const silenceRemoteAudioPlayback = useCallback(() => {
    remoteAudioTracksRef.current.forEach((track) => {
      track.setVolume?.(0);
    });
    remoteAudioTracksRef.current.clear();
    activeRemoteAudioTrackRef.current = null;
  }, []);

  const syncRemoteAudioPlayback = useCallback((activeTrack: RemoteAudioTrackHandle | null) => {
    remoteAudioTracksRef.current.forEach((track) => {
      track.setVolume?.(track === activeTrack ? 1 : 0);
    });
  }, []);

  const endSession = useCallback(async () => {
    if (!roomRef.current) {
      setState('idle');
      silenceRemoteAudioPlayback();
      clearSessionMeta();
      return;
    }

    sessionTokenRef.current += 1;
    setState('disconnecting');
    const room = roomRef.current;
    roomRef.current = null;
    try {
      silenceRemoteAudioPlayback();
      await room.disconnect();
      hapticSelection();
    } catch {
      // Keep local state authoritative even if transport disconnect throws.
    } finally {
      clearSessionMeta();
      setState('idle');
    }
  }, [clearSessionMeta, silenceRemoteAudioPlayback]);

  const startSession = useCallback(async (selectedVoice?: string) => {
    if (!runtime.supported) {
      const unsupported = createSessionError(runtime.message ?? 'Unsupported runtime.', 'UNSUPPORTED_RUNTIME');
      setError(unsupported);
      setState('error');
      hapticError();
      return;
    }

    if (roomRef.current) {
      await endSession();
    }

    setError(null);
    setState('requesting_permission');

    try {
      ensureCafaLifeGlobalsRegistered();
      await configureCafaLifeAudioSession();

      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw createSessionError('Microphone permission is required for Cafa Live.', 'MIC_PERMISSION_DENIED');
      }

      setState('connecting');

      const { token, livekitUrl, roomName: nextRoomName } = await getCafaLifeToken(selectedVoice);
      const { Room, RoomEvent, Track } = getLiveKitRuntime();
      const sessionToken = sessionTokenRef.current + 1;
      sessionTokenRef.current = sessionToken;

      const room = new Room({
        adaptiveStream: false,
        dynacast: false,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      roomRef.current = room;
      setRoomName(nextRoomName);

      const isCurrentSession = () => roomRef.current === room && sessionTokenRef.current === sessionToken;

      room
        .on(RoomEvent.Connected, () => {
          if (!isCurrentSession()) return;
          setStartedAt(Date.now());
          setState((prev) => (prev === 'muted' ? 'muted' : 'listening'));
          hapticSuccess();
        })
        .on(RoomEvent.ConnectionStateChanged, (nextConnectionState: string) => {
          if (!isCurrentSession()) return;
          if (nextConnectionState === 'reconnecting') {
            setState('connecting');
          }
        })
        .on(
          RoomEvent.TrackSubscribed,
          (
            track: RemoteAudioTrackHandle,
            _publication: unknown,
            participant: { name?: string; identity?: string }
          ) => {
            if (!isCurrentSession()) {
              track.setVolume?.(0);
              return;
            }
            if (track.kind === Track.Kind.Audio) {
              remoteAudioTracksRef.current.add(track);
              activeRemoteAudioTrackRef.current = track;
              syncRemoteAudioPlayback(track);
              setAssistantName(participant.name || 'Cafa');
              setState((prev) => (prev === 'muted' ? 'muted' : 'speaking'));
            }
          }
        )
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteAudioTrackHandle) => {
          if (!isCurrentSession()) {
            track.setVolume?.(0);
            return;
          }
          if (track.kind === Track.Kind.Audio) {
            remoteAudioTracksRef.current.delete(track);

            if (activeRemoteAudioTrackRef.current === track) {
              const fallbackTrack = Array.from(remoteAudioTracksRef.current).at(-1) ?? null;
              activeRemoteAudioTrackRef.current = fallbackTrack;
            }

            syncRemoteAudioPlayback(activeRemoteAudioTrackRef.current);
            setState((prev) => {
              if (prev === 'muted') return 'muted';
              return activeRemoteAudioTrackRef.current ? 'speaking' : 'listening';
            });
          }
        })
        .on(RoomEvent.ActiveSpeakersChanged, (speakers: { identity?: string; isSpeaking?: boolean; name?: string }[]) => {
          if (!isCurrentSession()) return;
          const remoteSpeaker = speakers.find((speaker) => speaker.identity && speaker.identity !== room.localParticipant.identity && speaker.isSpeaking);
          if (remoteSpeaker) {
            syncRemoteAudioPlayback(activeRemoteAudioTrackRef.current);
            setAssistantName(remoteSpeaker.name || 'Cafa');
            setState((prev) => (prev === 'muted' ? 'muted' : 'speaking'));
            return;
          }

          if (roomRef.current) {
            syncRemoteAudioPlayback(activeRemoteAudioTrackRef.current);
            setState((prev) => (prev === 'muted' ? 'muted' : prev === 'connecting' ? 'connecting' : 'listening'));
          }
        })
        .on(RoomEvent.Disconnected, () => {
          silenceRemoteAudioPlayback();
          if (!isCurrentSession()) return;
          roomRef.current = null;
          clearSessionMeta();
          setState('idle');
        });

      await room.connect(livekitUrl, token, { autoSubscribe: true });
      if (!isCurrentSession()) {
        silenceRemoteAudioPlayback();
        await room.disconnect();
        return;
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      await forceCafaLifeSpeakerOutput();
      setIsMuted(false);
    } catch (sessionError) {
      const mapped = mapFriendlySessionError(sessionError);
      silenceRemoteAudioPlayback();
      if (roomRef.current) {
        const room = roomRef.current;
        roomRef.current = null;
        try {
          await room.disconnect();
        } catch {
          // Ignore disconnect cleanup errors during failure path.
        }
      }
      clearSessionMeta();
      setError(mapped);
      setState('error');
      hapticError();
    }
  }, [clearSessionMeta, endSession, runtime.message, runtime.supported, silenceRemoteAudioPlayback, syncRemoteAudioPlayback]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const nextMuted = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!nextMuted);
    setIsMuted(nextMuted);
    setState(nextMuted ? 'muted' : 'listening');
    hapticSelection();
  }, [isMuted]);

  const snapshot: CafaLifeSessionSnapshot = {
    state,
    error,
    isMuted,
    roomName,
    assistantName,
    isRuntimeSupported: runtime.supported,
    runtimeMessage: runtime.message,
    startedAt,
  };

  return {
    ...snapshot,
    isActive: state !== 'idle' && state !== 'error',
    startSession,
    endSession,
    toggleMute,
  };
}

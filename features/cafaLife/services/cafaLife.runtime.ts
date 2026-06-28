import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

let globalsRegistered = false;
let iosAudioManagementRegistered = false;

export function getCafaLifeRuntimeSupport() {
  if (Platform.OS === 'web') {
    return {
      supported: false,
      message: 'Cafa Live is available on iOS and Android native builds.',
    };
  }

  if (isRunningInExpoGo()) {
    return {
      supported: false,
      message: 'Cafa Live needs a development build or production app build. Expo Go does not support this real-time audio stack.',
    };
  }

  return {
    supported: true,
    message: null,
  };
}

export function ensureCafaLifeGlobalsRegistered() {
  const runtime = getCafaLifeRuntimeSupport();
  if (!runtime.supported) return runtime;

  if (!globalsRegistered) {
    const livekit = require('@livekit/react-native') as typeof import('@livekit/react-native');
    livekit.registerGlobals({
      autoConfigureAudioSession: false,
    });

    if (Platform.OS === 'ios' && !iosAudioManagementRegistered) {
      livekit.setupIOSAudioManagement(true, (state) => {
        if (state.isRecordingEnabled) {
          return {
            audioCategory: 'playAndRecord',
            audioCategoryOptions: [
              'allowBluetooth',
              'allowBluetoothA2DP',
              'allowAirPlay',
              'defaultToSpeaker',
            ],
            audioMode: 'videoChat',
          };
        }

        if (state.isPlayoutEnabled) {
          return {
            audioCategory: 'playback',
            audioCategoryOptions: [],
            audioMode: 'spokenAudio',
          };
        }

        return {
          audioCategory: 'soloAmbient',
          audioCategoryOptions: [],
          audioMode: 'default',
        };
      });
      iosAudioManagementRegistered = true;
    }

    globalsRegistered = true;
  }

  return runtime;
}

export async function configureCafaLifeAudioSession() {
  const runtime = getCafaLifeRuntimeSupport();
  if (!runtime.supported) return;

  const livekit = require('@livekit/react-native') as typeof import('@livekit/react-native');
  const { AudioSession } = livekit;

  await AudioSession.configureAudio({
    android: {
      preferredOutputList: ['speaker', 'bluetooth', 'headset', 'earpiece'],
      audioTypeOptions: {
        manageAudioFocus: true,
        audioMode: 'normal',
        audioFocusMode: 'gain',
        audioStreamType: 'music',
        audioAttributesUsageType: 'media',
        audioAttributesContentType: 'speech',
        forceHandleAudioRouting: true,
      },
    },
    ios: {
      defaultOutput: 'speaker',
    },
  });

  if (Platform.OS === 'ios') {
    await AudioSession.setAppleAudioConfiguration({
      audioCategory: 'playAndRecord',
      audioCategoryOptions: [
        'allowBluetooth',
        'allowBluetoothA2DP',
        'allowAirPlay',
        'defaultToSpeaker',
      ],
      audioMode: 'videoChat',
    });
  }

  await AudioSession.setDefaultRemoteAudioTrackVolume(1);
}

export async function forceCafaLifeSpeakerOutput() {
  const runtime = getCafaLifeRuntimeSupport();
  if (!runtime.supported) return;

  const livekit = require('@livekit/react-native') as typeof import('@livekit/react-native');
  const { AudioSession } = livekit;

  try {
    await AudioSession.startAudioSession();

    if (Platform.OS === 'ios') {
      await AudioSession.selectAudioOutput('force_speaker');
      return;
    }

    const outputs = await AudioSession.getAudioOutputs();
    if (outputs.includes('speaker')) {
      await AudioSession.selectAudioOutput('speaker');
    }
  } catch {
    // Leave native fallback routing in place if explicit speaker forcing fails.
  }
}

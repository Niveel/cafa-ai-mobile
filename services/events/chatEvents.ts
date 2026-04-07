import { DeviceEventEmitter } from 'react-native';

const CHAT_MUTATED_EVENT = 'chat:mutated';

export function emitChatMutated() {
  DeviceEventEmitter.emit(CHAT_MUTATED_EVENT);
}

export function subscribeToChatMutated(listener: () => void) {
  const subscription = DeviceEventEmitter.addListener(CHAT_MUTATED_EVENT, listener);
  return () => subscription.remove();
}


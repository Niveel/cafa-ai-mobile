import { createStore } from './createStore';

type FeatureFlagState = {
  useMockGateway: boolean;
  voiceEnabled: boolean;
  billingEnabled: boolean;
};

export const featureFlagsStore = createStore<FeatureFlagState>({
  useMockGateway: false,
  voiceEnabled: true,
  billingEnabled: true,
});

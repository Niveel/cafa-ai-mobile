import { useCallback } from 'react';
import { Switch, SwitchProps } from 'react-native';
import * as Haptics from 'expo-haptics';

type AppSwitchProps = SwitchProps & {
  vibrateOnEnable?: boolean;
};

export function AppSwitch({ onValueChange, vibrateOnEnable = true, ...props }: AppSwitchProps) {
  const handleValueChange = useCallback(
    (nextValue: boolean) => {
      if (vibrateOnEnable && nextValue) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      onValueChange?.(nextValue);
    },
    [onValueChange, vibrateOnEnable],
  );

  return <Switch {...props} onValueChange={handleValueChange} />;
}

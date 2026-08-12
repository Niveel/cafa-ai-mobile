import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

import { showInterstitialAd } from '@/services/ads/showInterstitialAd';

import { useAdVisibility } from './useAdVisibility';

const LAST_INTERSTITIAL_DATE_KEY_PREFIX = '@cafa/ads/last-interstitial-date';
let dailyCheckInFlight = false;

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useDailyInterstitialAd(pathname: string) {
  const { showAds } = useAdVisibility({ pathname });

  useFocusEffect(
    useCallback(() => {
      if (!showAds || dailyCheckInFlight) return;
      let cancelled = false;
      dailyCheckInFlight = true;

      void (async () => {
        try {
          const today = getLocalDateKey();
          const screenStorageKey = `${LAST_INTERSTITIAL_DATE_KEY_PREFIX}:${pathname}`;
          const lastShownDate = await AsyncStorage.getItem(screenStorageKey);
          if (cancelled || lastShownDate === today) return;

          const shown = await showInterstitialAd(pathname);
          if (shown) {
            await AsyncStorage.setItem(screenStorageKey, today);
          }
        } catch (error) {
          if (__DEV__) console.warn('[ads:interstitial] Daily display check failed.', error);
        } finally {
          dailyCheckInFlight = false;
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [pathname, showAds]),
  );
}

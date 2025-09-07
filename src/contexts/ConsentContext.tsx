import React, { createContext, useContext, useMemo } from 'react';
import { AdsConsentStatus } from 'react-native-google-mobile-ads';
import { ConsentState } from '../services/adsConsent';

type ConsentCtx = ConsentState & { ready: boolean };

const ConsentContext = createContext<ConsentCtx>({
  status: AdsConsentStatus.UNKNOWN,
  canRequestAds: false,
  personalized: false,
  ready: false,
});

export const useConsent = () => useContext(ConsentContext);

// Optimized selector hook to avoid prop drilling and extra renders
export const useAdFlags = () => {
  const { canRequestAds, personalized, ready } = useConsent();
  return useMemo(() => ({ canRequestAds, personalized, ready }), [canRequestAds, personalized, ready]);
};

export { ConsentContext };
export type { ConsentCtx };
import React, { useEffect, useState, createContext, useContext, useMemo } from 'react';
import { AppState, AppStateStatus, View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { initAdsAndConsent, ConsentState } from './src/services/adsConsent';
import { AdsConsentStatus } from 'react-native-google-mobile-ads';

type ConsentCtx = ConsentState & { ready: boolean };

const ConsentContext = createContext<ConsentCtx>({
  status: AdsConsentStatus.UNKNOWN,
  canRequestAds: false,
  personalized: false,
  ready: false,
});

export const useConsent = () => useContext(ConsentContext);

// Optional: a tiny selector hook to avoid prop drilling and extra renders
export const useAdFlags = () => {
  const { canRequestAds, personalized, ready } = useConsent();
  return useMemo(() => ({ canRequestAds, personalized, ready }), [canRequestAds, personalized, ready]);
};

export default function App() {
  const [consent, setConsent] = useState<ConsentCtx>({
    status: AdsConsentStatus.UNKNOWN,
    canRequestAds: false,
    personalized: false,
    ready: false,
  });

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        console.log('🔧 Initializing ads and consent...');
        const consentState = await initAdsAndConsent(
          __DEV__
            ? {
                testDeviceIds: ['EMULATOR'],
                eea: false, // flip to true to QA the GDPR flow
              }
            : undefined
        );
        if (!mounted) return;
        setConsent({ ...consentState, ready: true });
        console.log('📱 App ready with consent state:', consentState);
      } catch (error) {
        console.error('❌ Error during app initialization:', error);
        if (!mounted) return;
        // Safe fallback: allow ad requests, but only NPA
        setConsent({
          status: AdsConsentStatus.NOT_REQUIRED,
          canRequestAds: true,
          personalized: false,
          ready: true,
        });
      }
    };

    boot();

    // (Optional) Refresh consent when app returns to foreground; UMP will be a quick no-op if unchanged
    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        initAdsAndConsent(__DEV__ ? { testDeviceIds: ['EMULATOR'] } : undefined)
          .then((s) => setConsent((prev) => ({ ...prev, ...s })))
          .catch(() => {});
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  if (!consent.ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1f1f1f' }}>
        <Text style={{ color: 'white', fontSize: 16 }}>Initializing...</Text>
      </View>
    );
  }

  return (
    <ConsentContext.Provider value={consent}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <HomeScreen />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ConsentContext.Provider>
  );
}
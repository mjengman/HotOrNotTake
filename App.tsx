import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, AppStateStatus, Image, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { initAdsAndConsent } from './src/services/adsConsent';
import { AdsConsentStatus } from 'react-native-google-mobile-ads';
import { ConsentContext, ConsentCtx } from './src/contexts/ConsentContext';
import { setupNotifications } from './src/services/notificationService';

const LAUNCH_VEIL_MIN_MS = 950;
const LAUNCH_VEIL_FADE_MS = 350;

export default function App() {
  const lastConsentRefreshRef = useRef(0);
  const launchVeilOpacity = useRef(new Animated.Value(1)).current;
  const [showLaunchVeil, setShowLaunchVeil] = useState(true);
  const [consent, setConsent] = useState<ConsentCtx>({
    status: AdsConsentStatus.UNKNOWN,
    canRequestAds: false,
    personalized: false,
    ready: false,
  });

  useEffect(() => {
    setupNotifications();

    let mounted = true;

    const boot = async () => {
      try {
        const consentState = await initAdsAndConsent(
          __DEV__
            ? {
                testDeviceIds: ['EMULATOR'],
                eea: false, // flip to true to QA the GDPR flow
              }
            : undefined
        );
        lastConsentRefreshRef.current = Date.now();
        if (!mounted) return;
        setConsent({ ...consentState, ready: true });
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

    // Refresh consent when app returns to foreground; UMP will be a quick no-op if unchanged
    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        const now = Date.now();
        if (now - lastConsentRefreshRef.current < 30000) {
          return;
        }
        lastConsentRefreshRef.current = now;
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.timing(launchVeilOpacity, {
        toValue: 0,
        duration: LAUNCH_VEIL_FADE_MS,
        useNativeDriver: true,
      }).start(() => setShowLaunchVeil(false));
    }, LAUNCH_VEIL_MIN_MS);

    return () => {
      clearTimeout(timeout);
      launchVeilOpacity.stopAnimation();
    };
  }, [launchVeilOpacity]);

  return (
    <ConsentContext.Provider value={consent}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <HomeScreen />
          {showLaunchVeil && (
            <Animated.View
              pointerEvents="auto"
              style={[styles.launchVeil, { opacity: launchVeilOpacity }]}
            >
              <Image
                source={require('./assets/splash-image.png')}
                style={styles.launchVeilImage}
                resizeMode="contain"
              />
            </Animated.View>
          )}
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ConsentContext.Provider>
  );
}

const styles = StyleSheet.create({
  launchVeil: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f1f1f',
    zIndex: 10000,
    elevation: 10000,
  },
  launchVeilImage: {
    width: '100%',
    height: '100%',
  },
});

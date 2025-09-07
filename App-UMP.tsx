import React, { useEffect, useState, createContext, useContext } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { initAdsAndConsent, ConsentState } from './src/services/adsConsent';

// Context to share consent state throughout the app
const ConsentContext = createContext<ConsentState>({
  status: 'UNKNOWN' as any,
  canRequestAds: false,
  personalized: false,
});

export const useConsent = () => useContext(ConsentContext);

export default function App() {
  const [consent, setConsent] = useState<ConsentState & { ready: boolean }>({
    status: 'UNKNOWN' as any,
    canRequestAds: false,
    personalized: false,
    ready: false,
  });

  useEffect(() => {
    (async () => {
      try {
        console.log('🔧 Initializing ads and consent...');
        const consentState = await initAdsAndConsent(
          __DEV__ ? { 
            testDeviceIds: ['EMULATOR'], 
            eea: false // Set to true to test GDPR consent flow
          } : undefined
        );
        
        setConsent({ ...consentState, ready: true });
        console.log('📱 App ready with consent state:', consentState);
      } catch (error) {
        console.error('❌ Error during app initialization:', error);
        // If anything fails, stay safe: use non-personalized (ChatGPT-5's recommendation)
        setConsent({ 
          status: 'NOT_REQUIRED' as any,
          canRequestAds: true, 
          personalized: false, 
          ready: true 
        });
      }
    })();
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
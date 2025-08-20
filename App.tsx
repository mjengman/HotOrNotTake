import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text } from 'react-native';
import mobileAds from 'react-native-google-mobile-ads';
import { HomeScreen } from './src/screens/HomeScreen';

export default function App() {
  const [adsInitialized, setAdsInitialized] = useState(false);

  useEffect(() => {
    // Initialize Google Mobile Ads SDK BEFORE rendering HomeScreen
    console.log('🔧 Initializing Mobile Ads SDK before app starts...');
    mobileAds()
      .initialize()
      .then((adapterStatus) => {
        console.log('📱 Google Mobile Ads SDK initialized successfully');
        console.log('📱 Adapter status:', JSON.stringify(adapterStatus, null, 2));
        setAdsInitialized(true);
      })
      .catch((error) => {
        console.error('❌ Failed to initialize Google Mobile Ads SDK:', error);
        // Still allow app to load even if ads fail
        setAdsInitialized(true);
      });
  }, []);

  if (!adsInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1f1f1f' }}>
        <Text style={{ color: 'white', fontSize: 16 }}>Initializing...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <HomeScreen />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

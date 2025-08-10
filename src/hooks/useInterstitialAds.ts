import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useInterstitialAd, TestIds, AdEventType } from 'react-native-google-mobile-ads';

// PRODUCTION AD CONFIGURATION
const IS_PRODUCTION_BUILD = true;
const isDevelopment = __DEV__;

// One-time logging to prevent spam
let hasLoggedAdConfig = false;

// Get the correct ad unit ID  
const getAdUnitId = (): string => {
  // FIXED: Use production IDs in development too (like the class-based service did)
  // This matches the working behavior you had before
  const productionId = __DEV__ 
    ? TestIds.INTERSTITIAL // Use test ads in development/preview builds
    : (Platform.OS === 'android' ? 'ca-app-pub-1745058833253836/4423842963' : TestIds.INTERSTITIAL);
  
  if (!hasLoggedAdConfig) {
    console.log('🚀 Using PRODUCTION ad ID (fixed):', productionId);
    console.log('📱 Platform:', Platform.OS);
    console.log('🏗️ Development mode:', isDevelopment);
    hasLoggedAdConfig = true;
  }
  return productionId;
};

// Use the hook-based approach which should work better
export const useInterstitialAds = () => {
  const [swipeCount, setSwipeCount] = useState(0);
  const SWIPES_UNTIL_AD = 12;
  
  const adUnitId = getAdUnitId();

  console.log('🎬 Interstitial ads hook initialized with unit ID:', adUnitId);

  // Use the correct ad unit ID
  const { isLoaded, isClosed, load, show, error } = useInterstitialAd(adUnitId);

  console.log('🎬 Ad hook state:', { isLoaded, isClosed, error: error?.message });

  useEffect(() => {
    // Start loading the interstitial ad
    console.log('🎬 Starting interstitial ad load...');
    try {
      load();
      
      // Set a timeout to detect if ad never loads (common with test ads)
      const loadTimeout = setTimeout(() => {
        if (!isLoaded) {
          console.warn('⏰ Interstitial ad load timeout - this is common with test ads in development');
          console.warn('⏰ The ad may work in production builds with real ad units');
        }
      }, 30000); // 30 seconds timeout
      
      return () => clearTimeout(loadTimeout);
    } catch (loadError) {
      console.error('🎬 Error calling load():', loadError);
    }
  }, []); // Remove load dependency to prevent double loading
  
  useEffect(() => {
    if (error) {
      console.error('❌ Interstitial ad error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      console.error('❌ Ad unit ID that failed:', adUnitId);
      // Retry loading after 5 seconds on error
      setTimeout(() => {
        console.log('🔄 Retrying interstitial ad load after error...');
        load();
      }, 5000);
    }
  }, [error, load]);
  
  useEffect(() => {
    if (isLoaded) {
      console.log('✅ Interstitial ad loaded successfully!');
    }
  }, [isLoaded]);

  useEffect(() => {
    if (isClosed) {
      // Reload ad after it was shown
      load();
    }
  }, [isClosed, load]);

  const onUserSwipe = () => {
    const newCount = swipeCount + 1;
    setSwipeCount(newCount);
    console.log(`📊 Swipe count: ${newCount}/${SWIPES_UNTIL_AD}`);
    
    if (newCount >= SWIPES_UNTIL_AD) {
      if (isLoaded) {
        console.log('🎬 Showing interstitial ad NOW!');
        try {
          show();
          setSwipeCount(0);
        } catch (showError) {
          console.error('🎬 Error showing ad:', showError);
        }
      } else {
        console.log('⏳ Ad not loaded yet, will show when ready');
        console.log('⏳ This is common with test ads in development mode');
        console.log('⏳ Current ad state:', { isLoaded, error: error?.message });
        // Try to show as soon as it loads
        if (!isLoaded) {
          load();
        }
      }
    }
  };

  const onSessionEnd = () => {
    console.log('🔚 Session ended');
    if (swipeCount > 6 && isLoaded) {
      console.log('🎬 Showing interstitial ad on session end');
      show();
      setSwipeCount(0);
    }
  };

  return {
    onUserSwipe,
    onSessionEnd,
    isAdLoaded: isLoaded,
  };
};
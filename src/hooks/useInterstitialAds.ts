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
  if (IS_PRODUCTION_BUILD && !isDevelopment) {
    const productionId = Platform.OS === 'android' 
      ? 'ca-app-pub-1745058833253836/4423842963'
      : TestIds.INTERSTITIAL; // iOS placeholder until you get the iOS ID
    
    if (!hasLoggedAdConfig) {
      console.log('🚀 Using PRODUCTION ad ID:', productionId);
      hasLoggedAdConfig = true;
    }
    return productionId;
  }
  
  if (!hasLoggedAdConfig) {
    console.log('🧪 Using TEST ad ID:', TestIds.INTERSTITIAL);
    hasLoggedAdConfig = true;
  }
  return TestIds.INTERSTITIAL;
};

// Use the hook-based approach which should work better
export const useInterstitialAds = () => {
  const [swipeCount, setSwipeCount] = useState(0);
  const SWIPES_UNTIL_AD = 12;
  
  const adUnitId = getAdUnitId();

  // Use the correct ad unit ID
  const { isLoaded, isClosed, load, show, error } = useInterstitialAd(adUnitId);

  useEffect(() => {
    // Start loading the interstitial ad
    load();
  }, []); // Remove load dependency to prevent double loading
  
  useEffect(() => {
    if (error) {
      console.error('❌ Interstitial ad error:', error);
      // Retry loading after 5 seconds on error
      setTimeout(() => load(), 5000);
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
        show();
        setSwipeCount(0);
      } else {
        console.log('⏳ Ad not loaded yet, will show when ready');
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
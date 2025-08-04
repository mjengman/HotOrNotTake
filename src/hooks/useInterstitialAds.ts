import { useEffect, useState } from 'react';
import { useInterstitialAd, TestIds, AdEventType } from 'react-native-google-mobile-ads';

// Use the hook-based approach which should work better
export const useInterstitialAds = () => {
  const [swipeCount, setSwipeCount] = useState(0);
  const SWIPES_UNTIL_AD = 12; // Production setting

  // Use the provided hook from react-native-google-mobile-ads
  // Remove requestNonPersonalizedAdsOnly to increase fill rate
  const { isLoaded, isClosed, load, show, error } = useInterstitialAd(TestIds.INTERSTITIAL);

  useEffect(() => {
    // Start loading the interstitial ad
    console.log('📱 Starting to load interstitial ad...');
    console.log('🔍 Current state - isLoaded:', isLoaded);
    console.log('🔍 Test ID being used:', TestIds.INTERSTITIAL);
    load();
  }, []); // Remove load dependency to prevent double loading
  
  useEffect(() => {
    if (error) {
      console.error('❌ Interstitial ad error:', error);
      // Retry loading after 5 seconds on error
      setTimeout(() => {
        console.log('🔄 Retrying ad load after error...');
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
      console.log('🔄 Reloading interstitial ad after close');
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
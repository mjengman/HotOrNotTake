import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import mobileAds, { useInterstitialAd, TestIds } from 'react-native-google-mobile-ads';

const PROD_ANDROID = 'ca-app-pub-1745058833253836/4423842963';
const PROD_IOS = 'ca-app-pub-1745058833253836/9192270099'; // iOS interstitial ID

const getAdUnitId = () =>
  __DEV__
    ? TestIds.INTERSTITIAL
    : Platform.select({ android: PROD_ANDROID, ios: PROD_IOS }) || TestIds.INTERSTITIAL;

export const useInterstitialAds = () => {
  // Progressive scaling ad system - rewards power users with fewer ads
  const BASE_CARDS_UNTIL_AD = 15; // First ad after 15 swipes
  const TIER1_INCREMENT = 5; // Add 5 more swipes each time (tier 1)
  const TIER1_CAP = 50; // Switch to tier 2 after reaching 50
  const TIER2_INCREMENT = 10; // Add 10 more swipes each time (tier 2 - power users)
  const MIN_TIME_BETWEEN_ADS_MS = 180000; // 3 minutes (increased from 3 minutes)
  const MIN_SESSION_TIME_BEFORE_FIRST_AD = 180000; // Don't show ads in first 3 minutes
  
  // Track session start time
  const sessionStartRef = useRef<number>(Date.now());

  // initialize once (safe to call multiple times; lib ignores repeats)
  useEffect(() => {
    mobileAds()
      .initialize()
      .catch(() => {}); // ignore init errors in dev
  }, []);

  const adUnitId = useMemo(getAdUnitId, []);
  const { isLoaded, isClosed, load, show, error } = useInterstitialAd(adUnitId);

  const [cardCount, setCardCount] = useState(0); // count completed cards
  const [adsShown, setAdsShown] = useState(0); // track how many ads shown for scaling
  const oweAdRef = useRef(false);      // we hit threshold before load finished
  const showingRef = useRef(false);    // prevent double show()
  const lastAdTimeRef = useRef<number>(0); // track last ad show time

  // load one on mount
  useEffect(() => {
    load();
  }, [load]);

  // if ad failed, retry after a short delay (simple backoff)
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => load(), 3000);
    return () => clearTimeout(id);
  }, [error, load]);

  // after an ad closes, load next
  useEffect(() => {
    if (!isClosed) return;
    showingRef.current = false;
    oweAdRef.current = false;
    load();
  }, [isClosed, load]);

  // Helper to check if enough time has passed since last ad
  const canShowAd = () => {
    const now = Date.now();
    const timeSinceLastAd = now - lastAdTimeRef.current;
    return timeSinceLastAd >= MIN_TIME_BETWEEN_ADS_MS;
  };

  // Calculate current threshold based on ads shown with tier system
  const getCurrentThreshold = () => {
    if (adsShown === 0) return BASE_CARDS_UNTIL_AD;
    
    // Calculate tier 1 progression: 15, 20, 25, 30, 35, 40, 45, 50
    const tier1Max = (TIER1_CAP - BASE_CARDS_UNTIL_AD) / TIER1_INCREMENT; // 7 ads to reach tier 2
    
    if (adsShown <= tier1Max) {
      // Tier 1: 15 + (ads * 5)
      return BASE_CARDS_UNTIL_AD + (adsShown * TIER1_INCREMENT);
    } else {
      // Tier 2 (power users): 50 + ((ads_beyond_tier1) * 10)
      const tier2Ads = adsShown - tier1Max;
      return TIER1_CAP + (tier2Ads * TIER2_INCREMENT);
    }
  };

  // Helper to show ad and update timestamp
  const showAd = () => {
    showingRef.current = true;
    lastAdTimeRef.current = Date.now();
    show();
    setCardCount(0); // reset card counter after showing ad
    setAdsShown(prev => prev + 1); // increment ads shown for scaling
    const nextThreshold = getCurrentThreshold();
    const tier = nextThreshold <= TIER1_CAP ? "Regular" : "Power User";
    console.log(`📺 Ad shown (${adsShown + 1} total, ${tier}). Next ad after ${nextThreshold} swipes`);
  };

  // Note: Removed auto-show useEffect to prevent mid-animation interruptions
  // Ads now only show at explicit "natural breaks" via onCardComplete()

  // Call this AFTER a card is completely dismissed (natural break)
  const onCardComplete = () => {
    // Check if enough session time has passed before showing any ads
    const sessionTime = Date.now() - sessionStartRef.current;
    if (sessionTime < MIN_SESSION_TIME_BEFORE_FIRST_AD) {
      console.log(`Session too young for ads: ${Math.ceil((MIN_SESSION_TIME_BEFORE_FIRST_AD - sessionTime) / 1000)}s remaining`);
      return;
    }

    // Increment completed card count
    const next = cardCount + 1;
    setCardCount(next);

    // First, check if we owe an ad and cooldown has passed
    if (oweAdRef.current && canShowAd()) {
      if (isLoaded && !showingRef.current) {
        showAd();
        oweAdRef.current = false;
        return; // Exit early after showing owed ad
      }
      // Still owe but ad not loaded, keep trying to load
      if (!isLoaded) load();
      return;
    }

    // Progressive threshold checking
    const currentThreshold = getCurrentThreshold();
    if (next >= currentThreshold) {
      // Check both card count AND time cooldown
      if (canShowAd()) {
        if (isLoaded && !showingRef.current) {
          showAd();
        } else {
          // not loaded yet → remember to show when ready
          oweAdRef.current = true;
          // make sure a load is in flight
          load();
        }
      } else {
        // Cooldown not met, mark that we owe an ad but don't reset counter
        oweAdRef.current = true;
        console.log(`Ad cooldown active. Time remaining: ${Math.ceil((MIN_TIME_BETWEEN_ADS_MS - (Date.now() - lastAdTimeRef.current)) / 1000)}s`);
        // Don't reset card count - we still owe this ad
      }
    } else {
      // keep pipeline warm
      if (!isLoaded) load();
      console.log(`Cards until next ad: ${currentThreshold - next} (threshold: ${currentThreshold})`);
    }
  };

  const onSessionEnd = () => {
    // Check session time before showing end ad
    const sessionTime = Date.now() - sessionStartRef.current;
    if (sessionTime < MIN_SESSION_TIME_BEFORE_FIRST_AD) {
      console.log('Session too short for end ad');
      return;
    }

    // optional: show at end if user was close to threshold (and cooldown passed)
    const currentThreshold = getCurrentThreshold();
    if (cardCount >= Math.ceil(currentThreshold / 2) && canShowAd()) {
      if (isLoaded && !showingRef.current) {
        showAd();
      } else {
        oweAdRef.current = true;
        load();
      }
    }
  };

  return {
    onCardComplete, // renamed from onUserSwipe
    onSessionEnd,
    isAdLoaded: isLoaded,
  };
};
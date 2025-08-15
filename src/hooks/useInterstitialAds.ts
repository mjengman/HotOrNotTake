import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import mobileAds, { useInterstitialAd, TestIds } from 'react-native-google-mobile-ads';

const PROD_ANDROID = 'ca-app-pub-1745058833253836/4423842963';
const PROD_IOS = TestIds.INTERSTITIAL; // TODO: replace with your real iOS unit

const getAdUnitId = () =>
  __DEV__
    ? TestIds.INTERSTITIAL
    : Platform.select({ android: PROD_ANDROID, ios: PROD_IOS }) || TestIds.INTERSTITIAL;

export const useInterstitialAds = () => {
  const CARDS_UNTIL_AD = 12; // renamed: count completed cards, not raw swipes
  const MIN_TIME_BETWEEN_ADS_MS = 90000; // 90 seconds = 1.5 minutes

  // initialize once (safe to call multiple times; lib ignores repeats)
  useEffect(() => {
    mobileAds()
      .initialize()
      .catch(() => {}); // ignore init errors in dev
  }, []);

  const adUnitId = useMemo(getAdUnitId, []);
  const { isLoaded, isClosed, load, show, error } = useInterstitialAd(adUnitId);

  const [cardCount, setCardCount] = useState(0); // count completed cards
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

  // Helper to show ad and update timestamp
  const showAd = () => {
    showingRef.current = true;
    lastAdTimeRef.current = Date.now();
    show();
    setCardCount(0); // reset card counter after showing ad
  };

  // Note: Removed auto-show useEffect to prevent mid-animation interruptions
  // Ads now only show at explicit "natural breaks" via onCardComplete()

  // Call this AFTER a card is completely dismissed (natural break)
  const onCardComplete = () => {
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

    // Normal threshold checking
    if (next >= CARDS_UNTIL_AD) {
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
    }
  };

  const onSessionEnd = () => {
    // optional: show at end if user was close to threshold (and cooldown passed)
    if (cardCount >= Math.ceil(CARDS_UNTIL_AD / 2) && canShowAd()) {
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
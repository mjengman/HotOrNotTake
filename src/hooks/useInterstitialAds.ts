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
  const SWIPES_UNTIL_AD = 12;

  // initialize once (safe to call multiple times; lib ignores repeats)
  useEffect(() => {
    mobileAds()
      .initialize()
      .catch(() => {}); // ignore init errors in dev
  }, []);

  const adUnitId = useMemo(getAdUnitId, []);
  const { isLoaded, isClosed, load, show, error } = useInterstitialAd(adUnitId);

  const [swipeCount, setSwipeCount] = useState(0);
  const oweAdRef = useRef(false);      // we hit threshold before load finished
  const showingRef = useRef(false);    // prevent double show()

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

  // if we owed an ad and it finally loaded, show now
  useEffect(() => {
    if (isLoaded && oweAdRef.current && !showingRef.current) {
      showingRef.current = true;
      show();
      oweAdRef.current = false;
      setSwipeCount(0);
    }
  }, [isLoaded, show]);

  const onUserSwipe = () => {
    const next = swipeCount + 1;
    setSwipeCount(next);

    if (next >= SWIPES_UNTIL_AD) {
      if (isLoaded && !showingRef.current) {
        showingRef.current = true;
        show();
        setSwipeCount(0);
      } else {
        // not loaded yet → remember to show when ready
        oweAdRef.current = true;
        // make sure a load is in flight
        load();
      }
    } else {
      // keep pipeline warm
      if (!isLoaded) load();
    }
  };

  const onSessionEnd = () => {
    // optional: show at end if user was close to threshold
    if (swipeCount >= Math.ceil(SWIPES_UNTIL_AD / 2)) {
      if (isLoaded && !showingRef.current) {
        showingRef.current = true;
        show();
        setSwipeCount(0);
      } else {
        oweAdRef.current = true;
        load();
      }
    }
  };

  return {
    onUserSwipe,
    onSessionEnd,
    isAdLoaded: isLoaded,
  };
};
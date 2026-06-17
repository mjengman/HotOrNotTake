import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useAdFlags } from '../contexts/ConsentContext';

interface AdBannerProps {
  size?: BannerAdSize;
}

// Use Google's test banner in dev so local testing is stable and never requests live ads.
const USE_PRODUCTION_ADS = !__DEV__;

const adUnitId = Platform.select({
  ios: USE_PRODUCTION_ADS ? 'ca-app-pub-1745058833253836/7308079457' : TestIds.BANNER,
  android: USE_PRODUCTION_ADS ? 'ca-app-pub-1745058833253836/2017171479' : TestIds.BANNER,
}) ?? '';

const AdBannerInner: React.FC<AdBannerProps> = ({ size = BannerAdSize.BANNER }) => {
  const { canRequestAds, personalized, ready } = useAdFlags();
  const requestOptions = React.useMemo(
    () => personalized ? undefined : { requestNonPersonalizedAdsOnly: true },
    [personalized]
  );

  // Don't request until consent ready AND allowed
  if (!ready || !canRequestAds) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={size}
        requestOptions={requestOptions}
        onAdFailedToLoad={(error) => {
          if (__DEV__) {
          }
        }}
      />
    </View>
  );
};

export const AdBanner = React.memo(AdBannerInner);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});

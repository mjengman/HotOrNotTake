import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useAdFlags } from '../../App-UMP';

interface AdBannerProps {
  size?: BannerAdSize;
}

const USE_PRODUCTION_ADS = true;

const adUnitId = Platform.select({
  ios: USE_PRODUCTION_ADS ? 'ca-app-pub-1745058833253836/7308079457' : TestIds.BANNER,
  android: USE_PRODUCTION_ADS ? 'ca-app-pub-1745058833253836/2017171479' : TestIds.BANNER,
}) ?? '';

export const AdBanner: React.FC<AdBannerProps> = ({ size = BannerAdSize.BANNER }) => {
  const { canRequestAds, personalized, ready } = useAdFlags();

  // Don't request until consent ready AND allowed
  if (!ready || !canRequestAds) return null;

  const requestOptions = personalized ? undefined : { requestNonPersonalizedAdsOnly: true };

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={size}
        requestOptions={requestOptions}
        onAdLoaded={() => console.log('🎯 Banner ad loaded successfully')}
        onAdFailedToLoad={(error) => console.log('❌ Banner ad failed to load:', error)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useConsent } from '../../App';

interface AdBannerProps {
  size?: BannerAdSize;
}

// Ad unit IDs
// NOTE: "no-fill" errors are NORMAL for new apps and emulators
// The implementation is working correctly when you see these errors
// Real devices with real users will have better fill rates
const USE_PRODUCTION_ADS = true; // Use production ads for release

const adUnitId = Platform.select({
  ios: USE_PRODUCTION_ADS
    ? 'ca-app-pub-1745058833253836/7308079457' // iOS banner ID
    : TestIds.BANNER,
  android: USE_PRODUCTION_ADS 
    ? 'ca-app-pub-1745058833253836/2017171479' // Android banner ID
    : TestIds.BANNER,
}) ?? '';

export const AdBanner: React.FC<AdBannerProps> = ({ 
  size = BannerAdSize.BANNER 
}) => {
  const consent = useConsent();

  // Don't show ads if we can't request them
  if (!consent.canRequestAds) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={size}
        requestOptions={{
          // Use personalized ads only when user has consented
          requestNonPersonalizedAdsOnly: !consent.personalized,
        }}
        onAdLoaded={() => {
          console.log('🎯 Banner ad loaded successfully', { personalized: consent.personalized });
        }}
        onAdFailedToLoad={(error) => {
          console.log('❌ Banner ad failed to load:', error);
        }}
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
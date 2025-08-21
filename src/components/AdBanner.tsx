import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

interface AdBannerProps {
  size?: BannerAdSize;
}

// Ad unit IDs
// NOTE: "no-fill" errors are NORMAL for new apps and emulators
// The implementation is working correctly when you see these errors
// Real devices with real users will have better fill rates
const USE_PRODUCTION_ADS = true; // Use production ads for release

const adUnitId = Platform.select({
  ios: TestIds.BANNER, // Keep test ID for iOS for now
  android: USE_PRODUCTION_ADS 
    ? 'ca-app-pub-1745058833253836/2017171479' // Your real banner ID
    : TestIds.BANNER,
}) ?? '';

export const AdBanner: React.FC<AdBannerProps> = ({ 
  size = BannerAdSize.BANNER 
}) => {
  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true, // GDPR compliance
        }}
        onAdLoaded={() => {
          console.log('🎯 Banner ad loaded successfully');
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
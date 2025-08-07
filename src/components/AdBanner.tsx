import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

interface AdBannerProps {
  size?: BannerAdSize;
}

// Ad unit IDs
const adUnitId = __DEV__ 
  ? TestIds.BANNER // Use test IDs during development
  : Platform.select({
      ios: TestIds.BANNER, // Keep test ID for iOS for now
      android: 'ca-app-pub-1745058833253836/2017171479', // Your real banner ID
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
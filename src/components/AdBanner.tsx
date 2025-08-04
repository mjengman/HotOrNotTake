import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

interface AdBannerProps {
  size?: BannerAdSize;
}

// Test ad unit IDs (replace with your real IDs when going to production)
const adUnitId = __DEV__ 
  ? TestIds.BANNER // Use test IDs during development
  : Platform.select({
      ios: 'ca-app-pub-YOUR_PUBLISHER_ID/YOUR_AD_UNIT_ID',
      android: 'ca-app-pub-YOUR_PUBLISHER_ID/YOUR_AD_UNIT_ID',
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
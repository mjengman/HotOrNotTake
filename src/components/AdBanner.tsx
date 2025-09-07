import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useAdFlags } from '../contexts/ConsentContext';

interface AdBannerProps {
  size?: BannerAdSize;
}

// Production ads enabled - setup verified
const USE_PRODUCTION_ADS = true;

const adUnitId = Platform.select({
  ios: USE_PRODUCTION_ADS ? 'ca-app-pub-1745058833253836/7308079457' : TestIds.BANNER,
  android: USE_PRODUCTION_ADS ? 'ca-app-pub-1745058833253836/2017171479' : TestIds.BANNER,
}) ?? '';

console.log('🎯 AdBanner config:', { 
  platform: Platform.OS, 
  useProduction: USE_PRODUCTION_ADS, 
  adUnitId: adUnitId.substring(0, 20) + '...' 
});

export const AdBanner: React.FC<AdBannerProps> = ({ size = BannerAdSize.BANNER }) => {
  const { canRequestAds, personalized, ready } = useAdFlags();

  console.log('🎯 AdBanner render state:', { ready, canRequestAds, personalized });

  // Don't request until consent ready AND allowed
  if (!ready || !canRequestAds) {
    console.log('🎯 AdBanner not requesting - consent not ready or not allowed');
    return null;
  }

  const requestOptions = personalized ? undefined : { requestNonPersonalizedAdsOnly: true };
  
  console.log('🎯 AdBanner requesting ad:', { 
    unitId: adUnitId.substring(0, 20) + '...', 
    personalized, 
    requestOptions 
  });

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={size}
        requestOptions={requestOptions}
        onAdLoaded={() => console.log('✅ Banner ad loaded successfully!', { personalized, unitId: adUnitId })}
        onAdFailedToLoad={(error) => {
          console.log('❌ Banner ad failed to load:', error);
          console.log('🔍 Ad failure context:', { personalized, unitId: adUnitId, requestOptions });
        }}
        onAdOpened={() => console.log('📱 Banner ad opened')}
        onAdClosed={() => console.log('📱 Banner ad closed')}
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
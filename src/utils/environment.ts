import Constants from 'expo-constants';

/**
 * Detects if the app is running in Expo Go
 * Returns true in Expo Go, false in production builds
 */
export const isExpoGo = (): boolean => {
  // In Expo Go, the executionEnvironment is 'storeClient'
  // In production builds, it's 'standalone' or 'bare'
  return Constants.executionEnvironment === 'storeClient';
};

/**
 * Helper to conditionally apply Expo Go workarounds
 */
export const expoGoWorkaround = <T>(expoGoValue: T, productionValue: T): T => {
  return isExpoGo() ? expoGoValue : productionValue;
};
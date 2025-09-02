import { Platform } from 'react-native';
import { 
  AdEventType, 
  TestIds,
  BannerAdSize 
} from 'react-native-google-mobile-ads';

// Import InterstitialAd differently - it might be a default export
const { InterstitialAd } = require('react-native-google-mobile-ads');

// Ad unit IDs
// For testing, let's be more explicit about when to use production ads
const USE_PRODUCTION_ADS = true; // Set to true for production builds

const interstitialAdUnitId = Platform.select({
  ios: USE_PRODUCTION_ADS
    ? 'ca-app-pub-1745058833253836/9192270099' // iOS interstitial ID
    : TestIds.INTERSTITIAL,
  android: USE_PRODUCTION_ADS 
    ? 'ca-app-pub-1745058833253836/4423842963' // Android interstitial ID
    : TestIds.INTERSTITIAL,
}) ?? '';

console.log('🎯 Using interstitial ad ID:', interstitialAdUnitId);
console.log('📱 Platform:', Platform.OS);

class AdService {
  private interstitialAd: InterstitialAd;
  private isInterstitialLoaded = false;
  private swipeCount = 0;
  private readonly SWIPES_UNTIL_AD = 12; // Show ad every 12 swipes

  constructor() {
    try {
      // Check what methods are available
      console.log('🔍 InterstitialAd methods:', Object.getOwnPropertyNames(InterstitialAd));
      
      // Try the documented API with correct name
      if (InterstitialAd && typeof InterstitialAd.createForAdUnitId === 'function') {
        this.interstitialAd = InterstitialAd.createForAdUnitId(interstitialAdUnitId);
      } else {
        console.error('❌ InterstitialAd.createForAdUnitId not found, trying constructor...');
        // Try direct instantiation
        this.interstitialAd = new InterstitialAd(interstitialAdUnitId);
      }
    } catch (error) {
      console.error('❌ Failed to create InterstitialAd:', error);
      // Create a dummy to prevent crashes
      this.interstitialAd = null as any;
    }

    this.setupInterstitialListeners();
    this.loadInterstitialAd();
  }

  private setupInterstitialListeners() {
    this.interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      console.log('🎯 Interstitial ad loaded successfully');
      this.isInterstitialLoaded = true;
    });

    this.interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log('❌ Interstitial ad failed to load:', JSON.stringify(error, null, 2));
      console.log('📍 Ad Unit ID was:', interstitialAdUnitId);
      this.isInterstitialLoaded = false;
      // Retry loading after a delay
      setTimeout(() => this.loadInterstitialAd(), 30000); // 30 seconds
    });

    this.interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('🔒 Interstitial ad closed');
      this.isInterstitialLoaded = false;
      // Load the next ad
      this.loadInterstitialAd();
    });

    this.interstitialAd.addAdEventListener(AdEventType.OPENED, () => {
      console.log('👁️ Interstitial ad opened');
    });
  }

  private loadInterstitialAd() {
    if (!this.isInterstitialLoaded) {
      console.log('📥 Loading interstitial ad...');
      this.interstitialAd.load();
    } else {
      console.log('✅ Ad already loaded, skipping load request');
    }
  }

  // Call this every time user swipes (votes or skips)
  public onUserSwipe() {
    this.swipeCount++;
    console.log(`📊 Swipe count: ${this.swipeCount}/${this.SWIPES_UNTIL_AD}`);

    if (this.swipeCount >= this.SWIPES_UNTIL_AD) {
      this.showInterstitialAd();
      this.swipeCount = 0; // Reset counter
    }
  }

  // Call this when user finishes a deck or switches categories
  public onSessionEnd() {
    // Show ad if user has swiped at least 6 times
    if (this.swipeCount >= 6) {
      this.showInterstitialAd();
      this.swipeCount = 0;
    }
  }

  private showInterstitialAd() {
    if (this.isInterstitialLoaded) {
      console.log('🎬 Showing interstitial ad');
      this.interstitialAd.show();
    } else {
      console.log('⏳ Interstitial ad not ready yet');
      // Try to load if not already loading
      this.loadInterstitialAd();
    }
  }

  // Manual trigger for testing
  public showAdNow() {
    this.showInterstitialAd();
  }

  // Get current swipe progress (for debugging)
  public getSwipeProgress(): { current: number; target: number; percentage: number } {
    return {
      current: this.swipeCount,
      target: this.SWIPES_UNTIL_AD,
      percentage: Math.round((this.swipeCount / this.SWIPES_UNTIL_AD) * 100)
    };
  }
}

// Singleton instance
const adService = new AdService();
export default adService;
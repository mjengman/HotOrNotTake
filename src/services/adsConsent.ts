// Minimal UMP wrapper using react-native-google-mobile-ads
import mobileAds, {
  MaxAdContentRating,
  AdsConsent,
  AdsConsentStatus,
  AdsConsentDebugGeography,
} from 'react-native-google-mobile-ads';

export type ConsentState = {
  status: AdsConsentStatus;
  canRequestAds: boolean;
  personalized: boolean; // true only if the user consented
};

export async function initAdsAndConsent(debug?: {
  testDeviceIds?: string[];
  eea?: boolean; // force EEA geography for testing only
}): Promise<ConsentState> {
  try {
    // Optional: global request configuration (do this before mobileAds().initialize())
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      testDeviceIdentifiers: debug?.testDeviceIds ?? [],
    });

    // Set debug geography if in debug mode (ONLY for testing!)
    if (debug?.eea) {
      await AdsConsent.setDebugGeography(AdsConsentDebugGeography.EEA);
    }
    if (debug?.testDeviceIds) {
      await AdsConsent.addTestDevices(debug.testDeviceIds);
    }

    // 1) Use the simplified gatherConsent method that handles everything
    await AdsConsent.gatherConsent();

    // 2) Get final consent info after consent gathering
    const consentInfo = await AdsConsent.getConsentInfo();
    const { status, canRequestAds } = consentInfo;

    // Check if we have GDPR consent for personalized ads
    const gdprApplies = await AdsConsent.getGdprApplies();
    let personalized = false;
    
    if (gdprApplies) {
      // For GDPR regions, check purpose consent (purpose 1 is personalized ads)
      const purposeConsents = await AdsConsent.getPurposeConsents();
      personalized = purposeConsents.startsWith("1"); // "1" means consent given for purpose 1
    } else {
      // For non-GDPR regions, personalized ads are allowed
      personalized = true;
    }

    // 3) Initialize the Mobile Ads SDK AFTER consent resolution
    if (canRequestAds) {
      await mobileAds().initialize();
    }

    console.log('🎯 Ads consent initialized:', { status, canRequestAds, personalized, gdprApplies });

    return { status, canRequestAds, personalized };
  } catch (error) {
    console.error('❌ Error initializing ads consent:', error);
    
    // If anything fails, stay safe: use non-personalized and initialize SDK
    try {
      await mobileAds().initialize();
    } catch (initError) {
      console.error('❌ Error initializing mobile ads SDK:', initError);
    }
    
    return { 
      status: AdsConsentStatus.NOT_REQUIRED, 
      canRequestAds: true, 
      personalized: false 
    };
  }
}

// Optional: show the privacy options form from Settings screen
export async function openPrivacyOptionsForm(): Promise<void> {
  try {
    // For privacy options, we can try to show the consent form again
    await AdsConsent.gatherConsent();
  } catch (error) {
    console.error('❌ Error showing privacy options form:', error);
  }
}
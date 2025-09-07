// Minimal UMP wrapper using react-native-google-mobile-ads
import mobileAds, {
  MaxAdContentRating,
  AdsConsent,
  AdsConsentStatus,
  AdsConsentDebugGeography,
} from 'react-native-google-mobile-ads';

let adsInitialized = false; // module-level flag to prevent duplicate initialization

// Note: iOS ATT can be handled automatically by UMP SDK when configured in AdMob
// or manually with react-native-tracking-transparency library if needed

export type ConsentState = {
  status: AdsConsentStatus;
  canRequestAds: boolean;
  personalized: boolean; // true only if the user consented to personalized ads
};

export async function initAdsAndConsent(debug?: {
  testDeviceIds?: string[];
  eea?: boolean; // force EEA geography for testing only
}): Promise<ConsentState> {
  try {
    // Configure BEFORE initialize()
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      testDeviceIdentifiers: debug?.testDeviceIds ?? [],
      // tagForChildDirectedTreatment, tagForUnderAgeOfConsent can be added here if relevant
    });

    // 1) Refresh consent info (with optional debug)
    let consentRequired = false;
    try {
      await AdsConsent.requestInfoUpdate({
        debugGeography: debug?.eea ? AdsConsentDebugGeography.EEA : undefined,
        testDeviceIdentifiers: debug?.testDeviceIds ?? [],
      });
      consentRequired = true;
    } catch (error: any) {
      // Handle common UMP configuration errors gracefully
      if (error?.message?.includes('no form(s) configured') || 
          error?.message?.includes('Publisher misconfiguration')) {
        console.log('📝 UMP forms not configured - proceeding without consent dialog (common in development)');
        consentRequired = false;
      } else {
        throw error; // Re-throw unexpected errors
      }
    }

    // 2) Show consent / privacy form if required and available
    if (consentRequired) {
      try {
        if (typeof (AdsConsent as any).gatherConsent === 'function') {
          await (AdsConsent as any).gatherConsent();
        } else if (typeof AdsConsent.loadAndShowConsentFormIfRequired === 'function') {
          await AdsConsent.loadAndShowConsentFormIfRequired();
        }
      } catch (formError: any) {
        console.log('📝 Consent form error (proceeding):', formError?.message || formError);
      }
    }

    // 3) Read final state (with fallback if UMP unavailable)
    let info: any, gdprApplies: boolean | undefined;
    try {
      info = await AdsConsent.getConsentInfo();
      gdprApplies = await AdsConsent.getGdprApplies();
    } catch (error: any) {
      console.log('📝 UMP info unavailable, using defaults:', error?.message || error);
      info = { status: AdsConsentStatus.NOT_REQUIRED, canRequestAds: true };
      gdprApplies = undefined;
    }
    
    const { status, canRequestAds } = info;

    // Prefer SDK-provided booleans; fall back to a conservative default.
    // In many versions, if GDPR applies and user did not consent, canRequestAds can still be true
    // (but only for NPA). So we derive "personalized" as:
    let personalized = false;

    // If your version exposes a consent type API, use that instead:
    // const type = await AdsConsent.getConsentType?.();
    // personalized = type === 'PERSONALIZED';

    if (gdprApplies === true) {
      // In GDPR regions, treat as personalized only if status is OBTAINED
      // and your version indicates consent for personalized ads.
      // Without a dedicated API, keep this conservative:
      personalized = status === AdsConsentStatus.OBTAINED;
    } else if (gdprApplies === false) {
      // Outside GDPR, personalized is allowed by default
      personalized = true;
    } else {
      // Unknown GDPR status - safest default is NPA
      personalized = false;
    }

    // 4) Initialize SDK ONLY when allowed to request ads (and only once)
    if (canRequestAds && !adsInitialized) {
      await mobileAds().initialize();
      adsInitialized = true;
    }

    console.log('🎯 Ads consent initialized:', { status, canRequestAds, personalized, gdprApplies });
    return { status, canRequestAds, personalized };
  } catch (error) {
    console.error('❌ Error initializing ads consent:', error);
    // Fail-safe: initialize SDK and force NPA (only once)
    try {
      if (!adsInitialized) {
        await mobileAds().initialize();
        adsInitialized = true;
      }
    } catch (initError) {
      console.error('❌ Error initializing mobile ads SDK:', initError);
    }
    return {
      status: AdsConsentStatus.NOT_REQUIRED,
      canRequestAds: true,
      personalized: false, // safe default = NPA
    };
  }
}

// For Settings screen - show privacy options form (ChatGPT-5's recommendation)
export async function showPrivacyOptionsForm(): Promise<void> {
  try {
    const consentInfo = await AdsConsent.getConsentInfo();
    console.log('🔧 Privacy options status:', consentInfo);

    // Always try to show the consent form—UMP decides if it should display
    if (typeof (AdsConsent as any).gatherConsent === 'function') {
      await (AdsConsent as any).gatherConsent();
    } else if (typeof AdsConsent.loadAndShowConsentFormIfRequired === 'function') {
      await AdsConsent.loadAndShowConsentFormIfRequired();
    }

    console.log('✅ Privacy options form completed');
  } catch (error) {
    console.error('❌ Error showing privacy options form:', error);
  }
}

// Legacy alias for backward compatibility
export const openPrivacyOptionsForm = showPrivacyOptionsForm;
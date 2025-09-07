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
    await AdsConsent.requestInfoUpdate({
      debugGeography: debug?.eea ? AdsConsentDebugGeography.EEA : undefined,
      testDeviceIdentifiers: debug?.testDeviceIds ?? [],
    });

    // 2) Show consent / privacy form if required
    // (Use gatherConsent() if that's what your lib version documents;
    // otherwise use loadAndShowConsentFormIfRequired()).
    if (typeof (AdsConsent as any).gatherConsent === 'function') {
      await (AdsConsent as any).gatherConsent();
    } else if (typeof AdsConsent.loadAndShowConsentFormIfRequired === 'function') {
      await AdsConsent.loadAndShowConsentFormIfRequired();
    }

    // 3) Read final state
    const info = await AdsConsent.getConsentInfo();
    const { status, canRequestAds } = info;

    // Prefer SDK-provided booleans; fall back to a conservative default.
    // In many versions, if GDPR applies and user did not consent, canRequestAds can still be true
    // (but only for NPA). So we derive "personalized" as:
    const gdprApplies = await AdsConsent.getGdprApplies();
    let personalized = false;

    // If your version exposes a consent type API, use that instead:
    // const type = await AdsConsent.getConsentType?.();
    // personalized = type === 'PERSONALIZED';

    if (gdprApplies) {
      // In GDPR regions, treat as personalized only if status is OBTAINED
      // and your version indicates consent for personalized ads.
      // Without a dedicated API, keep this conservative:
      personalized = status === AdsConsentStatus.OBTAINED;
    } else {
      // Outside GDPR, personalized is allowed by default
      personalized = true;
    }

    // 4) Initialize SDK ONLY when allowed to request ads
    if (canRequestAds) {
      await mobileAds().initialize();
    }

    console.log('🎯 Ads consent initialized:', { status, canRequestAds, personalized, gdprApplies });
    return { status, canRequestAds, personalized };
  } catch (error) {
    console.error('❌ Error initializing ads consent:', error);
    // Fail-safe: initialize SDK and force NPA
    try {
      await mobileAds().initialize();
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

export async function openPrivacyOptionsForm(): Promise<void> {
  try {
    // Prefer the dedicated privacy options method if available
    if (typeof AdsConsent.showPrivacyOptionsForm === 'function') {
      await AdsConsent.showPrivacyOptionsForm();
    } else if (typeof (AdsConsent as any).gatherConsent === 'function') {
      // Fallback for versions exposing only gatherConsent()
      await (AdsConsent as any).gatherConsent();
    } else if (typeof AdsConsent.loadAndShowConsentFormIfRequired === 'function') {
      await AdsConsent.loadAndShowConsentFormIfRequired();
    }
    console.log('✅ Privacy options flow completed');
  } catch (error) {
    console.error('❌ Error showing privacy options form:', error);
  }
}
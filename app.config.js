// App identity is store-sensitive:
// - Android is live on Google Play as com.anonymous.HotOrNotTakes.
// - iOS is live on the App Store as com.hotornottakes.app.
// Do not rename either package without creating a new store app/listing.
const isDevelopmentBuild =
  process.env.APP_VARIANT === "development" ||
  process.env.EAS_BUILD_PROFILE === "development";

export default () => ({
  expo: {
    name: isDevelopmentBuild ? "Hot or Not Takes Dev" : "Hot or Not Takes",
    slug: "HotOrNotTakes",
    version: "1.0.8",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-image.png",
      resizeMode: "contain",
      backgroundColor: "#1f1f1f"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.hotornottakes.app"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#1f1f1f"
      },
      edgeToEdgeEnabled: true,
      // Development builds use a separate package so they can live next to
      // the Play Store app on real devices.
      package: isDevelopmentBuild
        ? "com.anonymous.HotOrNotTakes.dev"
        : "com.anonymous.HotOrNotTakes"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-build-properties",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#FF4757",
          mode: isDevelopmentBuild ? "development" : "production",
          defaultChannel: "gameplay-reminders",
          enableBackgroundRemoteNotifications: false
        }
      ],
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: "ca-app-pub-1745058833253836~8031915483",
          iosAppId: "ca-app-pub-1745058833253836~9865797363",
          delayAppMeasurementInit: true, // GDPR compliance - delay until consent
          userTrackingUsageDescription: "This identifier will be used to deliver personalized ads to you." // iOS ATT - UMP can handle ATT automatically, or use react-native-tracking-transparency for manual control
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "7d390f1c-4d9b-4414-a359-2d8fd3f3ed43"
      }
    },
    runtimeVersion: "exposdk:53.0.0",
    updates: {
      enabled: true,
      url: "https://u.expo.dev/7d390f1c-4d9b-4414-a359-2d8fd3f3ed43"
    }
  }
});

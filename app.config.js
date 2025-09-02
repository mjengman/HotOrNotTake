// ChatGPT's suggested fix: Use app.config.js to embed API key in manifest
export default () => ({
  expo: {
    name: "Hot or Not Takes",
    slug: "HotOrNotTakes",
    version: "1.0.3",
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
      package: "com.hotornottakes.app"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-build-properties",
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: "ca-app-pub-1745058833253836~8031915483",
          iosAppId: "ca-app-pub-1745058833253836~9865797363"
        }
      ]
    ],
    extra: {
      // ChatGPT's fix: Put OpenAI key in extra so it works with OTA updates
      openaiApiKey: process.env.OPENAI_API_KEY, // EAS injects this at build time
      eas: {
        projectId: "7d390f1c-4d9b-4414-a359-2d8fd3f3ed43"
      }
    },
    runtimeVersion: { policy: "sdkVersion" },
    updates: {
      enabled: true,
      url: "https://u.expo.dev/7d390f1c-4d9b-4414-a359-2d8fd3f3ed43"
    }
  }
});
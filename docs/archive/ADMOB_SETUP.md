# 🎯 AdMob Integration Guide - Hot or Not Takes

## ✅ Current Status
- **Dependencies**: Installed `react-native-google-mobile-ads` v15.4.0
- **Configuration**: AdMob plugin configured in `app.json` with test IDs
- **Components**: Banner ads and interstitial ads implemented
- **Privacy**: GDPR consent modal created
- **Native Build**: Prebuild completed, ready for testing

## 🧪 Testing Your AdMob Integration

### Step 1: Build and Run Development Version
Since we're now using native modules, you can't use Expo Go anymore. Use development builds:

```bash
# For Android (recommended for initial testing)
npx expo run:android

# For iOS (requires Xcode and iOS simulator/device)
npx expo run:ios
```

### Step 2: What You Should See
1. **Banner Ad**: Real Google test banner at bottom of screen (replaces the "[Ad Space]" placeholder)
2. **Interstitial Ads**: Full-screen ads after every 12 swipes or when switching categories
3. **Consent Modal**: Privacy popup on first app launch asking about personalized ads
4. **Console Logs**: Ad loading/error messages in Metro bundler console

## 💰 Setting Up Real AdMob Account

### Step 1: Create AdMob Account
1. Go to [Google AdMob](https://admob.google.com/)
2. Sign in with your Google account
3. Click "Get Started" and create your AdMob account

### Step 2: Create Your App
1. In AdMob console, click "Apps" → "Add App"
2. Choose "iOS" and "Android" (create both)
3. App name: "Hot or Not Takes"
4. Choose "No" for "Is your app listed on a supported app store?" (since it's not published yet)

### Step 3: Create Ad Units
For each platform (iOS and Android), create:

**Banner Ad Unit:**
- Ad format: Banner
- Ad unit name: "Hot Takes Banner"

**Interstitial Ad Unit:**
- Ad format: Interstitial
- Ad unit name: "Hot Takes Interstitial"

### Step 4: Replace Test IDs with Real IDs
Update these files with your real AdMob IDs:

**In `app.json`:**
```json
"androidAppId": "ca-app-pub-YOUR_PUBLISHER_ID~YOUR_ANDROID_APP_ID",
"iosAppId": "ca-app-pub-YOUR_PUBLISHER_ID~YOUR_IOS_APP_ID"
```

**In `src/components/AdBanner.tsx`:**
```typescript
const adUnitId = __DEV__ 
  ? TestIds.BANNER // Keep test IDs during development
  : Platform.select({
      ios: 'ca-app-pub-YOUR_PUBLISHER_ID/YOUR_IOS_BANNER_ID',
      android: 'ca-app-pub-YOUR_PUBLISHER_ID/YOUR_ANDROID_BANNER_ID',
    }) ?? '';
```

**In `src/services/adService.ts`:**
```typescript
const interstitialAdUnitId = __DEV__ 
  ? TestIds.INTERSTITIAL // Keep test IDs during development
  : Platform.select({
      ios: 'ca-app-pub-YOUR_PUBLISHER_ID/YOUR_IOS_INTERSTITIAL_ID',
      android: 'ca-app-pub-YOUR_PUBLISHER_ID/YOUR_ANDROID_INTERSTITIAL_ID',
    }) ?? '';
```

## 📊 Revenue Optimization Tips

### 1. Ad Placement Strategy
- **Banner Ads**: Bottom of screen (non-intrusive)
- **Interstitial Ads**: After 12 swipes or category changes
- **Timing**: Not too frequent to avoid annoying users

### 2. User Experience Balance
- Current settings: Show interstitial every 12 swipes
- Adjust in `adService.ts` if needed (`SWIPES_UNTIL_AD`)
- Monitor user retention vs. ad revenue

### 3. Expected Revenue (Conservative)
```
1,000 daily active users:
• 5 sessions × 2 ads per session = 10,000 impressions/day
• $1.50 average CPM = $15/day = $450/month = $5,400/year

Scale to 10,000 users = $54,000/year potential! 💰
```

## 🔒 Privacy Compliance

### GDPR/CCPA Ready
- **Consent Modal**: Automatically shows on first launch
- **User Choice**: Personalized vs. limited ads
- **Stored Preference**: Remembers user choice
- **Compliant**: Meets European and California privacy laws

### App Store Requirements
- **Android**: Select "Yes, my app contains ads" in Google Play Console
- **iOS**: App will be reviewed for ad content compliance

## 🐛 Troubleshooting

### Common Issues:
1. **"No ads to show"**: Normal with test ads, try real device
2. **Ads not loading**: Check internet connection and console logs
3. **App crashes**: Ensure prebuild was successful
4. **Missing CocoaPods**: Only affects iOS, Android works fine

### Console Messages to Look For:
- `🎯 Banner ad loaded successfully`
- `🎬 Showing interstitial ad`
- `📊 Swipe count: X/12`

## 🚀 Next Steps After Testing

1. **Test thoroughly** with development build
2. **Create real AdMob account** and replace test IDs
3. **Build release version** for app store submission
4. **Monitor revenue** and optimize ad placement
5. **Scale user acquisition** once revenue is proven

## 💡 Pro Tips

- **Keep test IDs during development** to avoid policy violations
- **Monitor user engagement** - too many ads can hurt retention
- **Politics category** will likely have highest CPM rates! 🗳️
- **Track revenue per user** to optimize growth strategies

---

**Your app is now monetization-ready!** The engagement foundation is solid, time to turn those controversial hot takes into revenue! 💸
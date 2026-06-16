# Immigration Helper Plus Subscription Setup

Use this checklist before building the next TestFlight/App Store binary.

## Identifiers

- iOS bundle ID: `com.denizizci.immigrationhelper`
- Android package: `com.denizizci.immigrationhelper`
- RevenueCat entitlement ID: `immigration_helper_plus`
- Monthly product ID: `immigration_helper_plus_monthly`
- Yearly product ID: `immigration_helper_plus_yearly`
- Free AI questions per month: `5`

Keep these identifiers exactly the same across App Store Connect, RevenueCat, EAS, and the app code.

## App Store Connect

1. Open App Store Connect.
2. Open `Immigration Helper`.
3. Go to `Monetization` or `Features` > `Subscriptions`.
4. Create one subscription group:
   - Reference name: `Immigration Helper Plus`
5. Add the monthly auto-renewable subscription:
   - Reference name: `Immigration Helper Plus Monthly`
   - Product ID: `immigration_helper_plus_monthly`
   - Duration: `1 Month`
   - Suggested starting price: `4.99 USD`
6. Add the yearly auto-renewable subscription:
   - Reference name: `Immigration Helper Plus Yearly`
   - Product ID: `immigration_helper_plus_yearly`
   - Duration: `1 Year`
   - Suggested starting price: `39.99 USD`
7. Add localized display information for each subscription:
   - Display name: `Immigration Helper Plus`
   - Description: `Expanded AI Helper access and checklist-aware immigration planning tools.`
8. Add a 7-day free trial as an introductory offer if Apple allows it for the subscription.
9. Make sure Paid Apps Agreement, tax, and banking are complete. Apple will not sell subscriptions until those are ready.

## RevenueCat

1. Create or open the RevenueCat project for Immigration Helper.
2. Add an iOS app using bundle ID `com.denizizci.immigrationhelper`.
3. Connect App Store Connect credentials if RevenueCat asks for them.
4. Import or create products:
   - `immigration_helper_plus_monthly`
   - `immigration_helper_plus_yearly`
5. Create entitlement:
   - Identifier: `immigration_helper_plus`
6. Attach both products to the `immigration_helper_plus` entitlement.
7. Create the default offering:
   - Offering identifier: `default`
   - Monthly package: attach `immigration_helper_plus_monthly`
   - Annual package: attach `immigration_helper_plus_yearly`
8. Copy the public iOS SDK key.

## EAS Environment Variables

Set these in Expo/EAS for the `production` environment before building:

```text
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=<RevenueCat public iOS SDK key>
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=<RevenueCat public Android SDK key later>
EXPO_PUBLIC_PLUS_ENTITLEMENT_ID=immigration_helper_plus
EXPO_PUBLIC_PLUS_MONTHLY_PRODUCT_ID=immigration_helper_plus_monthly
EXPO_PUBLIC_PLUS_YEARLY_PRODUCT_ID=immigration_helper_plus_yearly
EXPO_PUBLIC_FREE_AI_QUESTION_LIMIT=5
```

The RevenueCat SDK keys are public app configuration values, not private secrets. The private OpenAI key stays server-side only.

## Build And Test

1. Run local checks:
   ```sh
   npm run lint
   npm run test:localization
   npm run test:privacy
   npx expo-doctor
   ```
2. Build iOS:
   ```sh
   eas build --platform ios --profile production
   ```
3. Install through TestFlight.
4. Test:
   - Paywall opens from Home.
   - Restore purchases opens without crashing.
   - Free user can ask general AI questions.
   - Free user is paywalled when asking AI for checklist progress.
   - Purchased sandbox user sees Plus active.
   - Checklist sharing can be enabled only when Plus is active.

## App Review Notes

Tell reviewers:

- No login is required.
- Immigration Helper Plus is optional.
- Free users can use checklists, dates, resources, reminders, privacy controls, and limited general AI questions.
- Plus unlocks expanded AI access and checklist-aware AI features.
- Restore Purchases is available from the paywall and Privacy & Safety.

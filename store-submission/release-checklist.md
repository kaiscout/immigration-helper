# Release Checklist

## Project

- [x] Expo project validates with Expo Doctor.
- [x] App has iOS bundle identifier: `com.denizizci.immigrationhelper`.
- [x] App has Android package name: `com.denizizci.immigrationhelper`.
- [x] EAS production build profile exists.
- [x] Android production build type is `app-bundle`.
- [x] App declares Android notification permission.
- [x] App declares iOS non-exempt encryption status as false.
- [x] App includes in-app privacy and safety screen.
- [x] App includes legal disclaimer and government non-affiliation language.
- [x] App includes Immigration Helper Plus paywall, restore purchases, and free AI usage gate.
- [x] Plus paywall links directly to the privacy policy and Apple standard Terms of Use.

## Before Apple Submission

- [x] Enroll in Apple Developer Program.
- [x] Create App Store Connect app record.
- [x] Host privacy policy at a public URL.
- [x] Replace placeholders in `store-submission/privacy-policy.md`.
- [x] Add privacy policy URL to App Store Connect.
- [x] Add support URL to App Store Connect.
- [x] Update App Privacy questionnaire for online AI user content.
- [ ] Capture a fresh seven-image iPhone screenshot set at `1242 x 2688` from the final TestFlight build.
- [ ] Replace the stale App Store Connect screenshots with that verified final-build set.
- [ ] Capture a real final-build paywall screenshot showing the eligibility-aware monthly trial copy and yearly option; do not use a marketing mockup.
- [x] Add age rating.
- [x] Add review notes from `store-submission/review-notes.md`.
- [ ] Create App Store Connect auto-renewable subscription products matching `store-submission/subscription-setup.md`.
- [ ] Add RevenueCat public SDK keys to the EAS production environment before the next store build.
- [ ] Build a fresh production iOS binary containing the Plus subscription changes with `eas build --platform ios --profile production`.
- [ ] Select and submit that fresh build through App Store Connect.

## Before Google Play Submission

- [ ] Enroll in Google Play Console.
- [ ] Create app record.
- [ ] Host privacy policy at a public URL.
- [ ] Add privacy policy URL to Play Console.
- [ ] Complete Data Safety form.
- [ ] Complete app content declarations.
- [ ] Add screenshots, feature graphic, icon, short description, and full description.
- [ ] Build production Android AAB with `eas build --platform android --profile production`.
- [ ] Upload first AAB manually if required by Play Console.
- [ ] If using a new personal account, run closed testing with at least 12 opted-in testers for 14 continuous days.
- [ ] Apply for production access after testing if required.

## Production AI

- [x] Deploy AI backend with the OpenAI key stored server-side.
- [ ] Deploy the hardened CasePilot backend and verify server version `2026-09-08.1` in production.
- [ ] Run `npm run eval:casepilot` against the deployed endpoint and pass all 30 languages.
- [x] Add first-use AI disclosure and explicit consent.
- [x] Keep optional checklist sharing off by default.
- [x] Allow users to withdraw AI permission.
- [x] Update public and in-app privacy disclosures.
- [x] Confirm App Store Connect privacy answers match the production build.
- [ ] Confirm Google Play Console privacy answers match the production build.

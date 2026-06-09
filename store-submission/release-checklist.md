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

## Before Apple Submission

- [ ] Enroll in Apple Developer Program.
- [ ] Create App Store Connect app record.
- [ ] Host privacy policy at a public URL.
- [ ] Replace placeholders in `store-submission/privacy-policy.md`.
- [ ] Add privacy policy URL to App Store Connect.
- [ ] Add support URL to App Store Connect.
- [ ] Complete App Privacy questionnaire.
- [ ] Upload required screenshots.
- [ ] Add age rating.
- [ ] Add review notes from `store-submission/review-notes.md`.
- [ ] Build production iOS binary with `eas build --platform ios --profile production`.
- [ ] Submit with EAS or manually through App Store Connect.

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

## Recommended First Release Choice

- [ ] Ship AI Helper in fallback/offline mode.
- [ ] Do not include any AI API key in the app binary.
- [ ] Add backend and updated disclosures only after the first stable release.

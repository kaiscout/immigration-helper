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
- [x] App includes Immigration Helper Plus paywall and restore purchases.
- [ ] Verify the server-authoritative free AI quota and Plus entitlement gate in the final native TestFlight build. Backend unit/integration coverage passes; production device acceptance remains pending.
- [x] Plus paywall links directly to the privacy policy and Apple standard Terms of Use.
- [x] CasePilot answers expose a localized, accessible report action in all 30 languages with an exact pre-send preview and device-email confirmation.

## Before Apple Submission

- [x] Enroll in Apple Developer Program.
- [x] Create App Store Connect app record.
- [x] Host privacy policy at a public URL.
- [x] Replace placeholders in `store-submission/privacy-policy.md`.
- [x] Add privacy policy URL to App Store Connect.
- [x] Add support URL to App Store Connect.
- [x] Update and publish App Privacy questionnaire for online AI user content and subscription analytics (verified October 13, 2026: Other User Content/App Functionality; Purchase History/App Functionality + Analytics; no User ID; no tracking; not linked to identity).
- [ ] Capture a fresh seven-image iPhone screenshot set at `1242 x 2688` from the final TestFlight build.
- [ ] Replace the stale App Store Connect screenshots with that verified final-build set.
- [ ] Capture a real final-build paywall screenshot showing the eligibility-aware monthly trial copy and yearly option; do not use a marketing mockup.
- [x] Complete the current age-rating questionnaire (verified October 13, 2026: calculated global rating 4+; both Social Media questions answered No).
- [x] Add current review notes from `store-submission/review-notes.md` (saved October 13, 2026 with CasePilot consent, optional Case Profile, Report response, subscriptions, and File Vault review paths).
- [x] Create App Store Connect auto-renewable subscription products matching `store-submission/subscription-setup.md` (verified October 5, 2026; final status recheck remains below).
- [x] Add RevenueCat public SDK keys and exact entitlement/product identifiers to the EAS production environment (verified October 8, 2026 without recording credential values).
- [ ] Build a fresh production iOS binary containing the Plus subscription changes with `eas build --platform ios --profile production`.
- [ ] Upload the fresh build to TestFlight. Do not select it for App Review until Deniz gives final approval.

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
- [x] Deploy the hardened CasePilot backend and verify the current `server/version.cjs` value in production (`2026-10-13.3`, commit `282696d`, verified October 13, 2026).
- [ ] Run `npm run eval:casepilot` against the deployed endpoint and pass all 30 languages. English passed the full three-turn corrected-facts/continuity chain on `2026-10-13.3`; the remaining 29-language run is not complete because the provider returned `credit_balance_exhausted`. The subsequently added $5.43 is being preserved because it is insufficient for a defensible 29-language production matrix at the current depth.
- [x] Add first-use AI disclosure and explicit consent.
- [x] Keep optional checklist sharing off by default.
- [x] Allow users to withdraw AI permission.
- [x] Update public and in-app privacy disclosures.
- [x] Confirm App Store Connect privacy answers match the production build.
- [ ] Confirm Google Play Console privacy answers match the production build.

## Release Candidate Evidence — October 13, 2026

Status terms in this section are deliberate: **implemented** means present in Dell source, **deployed** means verified on the production service, and **device-tested** means exercised in the final native TestFlight build on an iPhone.

| Area | Current result | Evidence | Remaining dependency |
| --- | --- | --- | --- |
| Source baseline | Reconciled | Release implementation is deployed through `282696d`; the local acceptance runner also has unpushed resume support at `bf13b11` so completed languages can be excluded without repeating paid calls. EAS was rechecked October 13: the latest TestFlight candidate remains Build 25 (`a0bcd692-a47f-4291-87d9-9c413b0ec119`) from `fbe9a9f`; production auto-increment is configured, so the next store candidate will be Build 26. Build 25's production URL and public client-token fingerprint were traced through the IPA and EAS production configuration. | Build 26 has not been created because the live AI acceptance gate is not yet green. |
| CasePilot authentication | Deployed; authenticated smoke verified | Expo production `EXPO_PUBLIC_AI_CLIENT_TOKEN`, the release-candidate configuration, and Render `AI_PROXY_CLIENT_TOKEN` were reconciled without printing values. After redeployment, the exact release token passed the non-JSON auth probe with `415` rather than `401`; authentication, quota enforcement, and RevenueCat verification remain enabled. | Verify the same authenticated path from Build 26 on an iPhone after the provider-quota gate passes. |
| CasePilot backend | Deployed; English acceptance passed; remaining live matrix blocked by available credit | Production `/health` reports `2026-10-13.3` from commit `282696d`, 1,951 USCIS pages, 14,964 passages, and 30 languages. The deployed planning contract now requires exact numbered action markers and the evidence-review stage retries an incoherent low-cost verdict once with the stronger generation model. English passed the full three-turn correction/continuity scenario in 147.9 seconds with four sources and 5/5 citation coverage. The next language returned OpenAI HTTP `429`, `insufficient_quota`, `credit_balance_exhausted`; later calls were not counted as passes. | Fund the provider project enough to complete the remaining 29-language production matrix (estimated approximately $45-$55 at the current generation + evidence-review depth), then resume without rerunning English. The added $5.43 does not satisfy this gate. |
| Report response | Implemented, not device-tested | All 30 locales have exact key and placeholder parity; the user reviews a single clipped response excerpt, category, optional note, and non-personal operational metadata before the device mail composer opens. Prompt/history/profile/checklists/File Vault are not silently attached. | Exercise send, cancel, saved-draft, unavailable-mail, and sensitive-identifier handling in Build 26. |
| Dependencies | Implemented and locally verified | Rechecked October 13: Expo `57.0.28`, expo-sharing `57.0.23`, and expo-splash-screen `57.0.10` match SDK 57; RevenueCat resolved to `react-native-purchases@10.13.0`; Expo Doctor 21/21, 416/416 tests, lint, TypeScript, and production iOS export all pass. A safe `npm audit fix` was applied without `--force`. | `npm audit` still reports 19 high transitive findings through Expo/Metro build tooling (`braces`/`micromatch`) and Expo code-signing tooling (`node-forge`). npm's root-level fixes require incompatible Expo/React Native downgrades; those were not applied. The affected tooling is not shipped as executable application code in the iOS bundle, but the advisories remain documented until upstream compatible releases exist. |
| Production iOS bundle | Implemented, not uploaded/device-tested | A fresh October 13 local iOS export succeeded (1,571 modules; 6,976,913-byte Hermes bundle). Boolean artifact scans confirmed the release endpoint, public client token, RevenueCat public key, exact entitlement/product IDs, localized report UI, and report address. The development Plus override symbol and private OpenAI key are absent. | Produce EAS Build 26 only after the live AI gate passes, inspect the IPA, upload to TestFlight, then install on iPhone. |
| Subscriptions | Source/EAS/RevenueCat/Apple configuration reconciled; final native device test pending | Source uses entitlement `immigration_helper_plus`, products `immigration_helper_plus_monthly` and `immigration_helper_plus_yearly`, store-provided prices, eligibility-aware monthly trial copy, yearly purchase, and Restore Purchases. RevenueCat's `default` offering maps `$rc_monthly` and `$rc_annual` to the exact products. On October 13, App Store Connect showed both products at level 1 and Prepare for Submission, monthly at the Apple-provided $4.99 base price with a seven-day introductory offer for eligible users, yearly at $39.99 without a trial, and the Paid Apps Agreement, bank, and tax records active. | Purchase, relaunch-persistence, Plus access, and Restore Purchases must still be exercised in Build 26 on an iPhone. |
| Store assets and metadata | Apple metadata saved/published; final-build assets pending | On October 13, the age-rating questionnaire was completed at 4+ with both Social Media answers set to No. App Privacy was published with User ID removed, Purchase History used for App Functionality + Analytics, Other User Content used for App Functionality, and no tracking/linkage. The 3,003-character App Review notes were saved with the exact current consent, optional profile, reporting, subscription, and File Vault paths. No build was selected and the app was not submitted for review. | Resolve the Digital Services Act trader/non-trader self-assessment with Deniz; then replace screenshots and the subscription-review image with actual Build 26 captures. |

Apple App Review has **not** been submitted and remains blocked on the unchecked production, TestFlight, device, and screenshot items above.

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
- [x] Update App Privacy questionnaire for online AI user content.
- [ ] Capture a fresh seven-image iPhone screenshot set at `1242 x 2688` from the final TestFlight build.
- [ ] Replace the stale App Store Connect screenshots with that verified final-build set.
- [ ] Capture a real final-build paywall screenshot showing the eligibility-aware monthly trial copy and yearly option; do not use a marketing mockup.
- [x] Add age rating.
- [x] Add review notes from `store-submission/review-notes.md`.
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
- [x] Deploy the hardened CasePilot backend and verify the current `server/version.cjs` value in production (`2026-10-08.7`, verified October 8, 2026).
- [ ] Run `npm run eval:casepilot` against the deployed endpoint and pass all 30 languages.
- [x] Add first-use AI disclosure and explicit consent.
- [x] Keep optional checklist sharing off by default.
- [x] Allow users to withdraw AI permission.
- [x] Update public and in-app privacy disclosures.
- [x] Confirm App Store Connect privacy answers match the production build.
- [ ] Confirm Google Play Console privacy answers match the production build.

## Release Candidate Evidence — October 8, 2026

Status terms in this section are deliberate: **implemented** means present in Dell source, **deployed** means verified on the production service, and **device-tested** means exercised in the final native TestFlight build on an iPhone.

| Area | Current result | Evidence | Remaining dependency |
| --- | --- | --- | --- |
| Source baseline | Reconciled | Dell `main` is at `116a401`; latest TestFlight remains Build 25 from `fbe9a9f`. Build 25's production URL and public client-token fingerprint were traced through the IPA and EAS production configuration. | Build 26 has not been created yet. |
| CasePilot authentication | Deployed; authenticated smoke verified | The exact release client token now passes the non-JSON auth probe with `415` rather than Build 25's `401`. A real server-counted free-tier request returned a tailored, non-degraded `200` with 1,541 characters, six official sources, and 4/4 factual sections cited. Authentication, quota enforcement, and RevenueCat verification remain enabled. | Re-run the live matrix after restoring OpenAI API quota, then verify the final native build. |
| CasePilot backend | Deployed; live matrix blocked by provider quota | Production `/health` reports `2026-10-08.7`, 1,951 USCIS pages, 14,964 passages, and 30 languages. The evidence-review false positive was fixed, one bounded incoherent-review retry was added, transient planning failures receive one retry, and generation/review use their separately configured models. The latest live response safely classified the provider's `429` as `insufficient_quota`. | Restore OpenAI API billing/quota, then obtain a fresh 30/30 result including the three-turn corrected-facts chain. Do not treat the earlier 26/30 run or quota-degraded runs as a pass. |
| Report response | Implemented, not device-tested | All 30 locales have exact key and placeholder parity; the user reviews a single clipped response excerpt, category, optional note, and non-personal operational metadata before the device mail composer opens. Prompt/history/profile/checklists/File Vault are not silently attached. | Exercise send, cancel, saved-draft, unavailable-mail, and sensitive-identifier handling in Build 26. |
| Dependencies | Implemented and locally verified | Expo patch versions match SDK 57; Expo Doctor 21/21; clean install; 413 tests; lint; TypeScript; production iOS export all passed. Patched audit roots: `brace-expansion`, `http-cache-semantics`, and `shell-quote`. | `braces@3.0.3` and `node-forge@1.4.0` remain upstream build-tool advisories with no patched npm release; neither appears in the production iOS bundle. |
| Production iOS bundle | Implemented, not uploaded/device-tested | Fresh local iOS export succeeded (1,567 modules). It contains the release endpoint, public token, exact entitlement/product IDs, and report UI; it does not contain the dev Plus override, server OpenAI key, or unresolved advisory packages. | Produce EAS Build 26, inspect the IPA, upload to TestFlight, then install on iPhone. |
| Subscriptions | Source/EAS implemented; store recheck and device test pending | Source uses entitlement `immigration_helper_plus`, products `immigration_helper_plus_monthly` and `immigration_helper_plus_yearly`, store-provided prices, eligibility-aware monthly trial copy, yearly purchase, and Restore Purchases. | Recheck App Store Connect/RevenueCat/agreement status, then purchase, relaunch-persistence, and restore-test Build 26 on iPhone. |
| Store assets and metadata | Updated documents and public pages; App Store Connect recheck pending | The October 8 privacy policy and support page are live and describe the chatbot report path; review notes and the privacy-answer worksheet match the implementation. | Sign in to App Store Connect, reconcile the live metadata/privacy answers, and replace screenshots/review image with actual Build 26 captures. |

Apple App Review has **not** been submitted and remains blocked on the unchecked production, TestFlight, device, and screenshot items above.

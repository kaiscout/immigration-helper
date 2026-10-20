# Immigration Helper · CasePilot AI

A privacy-first, multilingual React Native product that helps people organize common U.S. immigration workflows and ask general questions grounded in official sources.

CasePilot is the in-app AI experience inside **Immigration Helper**. The product combines guided checklists, local reminders, a private on-device file vault, and official USCIS resources in one mobile-first workspace. It is built by [Deniz Izci](https://denizci.dev).

[Portfolio](https://denizci.dev) · [Support](https://kaiscout.github.io/immigration-helper/support.html) · [Privacy policy](https://kaiscout.github.io/immigration-helper/privacy-policy.html)

## Review the project

Start with the screenshots below, then follow a complete request through [the mobile advisor](screens/AIAdvisorScreen.js), [the answer service](server/ai/answer.mjs), and [the evidence reviewer](server/ai/evidence-review.mjs). [Automated checks](https://github.com/kaiscout/immigration-helper/actions/workflows/ci.yml) exercise the application without production credentials or paid AI requests.

| Engineering focus | Source to inspect |
| --- | --- |
| Application composition and navigation | [App.js](App.js), [screens/](screens/) |
| Grounded answers and evidence validation | [server/ai/](server/ai/), [server/uscis/](server/uscis/) |
| Consent, identifier filtering, and private files | [data/aiConsent.js](data/aiConsent.js), [data/sensitiveIdentifiers.js](data/sensitiveIdentifiers.js), [data/fileVaultModel.mjs](data/fileVaultModel.mjs) |
| Localization and subscription decisions | [i18n/](i18n/), [data/subscriptionCore.mjs](data/subscriptionCore.mjs) |
| Behavioral verification | [tests/](tests/) |

## Product tour

| Home and guided workflows | CasePilot AI | Private File Vault |
| --- | --- | --- |
| ![Immigration Helper home screen with guided process cards](store-submission/screenshots/iphone-6.5/app-store-current/01-home.png) | ![CasePilot AI screen with checklist summaries and suggested questions](store-submission/screenshots/iphone-6.5/app-store-current/02-ai-helper.png) | ![File Vault screen with local document categories and status labels](store-submission/screenshots/iphone-6.5/app-store-current/04-file-vault.png) |

## What the product does

- Guides users through structured checklists for TPS renewal, work authorization (EAD), and travel authorization.
- Lets users save checklist progress and target dates, then schedule local notification reminders.
- Answers general immigration questions through CasePilot with citations to official sources; it does not decide eligibility or provide legal advice.
- Grounds answers with live search restricted to official U.S. immigration agencies and a packaged corpus built from 1,951 USCIS pages and more than 14,000 searchable passages.
- Supports 30 interface languages, with localized AI routing, fallback copy, and translated workflow content.
- Keeps imported PDFs and images in the app's private on-device storage, with categories, review statuses, private notes, and explicit user-controlled sharing.
- Provides direct links to official forms, fees, case status, legal-help, and scam-prevention resources.
- Supports optional Plus subscriptions and entitlement checks through RevenueCat.

## Architecture

```text
Expo / React Native client
├── Guided flows, reminders, localization, and subscription UI
├── AsyncStorage for preferences, consent, and checklist state
└── Expo FileSystem for private local File Vault content
             │ explicit consent + HTTPS
             ▼
Node.js AI proxy on Render
├── Client-token validation, request-size controls, and rate limiting
├── Packaged USCIS corpus for local retrieval and degraded fallback
└── OpenAI Responses API with official-domain web search
```

The OpenAI API key stays on the server. The client sends online AI requests only after a first-use disclosure and consent; saved checklist context is a separate option that is off by default.

## Technology

| Layer | Tools |
| --- | --- |
| Client | React Native, Expo, React, JavaScript, TypeScript |
| Navigation and UI | React Navigation, Expo Vector Icons, React Native Reanimated |
| Local data | AsyncStorage, Expo FileSystem, Expo Document Picker, Expo Notifications |
| AI and retrieval | Node.js, OpenAI Responses API, official-domain web search, packaged USCIS corpus |
| Localization | i18next, react-i18next, 30 locale resources |
| Subscriptions | RevenueCat (`react-native-purchases`) |
| Delivery | EAS, TestFlight, Docker, Render |
| Quality | Node test runner, ESLint, Expo Doctor |

## Engineering safeguards

- Requires affirmative consent before enabling online CasePilot requests.
- Keeps optional checklist sharing disabled until the user turns it on.
- Rejects common sensitive identifier patterns before an AI request is sent.
- Stores File Vault documents locally and never uploads them to CasePilot, Render, OpenAI, RevenueCat, or a government agency.
- Keeps private OpenAI credentials out of the mobile binary and supports paired client-token checks on the proxy.
- Applies server-side request-size limits, per-client rate limiting, official-domain filtering, and source validation.
- Falls back to the packaged USCIS corpus when live AI generation is unavailable.

## Testing

Coverage focuses on AI grounding and citation behavior, multilingual intent routing, sensitive-data rejection, privacy consent, File Vault validation, subscription state, localized content parity, and USCIS service configuration. The test runner and CI report the current counts, rather than a separately maintained number in this document.

Run the main checks before a build:

```bash
npm run verify
npm run build:check
```

## Run locally

Use Node.js 24 and npm. The mobile application targets Expo SDK 57 and React Native 0.86; exact versions are recorded in [package.json](package.json) and the lockfile.

1. Install the locked dependencies.

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env`. For local corpus-backed operation, set the same development token in `AI_PROXY_CLIENT_TOKEN` and `EXPO_PUBLIC_AI_CLIENT_TOKEN`. Add `OPENAI_API_KEY` only if you want live model generation; never prefix that private key with `EXPO_PUBLIC_`.

3. Start the Node service and Expo web client together.

   ```bash
   npm run web
   ```

For native development, run `npm start` with a compatible SDK 57 development client. Native purchase, restore, notification, and device-permission behavior requires a real device and the appropriate development or store build. The checked-in [release checklist](store-submission/release-checklist.md) distinguishes source verification from remaining store and device checks.

`build:check` produces an unsigned iOS JavaScript/assets export in an ignored local directory. It verifies bundling; it does not sign an app, submit a store build, or exercise live billing or AI providers.

## Repository guide

The active entry point is `index.js` → `App.js` → `screens/`. Navigation uses React Navigation. The Expo Router starter screens are not part of this application.

- `components/` — shared mobile controls.
- `data/` — workflow definitions, client services, privacy rules, and testable domain logic.
- `server/` — HTTP boundary, AI/evidence services, official-source retrieval, and isolated production runtime dependencies.
- `i18n/` — interface resources for all supported languages.
- `scripts/` — development, corpus maintenance, and explicitly invoked evaluation tools.
- `docs/` — technical guides, release history, and the GitHub Pages support/privacy documents.
- `store-submission/` — native release checklist, review materials, and product screenshots.
- `tests/` — deterministic unit and integration checks using synthetic inputs and mocked providers.

See the [documentation index](docs/README.md) for development, deployment, and release references. Local environment files, generated exports, and personal working output stay outside version control.

## Privacy and scope

Immigration Helper is independent and is not affiliated with USCIS, DHS, or any government agency. It provides organization tools and general information only—not legal advice, eligibility decisions, filing guarantees, or a substitute for current official instructions and qualified legal help.

Users should not submit A-Numbers, USCIS receipt numbers, passport numbers, Social Security numbers, payment details, or private legal facts to CasePilot. See the published [privacy policy](https://kaiscout.github.io/immigration-helper/privacy-policy.html) for the complete data-handling explanation.

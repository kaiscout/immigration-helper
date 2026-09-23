# September 23 release verification

Status: **not ready for App Review**. Do not treat a successful build, HTTP 200,
or passing unit tests as proof of complete AI or subscription readiness.

## Completed

- SDK 57 native build 23 completed; TestFlight upload was queued.
- Build 24 was started with accurate read-only CasePilot wording in all 30 languages.
- Render version `2026-09-23.2` is live, with server-side AI credentials,
  independent answer review, source provenance checks, and safe rejection codes.
- Latest full-suite baseline: 334 tests passed. Later targeted checks cover
  diagnostic metadata, localized copy, and Danish word-boundary repair.
- Live English three-turn test passed, including corrected nationality,
  residence, and investment continuity. Italian and Arabic passed targeted tests.
- The other-language run passed tr/es/zh/hi/fr/ru/pt/bg/nl/et/fi/de/sv.
- Public privacy and support pages returned HTTP 200.

## Outstanding

- Live-test API returned `credit_balance_exhausted`; Codex credits do not fund
  the app's API calls. Stop paid tests until API billing is restored.
- Bengali review timed out. Croatian and Czech responses failed valid source
  provenance checks. Danish hit a false positive (fixed offline, not retested live).
- Greek, Hungarian, Irish, Latvian, Lithuanian, Maltese, Polish, Romanian,
  Slovak, and Slovenian remain unverified because API billing blocked the run.
- The first deployed planning smoke failed its final runtime safety check.
  Do not claim the production smoke passed; investigate after billing is restored.
- Source-constrained review and shorter initial answers are being prepared
  offline to reduce unsupported citations, duplicate research, and latency.
  These changes require fresh live verification before deployment.
- Confirm the final native build on the actual iPhone: real sandbox purchase,
  restore, entitlement access, absence of the development switch, notifications,
  and File Vault import/share. Expo Go cannot establish purchase readiness.
- Check current App Store Connect subscription/version metadata and required
  agreements. App Store Connect sign-in has been requested from the owner.
- Replace stale store screenshots with the final native UI and real paywall.

## Artifacts

- EAS build 23: `2d89b1f1-e0dc-440a-8901-5c22d6c1d644`
- Its upload: `bdf3137c-b2d9-4483-b3b7-caeac448102e`
- EAS build 24: `89f416f9-fe45-4d98-831f-7dffa6ebdfb8`
- Synthetic reports (ignored, no authorization headers):
  `.expo/casepilot-live-1790174444735.json`,
  `.expo/casepilot-live-1790174928810.json`,
  `.expo/casepilot-live-1790175146232.json`.

The Pi was used for staging, tests, and JS export until SSH was lost. Source
remains on the Dell. The isolated Pi staging directory is incomplete after the
interrupted transfer and must be hash-resynchronized before any later reuse.

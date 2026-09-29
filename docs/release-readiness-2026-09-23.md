# September 23 release verification

Status: **not ready for App Review**. Do not treat a successful build, HTTP 200,
or passing unit tests as proof of complete AI or subscription readiness.

## Completed

- SDK 57 native builds 23 and 24 completed.
- Build 24, with accurate read-only CasePilot wording in all 30 languages, was
  uploaded to TestFlight and then explicitly expired on September 29 before any
  App Review submission. The obsolete build 23 upload was canceled; neither
  build is approved for release.
- Render version `2026-09-23.2` is live, with server-side AI credentials,
  independent answer review, source provenance checks, and safe rejection codes.
- Latest full-suite baseline: 355 tests passed, with lint passing, including
  diagnostic metadata, localized copy, Danish word-boundary repair, constrained
  evidence provenance, no-charge/no-cache verification-unavailable replies,
  Devanagari sentence boundaries, reviewed conditional-status wording, and the
  Hindi, Finnish, and Maltese live-regression fixtures described below.
- API billing was restored and verified with a minimal successful request.
- Revision `.3` targeted live evaluation passed en (three-turn continuity),
  bn/hr/cs/da. Fresh targeted live evaluation also passed each of the seven
  previously failing languages: tr/es/hi/fr/de/lv/lt.
- After billing was restored, a fresh full run exposed conservative false
  positives in otherwise reviewed Hindi, Finnish, and Maltese answers. Exact
  regression fixtures were added without relaxing the genuine guarantee or
  invented-status controls. Fresh targeted runs then passed all three.
- Final live acceptance report `casepilot-live-1790661969596.json` passed all
  30 languages. English passed its three-turn nationality/residence correction
  and investment-continuity scenario. Every result was non-degraded, retained
  the user's facts, passed runtime safety and language checks, and had complete
  independently reviewed official-source coverage.
- App Store Connect sign-in succeeded. The Plus group contains the expected
  monthly and yearly product IDs, both currently Prepare for Submission.
  Monthly pricing includes a first-week introductory offer in 175 storefronts.
- Live English three-turn test passed, including corrected nationality,
  residence, and investment continuity. Italian and Arabic passed targeted tests.
- The other-language run passed tr/es/zh/hi/fr/ru/pt/bg/nl/et/fi/de/sv.
- Public privacy and support pages returned HTTP 200.

## Outstanding

- The verified `.3` backend changes are still local. Deploy them to Render only
  after owner approval, then run a fresh authenticated production smoke; do not
  treat the local live acceptance as proof that the older deployed `.2` service
  contains these fixes.
- Confirm the final native build on the actual iPhone: real sandbox purchase,
  restore, entitlement access, absence of the development switch, notifications,
  and File Vault import/share. Expo Go cannot establish purchase readiness.
- Finish App Store Connect subscription/version metadata and required
  agreement checks. The owner has signed in; no agreement has been accepted.
- Replace stale store screenshots with the final native UI and real paywall.

## Artifacts

- EAS build 23: `2d89b1f1-e0dc-440a-8901-5c22d6c1d644`
- Its canceled upload: `bdf3137c-b2d9-4483-b3b7-caeac448102e`
- EAS build 24: `89f416f9-fe45-4d98-831f-7dffa6ebdfb8`
- Build 24 upload: `a17a19a9-56c3-4946-b9fe-5f2fd2a6e8a8`
- Synthetic reports (ignored, no authorization headers):
  `.expo/casepilot-live-1790174444735.json`,
  `.expo/casepilot-live-1790174928810.json`,
  `.expo/casepilot-live-1790175146232.json`,
  `.expo/casepilot-live-1790176722112.json`,
  `.expo/casepilot-live-1790176954467.json`,
  `.expo/casepilot-live-1790660536229.json`,
  `.expo/casepilot-live-1790661679136.json`,
  `.expo/casepilot-live-1790661877268.json`,
  `.expo/casepilot-live-1790661969596.json`.

The Pi was used for the initial hash-verified snapshot, 352-test baseline, lint,
and first full live run until SSH was lost. The Dell fallback ran the repaired
355-test suite, targeted retests, and final 30-language live acceptance. Source
remains on the Dell. The isolated Pi staging directory may contain a partial
later file transfer and must be hash-resynchronized before any future reuse.

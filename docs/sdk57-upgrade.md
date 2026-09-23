# SDK 57 upgrade — September 23, 2026

The app now targets Expo 57.0.24, React Native 0.86.3, and React 19.2.3,
matching the SDK 57 Expo Go installed on the test iPhone. Native dependency
versions follow Expo's bundled dependency map. Node 22.13 or newer is required.

## Changes

- Await the File Vault's asynchronous file copy before saving its metadata.
- Keep the floating Free/Plus switch development-only and clamp its displayed
  position without mutating refs during render.
- Document narrowly scoped lint exceptions for existing async hydration and
  event-only handlers; do not disable the new lint rules globally.
- Remove the obsolete SDK 54 EAS image pin so EAS can select a compatible image.
- Declare the QR launcher dependency explicitly instead of depending on Expo
  CLI's former transitive dependency.

## Phone preview

Run `node scripts/phone-preview.cjs --tunnel`.
The QR page is `http://127.0.0.1:8082`. It exposes the Expo Go QR only after
the local server responds and the manifest reports SDK 57 and the expected
tunnel host. The launcher manages Expo's tunnel separately and runs Metro
with `--localhost`, keeping both local servers on loopback.
The tunnel lets the phone use Wi-Fi or cellular. Keep the Dell awake.
The launcher requires `--tunnel`; it has no automatic LAN fallback.
Do not run two preview servers on the same ports.

### Preview AI authentication

The launcher now loads Expo's development environment precedence, including
the ignored `.env.local`, and keeps `EXPO_PUBLIC_AI_PROXY_URL` paired with
`EXPO_PUBLIC_AI_CLIENT_TOKEN`. It no longer replaces just the endpoint while
retaining an unrelated local-server token. Existing shell variables take priority.
Before Metro starts, an authenticated empty-question request must return the
expected validation error; this checks access without generating a paid answer.
Credentials are never printed. Do not commit environment files.

On September 23, the EAS production environment was restored to the previously
absent `.env.local`; Render accepted its client token. Live synthetic requests
then returned HTTP 200, but the deployed backend still reported
`degraded_reason: citation_gate`. Authentication recovery is not evidence that
generated-answer quality or the 30-language release gate has passed.

The Free/Plus switch simulates access; it does not test Apple purchases.
Real subscription purchase/restore and notifications require native-build
testing. The existing code intentionally disables notifications in Expo Go.

## Release boundary

An SDK upgrade requires a new native build. Do not send this SDK 57 JavaScript
as an update to the old SDK 54 TestFlight binary. No EAS build, store submission,
or backend deployment was performed as part of this upgrade.

A source snapshot from before this upgrade is saved locally at
`.expo/sdk54-before-upgrade.tgz` (ignored by Git; no credentials included).

## Subsequent release work

Later on September 23, EAS build 23 completed and was queued for TestFlight
upload. Build 24 includes corrected CasePilot capability and error copy in
all 30 languages. Backend versions 2026-09-23.1 and 2026-09-23.2 were deployed
separately to Render. None of these actions submitted the app for App Review.
See `release-readiness-2026-09-23.md` for the outstanding release gates.

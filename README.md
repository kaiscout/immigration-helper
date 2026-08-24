# Immigration Helper

## Fast setup on this Dell

The project uses Expo cloud services for iOS builds, so Xcode and a Mac are not required.

Install dependencies after a fresh clone:

```powershell
npm ci
```

Keep `.env` local and never commit it. The required variable names are documented in `.env.example`.

## Test in Chrome

Run one command:

```powershell
npm run web
```

This starts both the local USCIS AI service and the Expo web app, then opens the app in the browser. Stop both with `Ctrl+C`.

## Test on iPhone

Use TestFlight for release and subscription testing. A TestFlight build runs real native code and Apple handles its purchases in the sandbox, so no real charge is made.

`npm start` remains available for LAN development with an SDK 54-compatible Expo Go or development client. Keep the Dell and iPhone on the same Wi-Fi and scan the QR page that opens. Expo Go cannot test real StoreKit subscriptions.

## Validate before a build

```powershell
npm test
npm run lint
npx expo-doctor
```

## Build and submit from Windows

Authenticate once, then inspect the linked project:

```powershell
eas login
eas whoami
eas project:info
eas env:list --environment production
```

After App Store Connect subscriptions, RevenueCat, and the production EAS variables are verified:

```powershell
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Store metadata and the remaining release steps are in `store-submission/`.

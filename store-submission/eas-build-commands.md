# EAS Build Commands

Install and authenticate:

```bash
npm install --global eas-cli
eas login
```

Initialize EAS if the project has not been linked before:

```bash
eas init
```

Build for internal device testing:

```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

Build production binaries:

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

Submit after store records are created:

```bash
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

Notes:

- Google Play often requires the first Android App Bundle upload to be done manually before API-based submit works.
- Google Play new personal accounts may require closed testing before production access.
- Do not ship an AI API key inside the mobile app binary.

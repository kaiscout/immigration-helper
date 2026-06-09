# Google Play Data Safety Answers

Use this as the starting point for Play Console. Keep it consistent with the final production build and privacy policy.

## If You Ship Without A Production AI Backend/API Key

### Does your app collect or share any required user data types?

Suggested answer: No.

Reasoning:

- Checklist dates, progress, language preference, onboarding state, and reminders are stored locally on the user's device.
- The AI Helper can read and update this local checklist data at the user's request.
- No account system.
- No analytics SDK.
- No advertising SDK.
- No developer-operated server receives local checklist data.

### Is all user data collected encrypted in transit?

If no data is collected by your servers, answer according to Play Console's available flow. External links use HTTPS. If support email is listed, support messages happen outside the app.

### Can users request that data be deleted?

For local app data: users can delete the app or clear app data. If users contact support, they can request deletion of support communications where applicable.

## If You Enable Production AI Calls

You likely collect user-provided text/content and relevant checklist context for App Functionality when users submit AI questions.

Likely declarations:

- Data type: App activity or User content, depending on Play Console's current options.
- Purpose: App functionality.
- Shared: Yes if sent to a third-party AI service provider for processing.
- Required: No if AI questions are optional.
- Encrypted in transit: Yes, if sent over HTTPS/TLS.
- Deletion: Explain how users can request deletion, and whether third-party provider retention applies.

## Permissions

Notifications:

- Android permission: POST_NOTIFICATIONS
- Purpose: user-selected reminders.

The app should not request contacts, location, camera, microphone, photos, or SMS permissions.

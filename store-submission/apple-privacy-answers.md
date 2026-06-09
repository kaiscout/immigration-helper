# Apple App Privacy Answers

Use this as the starting point for App Store Connect. Keep it consistent with the final production build and privacy policy.

## If You Ship Without A Production AI Backend/API Key

Suggested privacy label:

- Data Collected: No
- Data Used to Track You: No
- Data Linked to You: No

Reasoning:

- Checklist dates, progress, language preference, onboarding state, and reminders are stored locally on the device.
- The AI Helper can read and update this local checklist data at the user's request.
- No account system.
- No analytics SDK.
- No advertising SDK.
- No tracking.
- No developer-operated server receives local checklist data.

Still provide a privacy policy URL because Apple requires it.

## If You Enable Production AI Calls

You may need to disclose user-provided content and relevant app activity/checklist context depending on the implementation.

Likely data type:

- Other User Content or Other Data, depending on App Store Connect's current form options.

Purpose:

- App Functionality.

Linked to user:

- No, if you do not require accounts and do not attach identifiers.

Tracking:

- No, if not used for advertising/tracking.

Notes:

- Do not ship an OpenAI or other AI API key inside the app binary.
- Use a backend if you enable production AI.
- Update privacy policy and in-app disclosure before submitting an AI-backed build.
- If checklist context is sent to an AI backend, disclose that context according to App Store Connect's available categories.

## Permission Notes

Notifications:

- Permission is requested only after the user chooses to schedule or test a reminder.
- Notifications are used for app functionality.

External Links:

- USCIS and legal-help links open outside the app.

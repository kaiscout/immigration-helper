# Apple App Privacy Answers

Use this as the starting point for App Store Connect. Keep it consistent with the final production build and privacy policy.

## Production Build Answers

The production build uses an online AI backend. Do not answer "Data Not Collected."

Data type:

- User Content → Other User Content.

What this includes:

- Questions submitted to the AI Helper.
- Recent messages from the current AI conversation.
- Saved checklist dates and completed steps only when the user enables optional checklist sharing.

Purpose:

- App Functionality.

Linked to user:

- No. The app has no account system and does not attach a profile, advertising identifier, or user identity to AI requests.

Tracking:

- No. The data is not used for advertising, data-broker profiling, or cross-app tracking.

Collection status:

- Collected: Yes, because this content leaves the device and OpenAI may retain API content in abuse-monitoring logs for up to 30 days.
- Optional: Yes. The user can use the checklist, resources, and reminders without granting online AI permission.

Checklist sharing:

- Off by default.
- Enabled only through a separate switch in the AI disclosure.
- Can be disabled at any time in Privacy & Safety.

Other technical data:

- Render and OpenAI may process IP address, timestamps, and security or diagnostic metadata as service providers.
- Review App Store Connect's current "Other Data" and diagnostics questions and disclose any category its definitions require for this provider processing.

Notes:

- The OpenAI API key remains only in Render.
- The app presents a first-use disclosure before any online AI content is sent.
- Users can withdraw permission in Privacy & Safety.
- The app uses HTTPS for AI requests.
- No analytics, advertising, tracking, or third-party sign-in is included.

## Permission Notes

Notifications:

- Permission is requested only after the user chooses to schedule or test a reminder.
- Notifications are used for app functionality.

External Links:

- USCIS and legal-help links open outside the app.

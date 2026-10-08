# Apple App Privacy Answers

Use this as the starting point for App Store Connect. Keep it consistent with the final production build and privacy policy.

## Production Build Answers

The production build uses an online AI backend. Do not answer "Data Not Collected."

Data type:

- User Content → Other User Content.
- Purchases → Purchase History. This disclosure is required when using RevenueCat.
- Do not select User ID solely for RevenueCat: this app does not pass a custom user ID, so RevenueCat generates an anonymous app user ID. Reassess this answer if account login or a custom identifiable ID is added later.
- RevenueCat's current guidance says its SDK does not require a Diagnostics disclosure by itself. Reassess if crash or performance collection is added later.

What this includes:

- Questions submitted to CasePilot.
- Recent messages from the current AI conversation.
- Optional Case Profile details saved by the user, including preferred name, citizenship, country of residence, immigration situation, and immigration goal.
- Saved checklist dates and completed steps only when the user enables optional checklist sharing.
- A selected CasePilot response excerpt, report category, and optional note only when the user reviews and sends a response report through their email app.
- An anonymous RevenueCat app user identifier and a random request identifier used for entitlement checks, monthly quota enforcement, and duplicate-request prevention.

Purpose:

- Other User Content is used for App Functionality.
- Purchase History is used for both Analytics and App Functionality. RevenueCat uses it for customer history/charts and for receipt validation, fraud prevention, entitlements, and purchase restoration.

Linked to user:

- No. The app has no account system and does not attach an advertising identifier or known account identity to AI requests. An optional self-reported Case Profile and RevenueCat's anonymous app user ID may accompany a request for personalization and access control, but they are not tied to an Immigration Helper account.

Tracking:

- No. The data is not used for advertising, data-broker profiling, or cross-app tracking.

Collection status:

- Collected: Yes, because this content leaves the device and OpenAI may retain API content in abuse-monitoring logs for up to 30 days.
- Optional: Yes. The user can use the checklist, resources, and reminders without granting online AI permission.

File Vault:

- Imported PDFs and images, File Vault categories, statuses, and private notes stay in the app's private on-device storage and are not collected by Immigration Helper.
- A file is exported only when the user deliberately opens the system share sheet. Device or cloud backup behavior is controlled by the user's operating-system settings.

Checklist sharing:

- Off by default.
- Enabled only through a separate switch in the AI disclosure.
- Can be disabled at any time in Privacy & Safety.

Other technical data:

- Render and OpenAI may process IP address, timestamps, and security or diagnostic metadata as service providers.
- The backend temporarily stores pseudonymous hashes, quota and rate-limit counters, request-deduplication records, and short-lived entitlement-verification results; it does not intentionally store question or answer text in an application database.
- CasePilot response reports are user-initiated email messages. The app shows the exact report first and does not silently attach the user's prompt, earlier conversation, Case Profile, checklists, or File Vault. The user's email app or email provider processes the draft and contact details. Developer-received reports are normally retained no longer than 12 months unless security, legal, or recordkeeping needs require longer.
- RevenueCat may process purchase history, product and transaction identifiers, subscription and entitlement status, timestamps, an anonymous app-user identifier, and device/app information to operate Immigration Helper Plus, prevent fraud, restore purchases, and provide subscription analytics.
- Re-check these answers against RevenueCat's current Apple App Privacy guidance whenever the SDK configuration or data integrations change.

Notes:

- The OpenAI API key remains only in Render.
- The app presents a first-use disclosure before any online AI content is sent.
- Users can withdraw permission in Privacy & Safety.
- The app uses HTTPS for AI requests.
- No analytics, advertising, tracking, or third-party sign-in is included.
- No subscription or purchase data is used for advertising or cross-app tracking.

## Permission Notes

Notifications:

- Permission is requested only after the user chooses to schedule or test a reminder.
- Notifications are used for app functionality.

External Links:

- USCIS and legal-help links open outside the app.

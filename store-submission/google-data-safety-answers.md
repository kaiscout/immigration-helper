# Google Play Data Safety Answers

Use this as the starting point for Play Console. Keep it consistent with the final production build and privacy policy.

## Production Build Answers

The production build uses an online AI backend and collects user-provided content when the user chooses to submit an AI question.

Declarations:

- Data type: User content → Other user-generated content. Use App activity only if the current Play definition specifically requires the AI conversation or checklist actions there.
- Data type: Financial info → Purchase history, if Google Play asks about RevenueCat processing subscription status, product identifiers, or transaction history.
- Data type: Device or other IDs, only if Play's current definitions require disclosure for RevenueCat app-user IDs or device identifiers used to manage entitlements.
- Purpose: App functionality.
- Collected: Yes.
- Required: No. Online AI is optional.
- Encrypted in transit: Yes, using HTTPS/TLS.
- Linked to identity: No account or profile is attached.
- Used for advertising or tracking: No.
- Temporarily processed: Do not select this exemption because OpenAI may retain API content for abuse monitoring for up to 30 days.

Data sent:

- Submitted AI question.
- Recent current-session conversation.
- Checklist dates and completed steps only when optional checklist sharing is enabled.

Sharing:

- Render and OpenAI process the data as service providers for app functionality.
- RevenueCat processes subscription and entitlement data as a service provider for purchases, subscription status, and restore-purchase functionality.
- Apply Google Play's current service-provider exemption when answering the "shared" question if the provider relationship meets its definition; otherwise declare the transfer.

Deletion and controls:

- Users can disable checklist sharing or withdraw online AI permission in Privacy & Safety.
- Local data can be removed by clearing app data or deleting the app.
- Users can contact admin@immigrationhelper.org about developer-controlled support communications.
- Content already processed by OpenAI may remain for its applicable retention period.
- Subscription data is managed through the app stores and RevenueCat; users can manage or cancel subscriptions through their store account.

## Permissions

Notifications:

- Android permission: POST_NOTIFICATIONS
- Purpose: user-selected reminders.

The app should not request contacts, location, camera, microphone, photos, or SMS permissions.

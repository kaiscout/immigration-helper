Immigration Helper project notes

Install and run:
npm install
npm start

`npm start` now starts both Expo and the local USCIS knowledge server. If port
8081 belongs to another project, it automatically selects the next available
port without stopping the other project or asking an interactive question.

The app includes 30 interface languages. AI answers use the selected app
language and cite supported official U.S. government sources directly beneath
the relevant response sections.

Local AI setup:
The AI Helper can search the packaged USCIS corpus without an API key. This
fallback returns the matching official passage and USCIS source.

For custom, fully generated, human-like answers in every supported language:
1. Create a new OpenAI API key at https://platform.openai.com/api-keys
2. Copy .env.example to .env
3. Add the key as the server-only `OPENAI_API_KEY` value.
4. Run:
   npm start

Or use the secure guided setup, which validates the key and writes the ignored
`.env` file without displaying the key:
npm run setup:ai-key

Important: Never put a private OpenAI key in an `EXPO_PUBLIC_` variable. The
production app calls the Render service configured in `render.yaml`; Render
stores the private OpenAI key. EAS stores only the public proxy URL and the app
client token used for basic endpoint abuse deterrence.

Plus subscription setup:
Immigration Helper Plus uses RevenueCat with auto-renewable store products.
The app code expects these default identifiers:
- Entitlement: immigration_helper_plus
- Monthly product: immigration_helper_plus_monthly
- Yearly product: immigration_helper_plus_yearly

Before the next production build, create matching subscriptions in App Store
Connect and RevenueCat, then add the public RevenueCat SDK key and product
identifier values to EAS environment variables. The app stays usable in Expo Go,
but purchases only work in a store or TestFlight build that includes the native
RevenueCat module.

Immigration Helper upgrade files

Replace these files in your project with the matching files in this zip:

App.js
package.json
constants/theme.js
screens/HomeScreen.js
screens/FlowScreen.js
screens/RemindersScreen.js
screens/AIAdvisorScreen.js
i18n/en.json
i18n/tr.json
i18n/es.json

Then run:
npm install
npm start

Optional AI setup:
For quick local Expo Go testing:
1. Create a new OpenAI API key at https://platform.openai.com/api-keys
2. Copy .env.example to .env
3. Add your key:
   EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
4. Run:
   npm run check:ai
   npm start

Important: EXPO_PUBLIC variables are visible in a client app. For a real public App Store or Play Store build, use a small backend endpoint instead of putting your API key in the app, then set:
EXPO_PUBLIC_AI_PROXY_URL=https://your-backend.example.com/openai

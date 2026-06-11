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

`npm start` now starts both Expo and the local USCIS knowledge server. If port
8081 belongs to another project, it automatically selects the next available
port without stopping the other project or asking an interactive question.

AI setup:
The AI Helper can search the packaged USCIS corpus without an API key. This
fallback returns the matching official passage and USCIS source.

For custom, fully generated, human-like answers in every supported language:
1. Create a new OpenAI API key at https://platform.openai.com/api-keys
2. Copy .env.example to .env
3. Add the key as a server-only secret:
   OPENAI_API_KEY=your_openai_api_key_here
4. Run:
   npm start

Important: Never put a private key in EXPO_PUBLIC_OPENAI_API_KEY for a public
build. Deploy `server/index.mjs` to a backend host with OPENAI_API_KEY stored
there, then set:
EXPO_PUBLIC_AI_PROXY_URL=https://your-backend.example.com/api/ai

# Production AI Deployment

The production mobile app calls a Render-hosted Node service. The OpenAI API key
must exist only in Render and must never use an `EXPO_PUBLIC_` prefix.

## Render

1. Connect the GitHub repository to Render as a Blueprint.
2. Render reads `render.yaml` and creates `immigration-helper-ai`.
3. Set `OPENAI_API_KEY` to the active project key.
4. Generate an app access token with `openssl rand -hex 32`, then set the same
   value as `AI_PROXY_CLIENT_TOKEN` in Render and
   `EXPO_PUBLIC_AI_CLIENT_TOKEN` in EAS.
5. Leave `USCIS_VECTOR_STORE_ID` blank unless a vector store is configured.
6. Deploy and verify:

   ```text
   https://immigration-helper-ai.onrender.com/health
   ```

The configured Starter service is always on and currently costs $7 per month.

## Expo production environment

Set the public proxy URL in the EAS `production` environment:

```bash
npx eas-cli@latest env:create production \
  --name EXPO_PUBLIC_AI_PROXY_URL \
  --value https://immigration-helper-ai.onrender.com/api/ai \
  --visibility plaintext

npx eas-cli@latest env:create production \
  --name EXPO_PUBLIC_AI_CLIENT_TOKEN \
  --value YOUR_GENERATED_APP_ACCESS_TOKEN \
  --visibility sensitive
```

`EXPO_PUBLIC_AI_PROXY_URL` is intentionally public. It identifies the app's
backend endpoint and contains no secret. The client token is embedded in the
app and only deters casual endpoint abuse. `OPENAI_API_KEY` stays in Render and
is the only credential that authorizes OpenAI billing.

Builds made with the production EAS profile use the production environment:

```bash
npx eas-cli@latest build --platform ios --profile production
```

# USCIS AI Knowledge Service

The app now supports a server-side USCIS information assistant with two official-source layers:

1. Live OpenAI web search restricted to official U.S. immigration agencies.
2. A packaged local corpus produced from the current USCIS sitemap and searched passage by passage.

The live search keeps answers current. The local corpus provides additional retrieval context and can later be uploaded to an OpenAI vector store.

## 1. Configure the server

Create a local `.env` file and set:

```bash
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-5.4-mini
AI_PROXY_CLIENT_TOKEN=your_generated_app_access_token
REQUIRE_AI_GENERATION=true
REQUIRE_CLIENT_TOKEN=true
PORT=8787
```

Never use `OPENAI_API_KEY` as an `EXPO_PUBLIC_` variable in a published app.

## 2. Review the USCIS crawl plan

```bash
npm run uscis:plan
```

The crawler reads USCIS `robots.txt` and the official sitemap, excludes archives, assets, PDFs, Spanish duplicates, employer I-9 material, and unrelated site pages, then creates `server/data/uscis-manifest.json`.

USCIS currently requests a 10-second crawl delay. A complete first crawl can therefore take several hours. The crawler saves after every page and resumes safely:

```bash
npm run uscis:scrape
```

For a small initial cache:

```bash
npm run uscis:scrape -- --limit=20
```

Use `--refresh` to re-download every selected page. Generated corpus files are intentionally excluded from Git because they are large and become stale.

Every successful crawl automatically rebuilds the compressed deployable knowledge package. You can also rebuild it manually without crawling:

```bash
npm run uscis:package
```

The server automatically prefers the uncompressed local corpus during development and falls back to the committed compressed package in deployments.

## 3. Start the secure proxy

The local server reads `.env` automatically:

```bash
npm run ai:server
```

Verify it:

```bash
curl http://localhost:8787/health
```

## 4. Connect Expo

In `.env`, set the public URL and matching app token for the deployed server:

```bash
EXPO_PUBLIC_AI_PROXY_URL=https://immigration-helper-ai.onrender.com/api/ai
EXPO_PUBLIC_AI_CLIENT_TOKEN=your_generated_app_access_token
```

For a physical phone, `localhost` points to the phone, not the Mac. Use a deployed HTTPS endpoint or a secure development tunnel. Restart Expo after changing the value:

```bash
npm start
```

## Production notes

- Deploy `server/index.mjs` behind HTTPS.
- Restrict `ALLOWED_ORIGIN` where the hosting platform supports a stable web origin.
- Keep the built-in rate limit enabled and add hosting-layer abuse monitoring
  if traffic grows.
- Keep `OPENAI_API_KEY` only in server-side secrets.
- Schedule the resumable crawler periodically and review sitemap changes.
- USCIS content is general information, not legal advice. The assistant is instructed to avoid eligibility decisions and guarantees.

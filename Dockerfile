FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=10000

WORKDIR /app

COPY server/runtime/package.json ./package.json
COPY server/runtime/package-lock.json ./package-lock.json
RUN npm ci --omit=dev --ignore-scripts

COPY server ./server
COPY data/euLanguageSupport.json ./data/euLanguageSupport.json
COPY data/sensitiveIdentifiers.js ./data/sensitiveIdentifiers.js
COPY data/casePilotLanguageGate.mjs ./data/casePilotLanguageGate.mjs
COPY data/casePilotReleaseGate.mjs ./data/casePilotReleaseGate.mjs

EXPOSE 10000

USER node

CMD ["node", "server/index.mjs"]

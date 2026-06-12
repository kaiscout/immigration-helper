FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=10000

WORKDIR /app

COPY server ./server
COPY data/euLanguageSupport.json ./data/euLanguageSupport.json

EXPOSE 10000

USER node

CMD ["node", "server/index.mjs"]

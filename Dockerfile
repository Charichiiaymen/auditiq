FROM ghcr.io/puppeteer/puppeteer:latest

USER root

WORKDIR /app

# Install dependencies first (layer caching)
COPY server/package*.json ./
RUN npm install

# Copy server source
COPY server/ ./

ENV PORT=7860
EXPOSE 7860

CMD ["node", "index.js"]
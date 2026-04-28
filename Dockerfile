FROM node:22-bookworm-slim

# playwright install-deps needs these to run apt itself
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install-deps chromium && npx playwright install chromium

COPY . .
RUN npm run build

RUN mkdir -p /app/data/characters

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]

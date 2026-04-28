FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app

# Install deps first (layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Ensure data directory exists for SQLite + frame storage
RUN mkdir -p /app/data/characters

# Playwright browsers are pre-installed in this image at /ms-playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_ENV=production

EXPOSE 3000
CMD ["npm", "start"]

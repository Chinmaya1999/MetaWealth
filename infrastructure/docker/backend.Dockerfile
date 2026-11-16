# Build context: repository root.  docker build -f infrastructure/docker/backend.Dockerfile -t mwc-api .
FROM node:22-bookworm-slim
ENV NODE_ENV=production CHROME_PATH=/usr/bin/chromium
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY backend/packages backend/packages
COPY frontend/package.json frontend/
RUN npm ci --workspace @mwc/api --include-workspace-root --include=dev
COPY backend backend
RUN useradd -m app && mkdir -p backend/storage && chown -R app /app/backend/storage
USER app
WORKDIR /app/backend
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "tsx", "src/server.ts"]

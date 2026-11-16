FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
COPY backend/packages backend/packages
RUN npm ci --workspace @mwc/web --include-workspace-root
COPY frontend frontend
RUN npm run build -w @mwc/web
FROM nginx:1.27-alpine
COPY infrastructure/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80

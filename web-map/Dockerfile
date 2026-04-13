FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace manifest + lockfile
COPY package*.json ./
COPY web-map/package.json ./web-map/

# Install only web-map workspace deps using the root lockfile
RUN npm ci --workspace=web-map --ignore-scripts

# Copy web-map source
COPY web-map/ ./web-map/

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build --workspace=web-map

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/web-map/dist /usr/share/nginx/html
COPY web-map/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

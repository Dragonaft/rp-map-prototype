FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace manifest + lockfile
COPY package*.json ./
COPY admin-panel/package.json ./admin-panel/

# Install only admin-panel workspace deps using the root lockfile
RUN npm ci --workspace=admin-panel --ignore-scripts

# Copy admin-panel source
COPY admin-panel/ ./admin-panel/

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build --workspace=admin-panel

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/admin-panel/dist /usr/share/nginx/html
COPY admin-panel/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

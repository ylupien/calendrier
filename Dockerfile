# Image de production : frontend compilé (Vite) servi par le backend Node (API + Socket.IO).
# Utilisée par le service « web » du docker-compose, publié sur Internet par le tunnel Cloudflare.

FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/src ./src
COPY --from=frontend /build/dist ./public
ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/public
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
